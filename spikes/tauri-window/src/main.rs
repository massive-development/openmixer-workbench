// Spike v2: analyse once, mip levels on the GPU, playhead driven by a simulated audio clock.
use std::{
    sync::{Arc, Mutex, OnceLock},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{
    ipc::{Channel, InvokeResponseBody, Response},
    State,
};

const SR: f64 = 44_100.0;
const HOP: usize = 256; // samples per level-0 peak (~172 peaks/s)
const BUF: f64 = 512.0; // simulated audio callback size

struct TrackDef { title: &'static str, artist: &'static str, bpm: f64, key: &'static str, secs: f64, seed: u64 }
const TRACKS: [TrackDef; 2] = [
    TrackDef { title: "Harbour Lights (Extended Mix)", artist: "Nine Volt Choir", bpm: 140.0, key: "8A", secs: 257.0, seed: 7 },
    TrackDef { title: "Salt & Static", artist: "Mara Venn", bpm: 128.0, key: "5A", secs: 312.0, seed: 19 },
];

struct Analysis { levels: Vec<Vec<u8>>, ms: f64 }
static AN: [OnceLock<Analysis>; 2] = [OnceLock::new(), OnceLock::new()];

fn noise(s: &mut u64) -> f32 {
    *s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    ((*s >> 40) as f32 / (1u64 << 23) as f32) - 1.0
}

// Synthetic dance track: kick, offbeat bass, pad, hats and clap, arranged in 16-bar sections.
fn synth(t: f64, beat: f64, seed: &mut u64) -> f32 {
    const KICK: [f32; 10] = [0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0];
    const BASS: [f32; 10] = [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0, 0.5, 0.0];
    const PAD: [f32; 10] = [0.6, 0.4, 0.5, 1.0, 0.5, 0.6, 0.5, 1.0, 0.4, 0.6];
    const HATS: [f32; 10] = [0.4, 0.7, 1.0, 0.2, 1.0, 1.0, 1.0, 0.3, 0.8, 0.3];
    let bt = t / beat;
    let sec = ((bt / 64.0) as usize).min(9);
    let tb = (bt.fract() * beat) as f32;
    let tf = t as f32;
    let tau = std::f32::consts::TAU;
    let kick = (-tb * 14.0).exp() * (tau * (48.0 + 90.0 * (-tb * 35.0).exp()) * tb).sin() * 0.9;
    let tb2 = tb - (beat as f32) * 0.5;
    let bass = if tb2 >= 0.0 { (tau * 55.0 * tf).sin() * (-tb2 * 6.0).exp() * 0.5 } else { 0.0 };
    let pad = ((tau * 220.0 * tf).sin() + (tau * 277.2 * tf).sin() + (tau * 329.6 * tf).sin()) / 3.0
        * (0.6 + 0.4 * (tau * tf / (beat as f32 * 8.0)).sin()) * 0.35;
    let th = ((bt * 2.0).fract() * beat * 0.5) as f32;
    let n = noise(seed);
    let hats = n * (-th * 70.0).exp() * 0.35;
    let clap = if (bt as u64) % 2 == 1 { n * (-tb * 25.0).exp() * 0.3 } else { 0.0 };
    kick * KICK[sec] + bass * BASS[sec] + pad * PAD[sec] + (hats + clap) * HATS[sec]
}

// One pass over the audio: split into three bands, keep the peak per hop, then build mip levels.
fn analyse(d: &TrackDef) -> Analysis {
    let t0 = Instant::now();
    let n = (d.secs * SR) as usize;
    let beat = 60.0 / d.bpm;
    let a_lo = 1.0 - (-std::f32::consts::TAU * 180.0 / SR as f32).exp();
    let a_hi = 1.0 - (-std::f32::consts::TAU * 4000.0 / SR as f32).exp();
    let (mut lp_lo, mut lp_hi, mut pk, mut seed) = (0f32, 0f32, [0f32; 3], d.seed);
    let mut l0 = Vec::with_capacity(n / HOP * 3 + 3);
    for i in 0..n {
        let x = synth(i as f64 / SR, beat, &mut seed);
        lp_lo += a_lo * (x - lp_lo);
        lp_hi += a_hi * (x - lp_hi);
        let bands = [lp_lo, lp_hi - lp_lo, x - lp_hi];
        for b in 0..3 { pk[b] = pk[b].max(bands[b].abs()); }
        if (i + 1) % HOP == 0 {
            let gain = [1.15, 2.2, 3.0];
            for b in 0..3 { l0.push(((pk[b] * gain[b]).min(1.0) * 255.0) as u8); }
            pk = [0.0; 3];
        }
    }
    let mut levels = vec![l0];
    while levels.last().map_or(0, |l| l.len() / 3) > 1024 {
        let prev = levels.last().unwrap();
        let next: Vec<u8> = prev.chunks(6).flat_map(|c| {
            let g = |i: usize| if c.len() == 6 { c[i].max(c[i + 3]) } else { c[i] };
            [g(0), g(1), g(2)]
        }).collect();
        levels.push(next);
    }
    Analysis { levels, ms: t0.elapsed().as_secs_f64() * 1000.0 }
}

fn analysis(deck: usize) -> &'static Analysis { AN[deck].get_or_init(|| analyse(&TRACKS[deck])) }

#[derive(Clone, Copy)]
struct Deck { pos: f64, rate: f64, playing: bool, stamp: Instant, len: f64, vol: f32 }

struct Engine { decks: Mutex<[Deck; 2]>, cpu0: Mutex<Option<(Instant, u64)>>, params: Mutex<u64> }

// Stand-in for the audio callback: advances each deck by one buffer and stamps the time.
fn run_engine(e: Arc<Engine>) {
    let tick = Duration::from_secs_f64(BUF / SR);
    let mut next = Instant::now();
    loop {
        next += tick;
        {
            let mut d = e.decks.lock().unwrap();
            let now = Instant::now();
            for k in d.iter_mut() {
                if k.playing { k.pos += BUF * k.rate; if k.pos >= k.len { k.pos = 0.0 } }
                k.stamp = now;
            }
        }
        let now = Instant::now();
        if next > now { thread::sleep(next - now) } else { next = now }
    }
}

// (cpu ms, rss bytes) summed over this process and all descendants (webview helpers)
fn sample() -> (u64, u64) {
    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing().with_cpu().with_memory());
    let me = Pid::from_u32(std::process::id());
    let (mut cpu, mut rss) = (0u64, 0u64);
    for (pid, p) in sys.processes() {
        let (mut cur, mut mine) = (Some(*pid), false);
        for _ in 0..8 {
            match cur {
                Some(c) if c == me => { mine = true; break }
                Some(c) => cur = sys.process(c).and_then(|q| q.parent()),
                None => break,
            }
        }
        if mine { cpu += p.accumulated_cpu_time(); rss += p.memory(); }
    }
    (cpu, rss)
}

fn env_f(k: &str, d: f64) -> f64 { std::env::var(k).ok().and_then(|v| v.parse().ok()).unwrap_or(d) }

#[tauri::command]
fn config() -> serde_json::Value {
    serde_json::json!({ "bench": env_f("SPIKE_BENCH", 0.0), "fpsCap": env_f("SPIKE_FPS", 0.0), "sr": SR, "hop": HOP })
}

#[tauri::command(async)]
fn track_meta(deck: usize) -> serde_json::Value {
    let (t, a) = (&TRACKS[deck], analysis(deck));
    serde_json::json!({ "title": t.title, "artist": t.artist, "bpm": t.bpm, "key": t.key, "secs": t.secs,
        "analysisMs": a.ms, "levels": a.levels.iter().map(|l| l.len() / 3).collect::<Vec<_>>() })
}

#[tauri::command(async)]
fn track_peaks(deck: usize) -> Response { Response::new(analysis(deck).levels.concat()) }

#[tauri::command]
fn set_playing(deck: usize, on: bool, e: State<Arc<Engine>>) { e.decks.lock().unwrap()[deck].playing = on }

#[tauri::command]
fn set_rate(deck: usize, rate: f64, e: State<Arc<Engine>>) { e.decks.lock().unwrap()[deck].rate = rate }

#[tauri::command]
fn seek(deck: usize, pos: f64, e: State<Arc<Engine>>) {
    let mut d = e.decks.lock().unwrap();
    d[deck].pos = pos.clamp(0.0, d[deck].len - 1.0);
}

#[tauri::command]
fn set_param(id: u32, value: f32, e: State<Arc<Engine>>) {
    *e.params.lock().unwrap() += 1;
    if id < 2 { e.decks.lock().unwrap()[id as usize].vol = value } // ids 0/1 are the channel faders
}

#[tauri::command]
fn start_stream(ch: Channel<InvokeResponseBody>, e: State<Arc<Engine>>) {
    *e.cpu0.lock().unwrap() = Some((Instant::now(), sample().0));
    let e = e.inner().clone();
    thread::spawn(move || {
        let tick = Duration::from_secs_f64(1.0 / env_f("SPIKE_HZ", 60.0));
        let pad = env_f("SPIKE_PAD", 0.0) as usize;
        let (mut seq, mut next) = (0u32, Instant::now());
        loop {
            next += tick;
            let decks = *e.decks.lock().unwrap();
            let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs_f64() * 1000.0;
            let mut b = Vec::with_capacity(88 + pad);
            b.extend_from_slice(&now_ms.to_le_bytes()); // 0
            b.extend_from_slice(&seq.to_le_bytes()); // 8
            b.extend_from_slice(&[0u8; 4]); // 12
            let mut meters = [0f32; 6];
            for (i, d) in decks.iter().enumerate() {
                b.extend_from_slice(&d.pos.to_le_bytes()); // 16 + i*24
                b.extend_from_slice(&(d.stamp.elapsed().as_secs_f64() * 1000.0).to_le_bytes());
                b.extend_from_slice(&(d.rate as f32).to_le_bytes());
                b.extend_from_slice(&(d.playing as u8 as f32).to_le_bytes());
                if let (true, Some(a)) = (d.playing, AN[i].get()) {
                    let o = ((d.pos as usize / HOP) * 3).min(a.levels[0].len() - 3);
                    let p = &a.levels[0][o..o + 3];
                    meters[i * 2] = (p[0].max(p[1]) as f32 / 255.0) * d.vol;
                    meters[i * 2 + 1] = (p[0].max(p[2]) as f32 / 255.0) * d.vol;
                }
            }
            meters[4] = meters[0].max(meters[2]);
            meters[5] = meters[1].max(meters[3]);
            for m in meters { b.extend_from_slice(&m.to_le_bytes()); } // 64..88
            b.resize(88 + pad, 0);
            if ch.send(InvokeResponseBody::Raw(b)).is_err() { break }
            seq += 1;
            let now = Instant::now();
            if next > now { thread::sleep(next - now) } else { next = now }
        }
    });
}

#[tauri::command]
fn finish(stats: serde_json::Value, e: State<Arc<Engine>>, app: tauri::AppHandle) {
    let (t, c0) = e.cpu0.lock().unwrap().unwrap();
    let wall = t.elapsed().as_secs_f64();
    let (c1, rss) = sample();
    let mut s = stats;
    s["cpu_pct_all_procs_one_core"] = serde_json::json!((c1 - c0) as f64 / 1000.0 / wall * 100.0);
    s["rss_mb_all_procs"] = serde_json::json!(rss as f64 / 1048576.0);
    s["wall_s"] = serde_json::json!(wall);
    s["param_calls"] = serde_json::json!(*e.params.lock().unwrap());
    let path = std::env::var("SPIKE_OUT").unwrap_or("spike.json".into());
    let _ = std::fs::write(path, serde_json::to_string_pretty(&s).unwrap());
    app.exit(0);
}

fn main() {
    let now = Instant::now();
    let deck = |i: usize, pos: f64| Deck { pos, rate: 1.0, playing: false, stamp: now, len: TRACKS[i].secs * SR, vol: 0.85 };
    let engine = Arc::new(Engine { decks: Mutex::new([deck(0, 0.0), deck(1, 0.0)]), cpu0: Mutex::new(None), params: Mutex::new(0) });
    let e2 = engine.clone();
    thread::spawn(move || run_engine(e2));
    tauri::Builder::default()
        .manage(engine)
        .invoke_handler(tauri::generate_handler![config, track_meta, track_peaks, set_playing, set_rate, seek, set_param, start_stream, finish])
        .run(tauri::generate_context!())
        .expect("tauri run");
}
