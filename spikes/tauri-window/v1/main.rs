use std::{fs, sync::{Arc, Mutex}, thread, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};
use tauri::{ipc::{Channel, InvokeResponseBody, Response}, State};

const PEAKS: usize = 200_000; // ~ one song at overview resolution
const BANDS: usize = 3;

#[derive(Default)]
struct Cpu { start: Mutex<Option<(Instant, u64)>> }

// (cpu ms, rss bytes) summed over this process and all descendants (webview helpers)
fn sample() -> (u64, u64) {
    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing().with_cpu().with_memory());
    let me = Pid::from_u32(std::process::id());
    let (mut cpu, mut rss) = (0u64, 0u64);
    for (pid, p) in sys.processes() {
        let mut cur = Some(*pid);
        let mut mine = false;
        for _ in 0..8 {
            match cur { Some(c) if c == me => { mine = true; break } Some(c) => cur = sys.process(c).and_then(|q| q.parent()), None => break }
        }
        if mine { cpu += p.accumulated_cpu_time(); rss += p.memory(); }
    }
    (cpu, rss)
}

fn lcg(s: &mut u64) -> f32 { *s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); ((*s >> 33) as f32) / (u32::MAX >> 1) as f32 }

#[tauri::command]
fn opts() -> String { std::env::var("SPIKE_OPTS").unwrap_or_default() }

#[tauri::command]
fn mode() -> String { std::env::var("SPIKE_MODE").unwrap_or("naive".into()) }

#[tauri::command]
fn waveform(deck: u8) -> Response {
    let mut seed = 42 + deck as u64;
    let mut out = vec![0u8; PEAKS * BANDS];
    for i in 0..PEAKS {
        let beat = ((i as f32 / 520.0).fract() < 0.12) as u8 as f32; // kick on beat grid
        let phrase = 0.55 + 0.45 * ((i as f32 / 9000.0).sin());
        let low = (0.35 + 0.65 * beat) * phrase;
        let mid = (0.3 + 0.4 * lcg(&mut seed)) * phrase;
        let high = (0.15 + 0.5 * lcg(&mut seed) * lcg(&mut seed)) * phrase;
        out[i * 3] = (low.min(1.0) * 255.0) as u8;
        out[i * 3 + 1] = (mid.min(1.0) * 255.0) as u8;
        out[i * 3 + 2] = (high.min(1.0) * 255.0) as u8;
    }
    Response::new(out)
}

#[tauri::command]
fn start_stream(ch: Channel<InvokeResponseBody>, cpu: State<Arc<Cpu>>) {
    *cpu.start.lock().unwrap() = Some((Instant::now(), sample().0));
    thread::spawn(move || {
        let t0 = Instant::now();
        let mut seq = 0u32;
        let pad: usize = std::env::var("SPIKE_PAD").ok().and_then(|v| v.parse().ok()).unwrap_or(0);
        let hz: f64 = std::env::var("SPIKE_HZ").ok().and_then(|v| v.parse().ok()).unwrap_or(60.0);
        let tick = Duration::from_micros((1_000_000.0 / hz) as u64);
        let mut next = Instant::now();
        loop {
            next += tick;
            let el = t0.elapsed().as_secs_f64();
            let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs_f64() * 1000.0;
            let mut b = Vec::with_capacity(64);
            b.extend_from_slice(&now_ms.to_le_bytes());           // 0  f64 send time
            b.extend_from_slice(&seq.to_le_bytes());              // 8  u32
            b.extend_from_slice(&[0u8; 4]);                       // 12 pad
            b.extend_from_slice(&(el * 1000.0 + 20000.0).to_le_bytes());        // 16 playhead A, in peaks (1000/s)
            b.extend_from_slice(&(el * 1000.0 * 0.97 + 60000.0).to_le_bytes()); // 24 playhead B
            for m in 0..8 { let v = (0.5 + 0.5 * ((el * (2.0 + m as f64)).sin())) as f32; b.extend_from_slice(&v.to_le_bytes()); } // 32..64
            b.resize(64 + pad, 0);
            if ch.send(InvokeResponseBody::Raw(b)).is_err() { break }
            seq += 1;
            let now = Instant::now();
            if next > now { thread::sleep(next - now) } else { next = now }
        }
    });
}

#[tauri::command]
fn finish(stats: serde_json::Value, cpu: State<Arc<Cpu>>, app: tauri::AppHandle) {
    let (t, k0) = cpu.start.lock().unwrap().unwrap();
    let wall = t.elapsed().as_secs_f64();
    let (c1, rss) = sample();
    let cpu_pct = (c1 - k0) as f64 / 1000.0 / wall * 100.0;
    let mut s = stats;
    s["cpu_pct_all_procs_one_core"] = serde_json::json!(cpu_pct);
    s["rss_mb_all_procs"] = serde_json::json!(rss as f64 / 1048576.0);
    s["wall_s"] = serde_json::json!(wall);
    let path = std::env::var("SPIKE_OUT").unwrap_or("spike.json".into());
    let _ = fs::write(path, serde_json::to_string_pretty(&s).unwrap());
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(Cpu::default()))
        .invoke_handler(tauri::generate_handler![opts, mode, waveform, start_stream, finish])
        .run(tauri::generate_context!())
        .expect("tauri run");
}
