// Spike v2 front end. Waveform: peaks analysed once in Rust, uploaded once as a texture,
// drawn by a shader; each frame only changes a few uniforms. Everything else is DOM + CSS.
const { invoke, Channel } = window.__TAURI__.core;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const HUES = ['#e3a24f', '#86a9cb'], HUE_RGB = [[0.89, 0.635, 0.31], [0.525, 0.663, 0.796]], LETTER = ['A', 'B'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dpr = () => window.devicePixelRatio || 1;
let SR = 44100, HOP = 256, CFG = {}, zoomSecs = 8;
const decks = [0, 1].map(i => ({ i, pos: 0, age: 0, recv: 0, rate: 1, playing: false, hold: null, holdPk: 0, cues: [], el: {} }));
const meterVals = new Float32Array(6), meterShown = new Float32Array(6), meterEls = [];

const fmtTime = s => { const a = Math.abs(s), m = Math.floor(a / 60); return `${String(m).padStart(2, '0')}:${(a - m * 60).toFixed(1).padStart(4, '0')}`; };
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };

// ---------- controls ----------
function dragValue(el, get, set, { horiz = false, range = 160 } = {}) {
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const fromPos = ev => horiz ? (ev.clientX - r.left - 6) / (r.width - 12) : 1 - (ev.clientY - r.top - 6) / (r.height - 12);
    let last = horiz ? e.clientX : e.clientY, v = get();
    const absolute = el.classList.contains('fader');
    if (absolute) set(clamp(fromPos(e), 0, 1));
    const move = ev => {
      if (absolute) return set(clamp(fromPos(ev), 0, 1));
      const p = ev.clientY; v = clamp(v - (p - last) / range, 0, 1); last = p; set(v);
    };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  });
}
function knob(el, id, init = 0.5) {
  let v = init;
  const set = (x, send = true) => { v = x; el.style.setProperty('--a', `${v * 270 - 135}deg`); if (send) invoke('set_param', { id, value: v }); };
  set(init, false);
  dragValue(el, () => v, set);
  el.addEventListener('dblclick', () => set(init));
}
function fader(el, init, onChange, horiz = false) {
  const thumb = $('.thumb', el); let v = init;
  const place = () => {
    const span = (horiz ? el.clientWidth : el.clientHeight) - 12;
    thumb.style.transform = horiz ? `translate3d(${6 + v * span}px,0,0)` : `translate3d(0,${6 + (1 - v) * span}px,0)`;
  };
  const set = (x, notify = true) => { v = x; place(); if (notify) onChange(v); };
  new ResizeObserver(place).observe(el);
  dragValue(el, () => v, set, { horiz });
  el.addEventListener('dblclick', () => set(init));
  return set;
}

// ---------- DOM ----------
function build() {
  $('#heads').innerHTML = decks.map(d => `
    <div class="head" style="--hue:${HUES[d.i]}" data-deck="${d.i}">
      <div class="row"><div class="letter">${LETTER[d.i]}</div>
        <div style="min-width:0"><div class="title"></div><div class="artist"></div></div>
        <div class="stat"><span class="label">Key</span><b class="key"></b></div>
        <div class="stat"><span class="label">BPM</span><b class="bpm"></b></div>
        <div class="stat time"><span class="label">Remain</span><b class="remain"></b></div></div>
      <div class="overview"><canvas></canvas><div class="played"></div><div class="ph"></div></div>
    </div>`).join('');
  $$('.lane').forEach((lane, i) => {
    lane.style.setProperty('--hue', HUES[i]);
    lane.innerHTML = `<span class="tag">${LETTER[i]}</span>` + '<span class="bar"></span>'.repeat(24) + '<span class="flag"><b></b></span>'.repeat(8);
  });
  $$('.deckpanel').forEach((p, i) => {
    p.style.setProperty('--hue', HUES[i]);
    p.innerHTML = `
      <div class="deckmain">
        <div class="readouts">
          <div><span class="label">Tempo</span><div class="bpm">0.00</div></div>
          <div class="sub"><span class="label">Pitch</span><b class="pitch">+0.00%</b></div>
          <div class="sub"><span class="label">Range</span><b>±8%</b></div>
          <div class="sub"><span class="label">Elapsed</span><b class="elapsed">00:00.0</b></div>
        </div>
        <div class="pads">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<button class="pad" data-n="${n - 1}"><span class="n">${n}</span><span class="t"></span></button>`).join('')}</div>
        <div class="loops"><span class="label">Loop</span>${['1/4', '1/2', '1', '2', '4', '8'].map(l => `<button class="btn num">${l}</button>`).join('')}</div>
        <div class="transport"><button class="btn cue">Cue</button><button class="btn play">Play</button><button class="btn sync">Sync</button></div>
      </div>
      <div class="tempo"><span class="label">Tempo</span><div class="fader"><div class="thumb"></div></div><span class="num pitch2"></span></div>`;
  });
  const strip = i => `
    <div class="strip ${i ? 'b' : 'a'}" style="--hue:${HUES[i]}"><h3><i></i>Channel ${LETTER[i]}</h3>
      <div class="knobs">${['Gain', 'High', 'Mid', 'Low', 'Filter'].map((k, j) => `<div class="knobcell"><div class="knob" data-id="${10 + i * 10 + j}"><i></i></div><span class="label">${k}</span></div>`).join('')}</div>
      <div class="fader" data-ch="${i}"><div class="thumb"></div></div>
      <div class="meters"><div class="meter"><i></i></div><div class="meter"><i></i></div></div>
    </div>`;
  $('#mixer').innerHTML = `
    <div class="strips">${strip(0)}
      <div class="master"><h3>Master</h3><div class="meters"><div class="meter"><i></i></div><div class="meter"><i></i></div></div>
        <div class="knob" data-id="40"><i></i></div></div>${strip(1)}</div>
    <div class="xf"><span style="color:${HUES[0]}">A</span><div class="fader h" data-xf><div class="thumb"></div></div><span style="color:${HUES[1]}">B</span></div>`;
  // meter order matches the packet: A-L, A-R, B-L, B-R, master-L, master-R
  const m = s => $$(`${s} .meter i`);
  meterEls.push(...m('.strip.a'), ...m('.strip.b'), ...m('.master'));
  $$('.knob').forEach(k => knob(k, +k.dataset.id, k.dataset.id === '40' ? 0.75 : 0.5));
  $$('.fader[data-ch]').forEach(f => fader(f, 0.85, v => invoke('set_param', { id: +f.dataset.ch, value: v })));
  fader($('.fader[data-xf]'), 0.5, v => invoke('set_param', { id: 50, value: v }), true);
  $$('.chip').forEach(c => c.parentElement.classList.contains('tabs') && c.addEventListener('click', () => { $$('.tabs .chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); }));
  $$('.loops').forEach(l => $$('.btn', l).forEach(b => b.addEventListener('click', () => { const on = b.classList.contains('on'); $$('.btn', l).forEach(x => x.classList.remove('on')); b.classList.toggle('on', !on); })));
}

function wireDeck(d) {
  const head = $(`.head[data-deck="${d.i}"]`), panel = $(`.deckpanel[data-deck="${d.i}"]`), lane = $(`.lane[data-deck="${d.i}"]`);
  const m = d.meta;
  d.el = { remain: $('.remain', head), bpmH: $('.bpm', head), played: $('.played', head), ph: $('.ph', head), ov: $('.overview', head),
    bpm: $('.bpm', panel), pitch: $('.pitch', panel), pitch2: $('.pitch2', panel), elapsed: $('.elapsed', panel), play: $('.play', panel), sync: $('.sync', panel),
    bars: $$('.bar', lane).map(e => ({ e, n: -1, on: true })), flags: $$('.flag', lane).map(e => ({ e, b: $('b', e), on: true })), lane, pads: $$('.pad', panel) };
  $('.title', head).textContent = m.title; $('.artist', head).textContent = m.artist; $('.key', head).textContent = m.key;
  d.len = m.secs * SR; d.beat = 60 / m.bpm * SR; // samples per beat
  d.cues = [8, 16, 32, 48, 64].map(bar => bar * 4 * d.beat).filter(c => c < d.len);
  const setRate = r => { d.rate = r; invoke('set_rate', { deck: d.i, rate: r }); };
  d.setTempo = fader($('.fader', panel), 0.5, v => setRate(1 + (0.5 - v) * 0.16));
  d.el.play.addEventListener('click', () => setPlaying(d, !d.playing));
  $('.cue', panel).addEventListener('click', () => { setPlaying(d, false); jump(d, d.cues[0] || 0); });
  d.el.sync.addEventListener('click', () => {
    const o = decks[1 - d.i], r = clamp(o.meta.bpm * o.rate / m.bpm, 0.92, 1.08);
    d.setTempo(0.5 - (r - 1) / 0.16); d.el.sync.classList.add('on'); o.el.sync.classList.remove('on');
  });
  d.el.pads.forEach((p, n) => p.addEventListener('click', () => { if (d.cues[n] == null) { d.cues[n] = cur(d, performance.now()); paintCues(d); } else jump(d, d.cues[n]); }));
  const seekAt = ev => { const r = d.el.ov.getBoundingClientRect(); jump(d, clamp((ev.clientX - r.left) / r.width, 0, 1) * d.len); };
  d.el.ov.addEventListener('pointerdown', e => { d.el.ov.setPointerCapture(e.pointerId); seekAt(e); d.el.ov.onpointermove = seekAt; });
  d.el.ov.addEventListener('pointerup', () => { d.el.ov.onpointermove = null; });
  lane.addEventListener('pointerdown', e => {
    lane.setPointerCapture(e.pointerId);
    const x0 = e.clientX, p0 = cur(d, performance.now());
    d.hold = p0; d.holdPk = 0;
    lane.onpointermove = ev => { d.hold = clamp(p0 - (ev.clientX - x0) * dpr() * view.ppp * HOP, 0, d.len - 1); d.seekDirty = true; };
  });
  lane.addEventListener('pointerup', () => { lane.onpointermove = null; if (d.hold != null) jump(d, d.hold); });
  paintCues(d); drawOverview(d);
  new ResizeObserver(() => drawOverview(d)).observe(d.el.ov);
}
function setPlaying(d, on) { d.playing = on; d.el.play.classList.toggle('on', on); d.el.play.textContent = on ? 'Pause' : 'Play'; return invoke('set_playing', { deck: d.i, on }); }
// Hold the local position until two fresh packets confirm the seek, so the view never snaps back.
function jump(d, pos) { d.hold = pos; d.holdPk = 0; invoke('seek', { deck: d.i, pos }).then(() => { d.holdPk = 2; }); }
function paintCues(d) {
  $$('.cue', d.el.ov).forEach(c => c.remove());
  d.el.pads.forEach((p, n) => { const c = d.cues[n]; p.classList.toggle('set', c != null); $('.t', p).textContent = c != null ? fmtTime(c / SR).slice(0, 5) : '';
    if (c != null) { const k = document.createElement('div'); k.className = 'cue'; k.style.left = `${c / d.len * 100}%`; d.el.ov.appendChild(k); } });
}
function drawOverview(d) {
  const c = $('canvas', d.el.ov), w = Math.round(d.el.ov.clientWidth * dpr()), h = Math.round(d.el.ov.clientHeight * dpr());
  if (!w || !h) return; c.width = w; c.height = h;
  const g = c.getContext('2d'), lv = d.levels.findLast(l => l.len >= w) || d.levels[d.levels.length - 1], per = lv.len / w, k = h / 2 / 255;
  const cols = [`color-mix(in srgb, ${HUES[d.i]} 42%, #0a0a09)`, HUES[d.i], '#ece8df'], amp = [0.92, 0.62, 0.34];
  for (let b = 0; b < 3; b++) {
    g.fillStyle = cols[b]; g.beginPath();
    for (let x = 0; x < w; x++) {
      let m = 0; const a = Math.floor(x * per), e = Math.max(a, Math.floor((x + 1) * per) - 1);
      for (let i = a; i <= e && i < lv.len; i++) m = Math.max(m, d.peaks[(lv.off + i) * 3 + b]);
      const y = m * k * amp[b]; g.rect(x, h / 2 - y, 1, y * 2);
    }
    g.fill();
  }
}

// ---------- GL waveform ----------
const view = { ppp: 1 };
let gl, U = {}, canvas;
const FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D tex; uniform vec2 org, size; uniform float pos, ppp, beatLen, len, px; uniform int nlev;
uniform float lrow[12]; uniform float llen[12]; uniform vec3 hue; out vec4 o;
vec3 peak(int lv, float i){ if(i<0.||i>=llen[lv]) return vec3(0.); int n=int(i); return texelFetch(tex, ivec2(n&4095, int(lrow[lv])+(n>>12)), 0).rgb; }
float cover(float h, float a, float aa){ return h<.004 ? 0. : 1.-smoothstep(h-aa, h+aa, a); }
void main(){
  vec2 p=gl_FragCoord.xy-org; float pt=pos+(p.x-size.x*.5)*ppp;
  int lv=int(clamp(floor(log2(max(ppp,1.))),0.,float(nlev-1))); float sc=exp2(float(lv)), i=pt/sc, w=ppp/sc;
  vec3 m = w<1. ? mix(peak(lv,floor(i)),peak(lv,floor(i)+1.),fract(i)) : max(peak(lv,floor(i)),peak(lv,floor(i)+1.));
  float a=abs(p.y/size.y-.5)*2., aa=1.5/size.y; vec3 well=vec3(.039,.039,.035), ink=vec3(.925,.91,.875), c=well;
  bool inside = pt>=0. && pt<len;
  if(inside){
    float bp=pt/beatLen, lw=ppp/beatLen;                     // one pixel, in beats
    if(fract(bp)<lw){ bool bar=mod(floor(bp),4.)<.5; if(bar || beatLen/ppp>10.*px) c=mix(c,ink,bar?.2:.07); }
    c=mix(c,hue*.42,cover(m.r*.92,a,aa)); c=mix(c,hue*.9,cover(m.g*.62,a,aa)); c=mix(c,ink,cover(m.b*.34,a,aa));
    if(p.x<size.x*.5) c=mix(c,well,.38);                     // already played
  } else c=well*.6;
  if(abs(p.x-size.x*.5)<px) c=vec3(.937,.353,.247);          // playhead
  o=vec4(c,1.);
}`;
function initGL() {
  canvas = $('#gl');
  gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const pr = gl.createProgram();
  gl.attachShader(pr, mk(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}'));
  gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['org', 'size', 'pos', 'ppp', 'beatLen', 'len', 'px', 'nlev', 'lrow', 'llen', 'hue']) U[n] = gl.getUniformLocation(pr, n);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
}
// One texture per track: every mip level packed into rows of 4096 texels. Uploaded once.
function uploadTrack(d) {
  let row = 0; d.lrow = new Float32Array(12); d.llen = new Float32Array(12);
  d.levels.forEach((l, k) => { d.lrow[k] = row; d.llen[k] = l.len; row += Math.ceil(l.len / 4096); });
  const buf = new Uint8Array(4096 * row * 3);
  d.levels.forEach((l, k) => buf.set(d.peaks.subarray(l.off * 3, (l.off + l.len) * 3), d.lrow[k] * 4096 * 3));
  d.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, d.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, 4096, row, 0, gl.RGB, gl.UNSIGNED_BYTE, buf);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
}

// ---------- frame ----------
const cur = (d, now) => d.hold != null ? d.hold : clamp(d.pos + (d.playing ? (d.age + now - d.recv) * SR / 1000 * d.rate : 0), 0, d.len || 1);
const stats = { frames: [], work: [], lat: [], gap: [], lost: 0, measuring: false };
let lastDraw = 0, lastPkt = 0, lastSeq = -1, hudT = 0, hudN = 0, hudWork = 0, hudLat = 0, hudLatN = 0;

function frame(ts) {
  requestAnimationFrame(frame);
  if (CFG.fpsCap && ts - lastDraw < 1000 / CFG.fpsCap - 2) return;
  const t0 = performance.now(), r = dpr();
  const cw = Math.round(canvas.clientWidth * r), ch = Math.round(canvas.clientHeight * r);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  const laneH = Math.floor(ch / 2), wCss = cw / r;
  view.ppp = zoomSecs * SR / HOP / cw;
  // Nothing moved since the last frame: skip the GL pass and the label updates entirely.
  const key = `${cw},${ch},${view.ppp},` + decks.map(d => d.tex ? `${cur(d, t0)},${d.rate},${d.cues.length}` : '').join();
  const dirty = key !== view.key; view.key = key;
  for (const d of decks) {
    if (!d.tex || !dirty) continue;
    const p = cur(d, t0), pts = p / HOP, beatPts = d.beat / HOP;
    if (d.seekDirty) { d.seekDirty = false; invoke('seek', { deck: d.i, pos: p }); }
    gl.viewport(0, ch - (d.i + 1) * laneH, cw, laneH);
    gl.bindTexture(gl.TEXTURE_2D, d.tex);
    gl.uniform2f(U.org, 0, ch - (d.i + 1) * laneH); gl.uniform2f(U.size, cw, laneH);
    gl.uniform1f(U.pos, pts); gl.uniform1f(U.ppp, view.ppp); gl.uniform1f(U.beatLen, beatPts); gl.uniform1f(U.len, d.len / HOP); gl.uniform1f(U.px, r);
    gl.uniform1i(U.nlev, d.levels.length); gl.uniform1fv(U.lrow, d.lrow); gl.uniform1fv(U.llen, d.llen); gl.uniform3fv(U.hue, HUE_RGB[d.i]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // bar numbers and cue flags ride on the compositor
    const barPts = beatPts * 4, pxPerBar = barPts / view.ppp / r; let step = 1; while (pxPerBar * step < 46) step *= 2;
    const n0 = Math.ceil((pts - cw / 2 * view.ppp) / (barPts * step)) * step;
    d.el.bars.forEach((b, j) => {
      const n = n0 + j * step, x = (n * barPts - pts) / view.ppp / r + wCss / 2, on = n >= 0 && n * barPts < d.len / HOP && x < wCss;
      if (on !== b.on) { b.on = on; b.e.style.display = on ? '' : 'none'; }
      if (!on) return;
      b.e.style.transform = `translate3d(${x}px,0,0)`;
      if (b.n !== n) { b.n = n; b.e.textContent = n + 1; }
    });
    d.el.flags.forEach((f, j) => {
      const c = d.cues[j], x = c == null ? -1 : (c / HOP - pts) / view.ppp / r + wCss / 2, on = c != null && x > -24 && x < wCss;
      if (on !== f.on) { f.on = on; f.e.style.display = on ? '' : 'none'; }
      if (on) { f.e.style.transform = `translate3d(${x}px,0,0)`; setText(f.b, String(j + 1)); }
    });
    const frac = p / d.len;
    d.el.ph.style.transform = `translate3d(${frac * d.el.ov.clientWidth}px,0,0)`; d.el.played.style.transform = `scaleX(${frac})`;
    setText(d.el.remain, '-' + fmtTime((d.len - p) / SR / d.rate)); setText(d.el.elapsed, fmtTime(p / SR));
    const bpm = (d.meta.bpm * d.rate).toFixed(2), pitch = `${d.rate >= 1 ? '+' : ''}${((d.rate - 1) * 100).toFixed(2)}%`;
    setText(d.el.bpm, bpm); setText(d.el.bpmH, bpm); setText(d.el.pitch, pitch); setText(d.el.pitch2, pitch);
  }
  for (let i = 0; i < 6; i++) {
    const v = Math.max(meterVals[i], meterShown[i] - 0.03);
    if (Math.abs(v - meterShown[i]) > 0.003) { meterShown[i] = v; meterEls[i].style.transform = `scaleY(${1 - clamp(v, 0, 1)})`; }
  }
  const work = performance.now() - t0;
  if (lastDraw && stats.measuring) { stats.frames.push(ts - lastDraw); stats.work.push(work); }
  hudN++; hudWork += work;
  if (ts - hudT > 500) {
    setText($('#hud'), `${(hudN * 1000 / (ts - hudT)).toFixed(0)} fps · ${(hudWork / hudN).toFixed(2)} ms/frame · ipc ${hudLatN ? (hudLat / hudLatN).toFixed(1) : '-'} ms`);
    hudT = ts; hudN = 0; hudWork = 0; hudLat = 0; hudLatN = 0;
    setText($('#clock'), new Date().toTimeString().slice(0, 8));
  }
  lastDraw = ts;
}

function onPacket(buf) {
  const dv = new DataView(buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer), now = performance.now();
  const sent = dv.getFloat64(0, true), seq = dv.getUint32(8, true), lat = Date.now() - sent;
  for (const d of decks) {
    const o = 16 + d.i * 24;
    d.pos = dv.getFloat64(o, true); d.age = dv.getFloat64(o + 8, true); d.recv = now;
    if (d.holdPk > 0 && --d.holdPk === 0) d.hold = null;
  }
  for (let i = 0; i < 6; i++) meterVals[i] = dv.getFloat32(64 + i * 4, true);
  hudLat += lat; hudLatN++;
  if (stats.measuring) { stats.lat.push(lat); if (lastPkt) stats.gap.push(now - lastPkt); if (lastSeq >= 0 && seq !== lastSeq + 1) stats.lost += seq - lastSeq - 1; }
  lastPkt = now; lastSeq = seq;
}

const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const summ = a => ({ n: a.length, mean: a.reduce((x, y) => x + y, 0) / (a.length || 1), p50: pct(a, .5), p95: pct(a, .95), p99: pct(a, .99), max: a.length ? Math.max(...a) : 0 });

async function main() {
  const tInit = performance.now();
  CFG = await invoke('config'); SR = CFG.sr; HOP = CFG.hop;
  build(); initGL();
  await Promise.all(decks.map(async d => {
    d.meta = await invoke('track_meta', { deck: d.i });
    d.peaks = new Uint8Array(await invoke('track_peaks', { deck: d.i }));
    let off = 0; d.levels = d.meta.levels.map(len => { const l = { len, off }; off += len; return l; });
    wireDeck(d); uploadTrack(d);
  }));
  const loadMs = performance.now() - tInit;
  const ch = new Channel(); ch.onmessage = onPacket;
  await invoke('start_stream', { ch });
  await invoke('seek', { deck: 1, pos: 32 * 4 * decks[1].beat });
  if (CFG.bench !== 2) { await setPlaying(decks[0], true); await setPlaying(decks[1], true); }
  $('#waves').addEventListener('wheel', e => { e.preventDefault(); zoomSecs = clamp(zoomSecs * (e.deltaY > 0 ? 1.15 : 1 / 1.15), 1, 64); }, { passive: false });
  requestAnimationFrame(frame);
  if (!CFG.bench) return;
  setTimeout(() => { stats.measuring = true;
    setTimeout(async () => {
      stats.measuring = false; const f = summ(stats.frames);
      await invoke('finish', { stats: { mode: CFG.bench === 2 ? 'v2-paused' : 'v2', fps_cap: CFG.fpsCap, viewport: [innerWidth, innerHeight, dpr()], load_ms: loadMs,
        analysis_ms: decks.map(d => d.meta.analysisMs), peaks_bytes: decks.map(d => d.peaks.length), levels: decks[0].meta.levels,
        frame_ms: f, work_ms: summ(stats.work), ipc_latency_ms: summ(stats.lat), ipc_interval_ms: summ(stats.gap), packets_lost: stats.lost,
        fps: f.mean ? 1000 / f.mean : null, frames_over_20ms: stats.frames.filter(x => x > 20).length } });
    }, 20000);
  }, 3000);
}
main().catch(e => { document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:60px 20px auto;color:#ef5a3f;white-space:pre-wrap">${e && e.stack || e}</pre>`); });
