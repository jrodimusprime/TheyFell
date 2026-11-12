// Synthesised sound (WebAudio), like Cimmerian's: no audio files. Sound travels at 343 m/s, so a distant burst
// is seen before it is heard, and distance muffles it. A constant drumfire bed sits under everything; larks sang over
// the Somme on the morning of 1 July 1916 (no birdsong: removed at the player's request).
export class Audio {
  constructor() { this.ctx = null; this.enabled = true; this.listener = { x: 0, y: 0, z: 0 }; this.zero = false; }
  start(ctx) {
    if (this.ctx) return;
    const C = this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0.7;
    // the end of the chain: a slow-attack compressor lets a rifle's first milliseconds through (that is its punch), then a
    // soft clipper keeps the loudest moments from cracking digitally
    const clip = C.createWaveShaper(), k = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; k[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); } clip.curve = k;
    this.master.connect(clip).connect(C.destination);
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.008; comp.release.value = 0.3; comp.knee.value = 8; comp.connect(this.master); this.out = comp;
    const len = C.sampleRate * 2; this.noise = C.createBuffer(1, len, C.sampleRate); const d = this.noise.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = C.createBuffer(1, len, C.sampleRate); const e = this.brown.getChannelData(0); for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; e[i] = b * 3.5; }
    // rifle reports (a few of each, so no two shots are quite alike), the bullet's supersonic snap, and the open
    // ground's echo: the boom rolling off the chalk, the woods and the ridges
    const mk = (n, f, o) => Array.from({ length: n }, (_, i) => { const a = f(C.sampleRate, mulberry(i * 7919 + 13), o); const B = C.createBuffer(1, a.length, C.sampleRate); B.getChannelData(0).set(a); return B; });
    this.reports = { rifle: mk(5, report, {}), mg08: mk(4, report, { mg: true }) };
    this.snaps = mk(3, snap, {});
    const ir = echoes(C.sampleRate, mulberry(77)); this.verbBuf = C.createBuffer(2, ir[0].length, C.sampleRate); this.verbBuf.getChannelData(0).set(ir[0]); this.verbBuf.getChannelData(1).set(ir[1]);
    this.verb = C.createConvolver(); this.verb.normalize = false; this.verb.buffer = this.verbBuf; this.verbIn = C.createGain(); this.verbIn.gain.value = 1; this.verbIn.connect(this.verb).connect(this.out);
    // drumfire bed
    const src = C.createBufferSource(); src.buffer = this.brown; src.loop = true; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    this.bed = C.createGain(); this.bed.gain.value = 0.35; src.connect(lp).connect(this.bed).connect(this.out); src.start();
  }
  // left-right: where the sound is from, against the way the listener faces (yaw as the sim has it: forward = -sin, -cos)
  _pan(p) { const l = this.listener; if (l.yaw === undefined) return 0; const dx = p[0] - l.x, dz = p[2] - l.z, h = Math.hypot(dx, dz); if (h < 0.5) return 0; return Math.max(-1, Math.min(1, (dx * Math.cos(l.yaw) - dz * Math.sin(l.yaw)) / h)) * 0.8; }
  _play(buf, when, { gain = 1, lp = 20000, pan = 0, verb = 0, rate = 1 } = {}) {
    const C = this.ctx, s = C.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(lp, C.sampleRate / 2 - 100); f.Q.value = 0.5;
    const g = C.createGain(); g.gain.value = gain; s.connect(f).connect(g);
    if (C.createStereoPanner) { const pn = C.createStereoPanner(); pn.pan.value = pan; g.connect(pn).connect(this.out); } else g.connect(this.out);
    if (verb > 0) { const v = C.createGain(); v.gain.value = verb; f.connect(v).connect(this.verbIn); }
    s.start(when); s.stop(when + buf.duration / rate + 0.05);
  }
  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? 0.7 : 0; }
  _dist(p) { const l = this.listener; return Math.hypot(p[0] - l.x, (p[1] ?? l.y) - l.y, p[2] - l.z); }
  _burst(when, dur, freq, q, gain, decay, type = 'lowpass', buf = this.noise) {
    const C = this.ctx, s = C.createBufferSource(); s.buffer = buf; const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = C.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, when + decay);
    s.connect(f).connect(g).connect(this.out); s.start(when, Math.random(), dur + 0.1); s.stop(when + dur + 0.2);
  }
  shot(p, weapon, isPlayer) {
    if (!this.ctx || !this.enabled) return;
    const d = isPlayer ? 0 : this._dist(p); if (d > 3000) return;
    const C = this.ctx, when = C.currentTime + d / 343, set = this.reports[weapon === 'mg08' ? 'mg08' : 'rifle'];
    const buf = set[Math.floor(Math.random() * set.length)], rate = 0.95 + Math.random() * 0.1;
    // amplitude falls as 1/distance from a reference ~6 m out; the air takes the top end off far shots, so a rifle a
    // kilometre off is a dull thud with its echo; the echo falls off more slowly than the report itself
    const dry = isPlayer ? 1.25 : Math.min(1.1, 6 / (6 + d)), lp = isPlayer ? 20000 : Math.max(500, 16000 / (1 + d / 120));
    const verb = isPlayer ? 0.32 : 0.3 * 40 / (40 + d);
    this._play(buf, when, { gain: dry, lp, pan: isPlayer ? 0 : this._pan(p), verb, rate: isPlayer ? 1 : rate });
  }
  // a bullet going past within a few metres: the supersonic snap, heard before the report of the rifle that fired it
  snap(o, miss) {
    if (!this.ctx || !this.enabled) return;
    const C = this.ctx, d = this._dist(o), when = C.currentTime + d / 740;
    this._play(this.snaps[Math.floor(Math.random() * this.snaps.length)], when, { gain: 0.9 / (1 + miss / 1.5), pan: this._pan(o) * 0.5, verb: 0.08 });
  }
  bolt() { if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; this._burst(t + 0.25, 0.05, 3000, 2, 0.12, 0.05, 'bandpass'); this._burst(t + 0.5, 0.05, 2200, 2, 0.15, 0.06, 'bandpass'); }
  reload() { if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; for (let i = 0; i < 5; i++) this._burst(t + 0.15 + i * 0.09, 0.03, 4000, 3, 0.08, 0.03, 'bandpass'); }
  boom(p, kind) {
    if (!this.ctx || !this.enabled) return;
    const d = this._dist(p); const C = this.ctx, when = C.currentTime + d / 343;
    const big = kind === 'mine' ? 6 : kind === 'heavy' ? 2 : kind === 'grenade' ? 0.6 : kind === 'shrapnel' ? 0.7 : 1;
    const att = Math.min(1.4, big * 2.5 / (1 + d / 50));
    if (att < 0.004) return;
    this._burst(when, 1.5 * big, Math.max(90, 2200 / (1 + d / 80)), 0.5, att, 0.8 + big * 0.6 + d / 1500);
    this._burst(when, 3 * big, 70, 0.7, att * 1.4, 1.5 + big + d / 800, 'lowpass', this.brown);
    if (kind === 'mine') { this._burst(when, 14, 50, 0.6, 1.2, 14, 'lowpass', this.brown); for (let i = 0; i < 40; i++) this._burst(when + 2 + Math.random() * 12, 0.2, 900, 1, 0.08, 0.25); }
  }
  incoming(p, kind) {
    if (!this.ctx || !this.enabled) return;
    const d = this._dist(p); if (d > 260) return;
    const C = this.ctx, t = C.currentTime, o = C.createOscillator(), g = C.createGain(), dur = 0.75;
    o.type = 'sine'; o.frequency.setValueAtTime(kind === 'shrapnel' ? 1500 : 1100, t); o.frequency.exponentialRampToValueAtTime(kind === 'shrapnel' ? 700 : 380, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * (1 - d / 260), t + dur * 0.9); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  whistle(p, delay = 0) {
    // the officers' pea whistles at zero hour: a shrill trill
    if (!this.ctx || !this.enabled) return;
    const d = p ? this._dist(p) : 5, C = this.ctx, t = C.currentTime + delay + d / 343, att = 0.18 / (1 + d / 40);
    for (let k = 0; k < 3; k++) {
      const o = C.createOscillator(), lfo = C.createOscillator(), lg = C.createGain(), g = C.createGain(), t0 = t + k * 0.55, dur = k === 2 ? 1.1 : 0.4;
      o.frequency.value = 2900; lfo.frequency.value = 28; lg.gain.value = 160; lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(att, t0 + 0.02); g.gain.setValueAtTime(att, t0 + dur - 0.05); g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g).connect(this.out); o.start(t0); lfo.start(t0); o.stop(t0 + dur); lfo.stop(t0 + dur);
    }
  }
  hurt() { if (!this.ctx || !this.enabled) return; this._burst(this.ctx.currentTime, 0.2, 300, 1, 0.4, 0.25, 'lowpass', this.brown); }
  _larks() {
    const C = this.ctx;
    const sing = () => {
      if (this.zero || !this.enabled) { setTimeout(sing, 4000); return; }
      const t = C.currentTime + 0.1, n = 10 + Math.random() * 20;
      for (let i = 0; i < n; i++) {
        const o = C.createOscillator(), g = C.createGain(), t0 = t + i * (0.06 + Math.random() * 0.06), f = 2600 + Math.random() * 2600;
        o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * (0.7 + Math.random() * 0.7), t0 + 0.05);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.012, t0 + 0.01); g.gain.linearRampToValueAtTime(0, t0 + 0.05);
        o.connect(g).connect(this.out); o.start(t0); o.stop(t0 + 0.06);
      }
      setTimeout(sing, 1500 + Math.random() * 4000);
    };
    setTimeout(sing, 1000);
  }
}

// ---- the sounds, sample by sample ----
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// a rifle's report as heard at the rifle (.303 or 7.92 mm: ~50 grains of cordite, far bigger than a .22's whisper):
// the blast wave itself (a Friedlander pulse, a millisecond of overpressure and its suction behind it), the deep thump of
// the gas cloud you feel in the chest, the roar of the gas venting, and the same again a few milliseconds late off the
// ground at your feet. Driven hard into a soft clip, as a real one overloads the ear.
export function report(sr, rnd, { mg = false } = {}) {
  const n = Math.floor(sr * 0.7), out = new Float32Array(n), r = () => rnd() * 2 - 1;
  const T = (mg ? 0.0008 : 0.0011) * (0.9 + rnd() * 0.2), bodyT = (mg ? 0.014 : 0.02) * (0.85 + rnd() * 0.3), f0 = (mg ? 68 : 58) * (0.92 + rnd() * 0.16);
  let l1 = 0, l2 = 0, h1 = 0, ph = 0, rb = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const blast = t < T * 4 ? (1 - t / T) * Math.exp(-2.2 * t / T) : 0;
    const w = r(); l1 += (w - l1) * 0.35; l2 += (l1 - l2) * 0.35; const hiss = w - h1; h1 = w;   // gas noise: a dark part and a bright part
    const env = (1 - Math.exp(-t / 0.0004)) * (Math.exp(-t / bodyT) + 0.22 * Math.exp(-t / (bodyT * 5)));
    const body = (l2 * 2.2 + hiss * 0.35 * Math.exp(-t / 0.004)) * env;
    ph += 2 * Math.PI * (f0 + 90 * Math.exp(-t / 0.018)) / sr;
    const thump = Math.sin(ph) * (1 - Math.exp(-t / 0.0015)) * Math.exp(-t / (mg ? 0.05 : 0.075));
    rb += (r() - rb) * 0.02; const rumble = rb * 6 * Math.exp(-t / 0.18) * (1 - Math.exp(-t / 0.01));   // the low roll that follows it
    out[i] = 1.25 * blast + 0.85 * body + 0.95 * thump + 0.35 * rumble;
  }
  const dl = Math.floor(sr * (0.0035 + rnd() * 0.002));   // off the ground
  for (let i = n - 1; i >= dl; i--) out[i] += out[i - dl] * 0.45;
  let pk = 0; for (let i = 0; i < n; i++) { out[i] = Math.tanh(out[i] * 1.8); pk = Math.max(pk, Math.abs(out[i])); }
  for (let i = 0; i < n; i++) out[i] *= 0.98 / pk;
  return out;
}
// the supersonic crack of a bullet passing: an N-wave a third of a millisecond long, bright and sharp, with a little ring
export function snap(sr, rnd) {
  const n = Math.floor(sr * 0.08), out = new Float32Array(n), L = 0.00035 * (0.8 + rnd() * 0.4) * sr;
  for (let i = 0; i < n; i++) {
    const t = i / sr, nw = i < L ? 1 - 2 * i / L : 0, w = rnd() * 2 - 1;
    out[i] = nw * 0.95 + w * 0.3 * Math.exp(-t / 0.006) * (i < L ? 0 : 1);
  }
  for (let i = n - 1; i > 2; i--) out[i] = 0.6 * out[i] + 0.4 * out[i - 1];
  return out;
}
// the echo of open, rolling ground: a diffuse tail darkening as it dies, and discrete returns off the slopes and the woods
// a quarter of a second to two seconds away, different in each ear
export function echoes(sr, rnd) {
  const n = Math.floor(sr * 3.2), ch = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const o = ch[c]; let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, k = 0.5 * Math.exp(-t / 0.35) + 0.015;                        // ever darker
      lp += ((rnd() * 2 - 1) - lp) * k;
      o[i] = lp * 0.11 * Math.exp(-t / 0.75) * (1 - Math.exp(-t / 0.03)) * (t < 0.012 ? 0 : 1) * (1.6 / Math.sqrt(k + 0.05));
    }
    for (let e = 0; e < 9; e++) {
      const t0 = 0.12 + rnd() * 1.9, a = 0.32 * Math.exp(-t0 / 1.1) * (0.5 + rnd()), L = Math.floor(sr * (0.04 + t0 * 0.05)), s = Math.floor(t0 * sr);
      let q = 0; for (let i = 0; i < L && s + i < n; i++) { q += ((rnd() * 2 - 1) - q) * (0.12 / (1 + t0)); o[s + i] += q * a * 3 * Math.exp(-i / (L * 0.3)); }
    }
  }
  // to a set loudness (energy 4: twice the amplitude of what goes in, spread over three seconds)
  for (const o of ch) { let e = 0; for (const v of o) e += v * v; const k = Math.sqrt(4 / e); for (let i = 0; i < n; i++) o[i] *= k; }
  return ch;
}
