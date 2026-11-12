// Synthesised sound (WebAudio), like Cimmerian's: no audio files. Sound travels at 343 m/s, so a distant burst
// is seen before it is heard, and distance muffles it. A constant drumfire bed sits under everything; larks sang over
// the Somme on the morning of 1 July 1916 (no birdsong: removed at the player's request).
export class Audio {
  constructor() { this.ctx = null; this.enabled = true; this.listener = { x: 0, y: 0, z: 0 }; this.zero = false; }
  start() {
    if (this.ctx) return;
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0.7; this.master.connect(C.destination);
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.connect(this.master); this.out = comp;
    const len = C.sampleRate * 2; this.noise = C.createBuffer(1, len, C.sampleRate); const d = this.noise.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = C.createBuffer(1, len, C.sampleRate); const e = this.brown.getChannelData(0); for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; e[i] = b * 3.5; }
    // drumfire bed
    const src = C.createBufferSource(); src.buffer = this.brown; src.loop = true; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    this.bed = C.createGain(); this.bed.gain.value = 0.35; src.connect(lp).connect(this.bed).connect(this.out); src.start();
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
    const d = isPlayer ? 0 : this._dist(p); if (d > 2500) return;
    const C = this.ctx, when = C.currentTime + d / 343, att = 1 / (1 + d / 40), muff = Math.max(400, 9000 / (1 + d / 60));
    const mg = weapon === 'mg08';
    this._burst(when, 0.25, muff, 0.7, (mg ? 0.5 : 0.75) * att * (isPlayer ? 1.3 : 1), isPlayer ? 0.35 : 0.22 + d / 2000);
    this._burst(when + 0.004, 0.6, 220, 0.8, 0.5 * att, 0.5 + d / 900, 'lowpass', this.brown);   // the crack's tail rolling over the ground
    if (d > 60 && d < 400) this._burst(when + 0.02, 0.4, 2500, 0.5, 0.05 * att, 0.25, 'bandpass');
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
