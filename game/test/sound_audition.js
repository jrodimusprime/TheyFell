// Renders the gunfire offline (OfflineAudioContext, the game's own Audio graph) to WAV files for listening:
// your own rifle, a rifle at 30, 150, 600 m, an MG 08 burst at 250 m, and near misses (snap, then the report).
const out = (await ev(`location.search`)).match(/out=([^&]+)/)?.[1] || 'review/sound-v1';
const scenes = {
  own_rifle: `A.listener={x:0,y:0,z:0,yaw:0}; for (let i=0;i<3;i++) A.shot([0,0,0],'smle',true), C.suspend; `,
};
const res = await ev(`(async () => {
  const { Audio } = await import('/js/audio.js');
  const SR = 48000, wav = (buf) => { const n = buf.length, ch = buf.numberOfChannels, b = new DataView(new ArrayBuffer(44 + n * ch * 2)); const w = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
    w(0,'RIFF'); b.setUint32(4,36+n*ch*2,true); w(8,'WAVE'); w(12,'fmt '); b.setUint32(16,16,true); b.setUint16(20,1,true); b.setUint16(22,ch,true); b.setUint32(24,SR,true); b.setUint32(28,SR*ch*2,true); b.setUint16(32,ch*2,true); b.setUint16(34,16,true); w(36,'data'); b.setUint32(40,n*ch*2,true);
    let pk = 0; for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) { b.setInt16(44 + (i * ch + c) * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true); pk = Math.max(pk, Math.abs(d[i])); } }
    let s = ''; const u = new Uint8Array(b.buffer); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); let e = 0; const d0 = buf.getChannelData(0); for (let i = 0; i < n; i++) e += d0[i] * d0[i]; return { b64: btoa(s), pk, rms: Math.sqrt(e / n), clip: [...d0].filter(v => Math.abs(v) > 0.99).length }; };
  const render = async (secs, fn, bed = 0) => { const C = new OfflineAudioContext(2, SR * secs, SR); const A = new Audio(); A.start(C); A.bed.gain.value = bed; A.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    const at = (t, f) => { const real = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'currentTime'); Object.defineProperty(C, 'currentTime', { value: t, configurable: true }); f(); delete C.currentTime; };
    fn(A, at); const b = await C.startRendering(); return wav(b); };
  const r = {};
  r.own_rifle = await render(6, (A, at) => { for (let i = 0; i < 3; i++) at(0.2 + i * 1.6, () => A.shot([0, 0, 0], 'smle', true)); });
  r.rifle_30m_left = await render(4, (A, at) => { at(0.1, () => A.shot([-30, 0, 0], 'g98', false)); at(1.6, () => A.shot([-28, 0, -8], 'g98', false)); });
  r.rifle_150m = await render(5, (A, at) => { at(0.0, () => A.shot([0, 0, -150], 'g98', false)); at(1.3, () => A.shot([20, 0, -150], 'g98', false)); });
  r.rifle_600m = await render(6, (A, at) => { for (let i = 0; i < 4; i++) at(i * 0.7, () => A.shot([100 + i * 30, 0, -600], 'g98', false)); });
  r.mg08_250m = await render(6, (A, at) => { for (let i = 0; i < 20; i++) at(i * 0.133, () => A.shot([60, 0, -240], 'mg08', false)); });
  r.near_miss_200m = await render(5, (A, at) => { for (let i = 0; i < 3; i++) at(0.1 + i * 1.4, () => { A.snap([0, 0, -200], 1.5); A.shot([0, 0, -200], 'g98', false); }); });
  r.battle_with_bed = await render(10, (A, at) => { let s = 1; const rn = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 60; i++) at(rn() * 9, () => A.shot([(rn() - 0.5) * 800, 0, -50 - rn() * 700], rn() < 0.25 ? 'mg08' : 'g98', false)); for (let i = 0; i < 4; i++) at(1 + i * 2.2, () => A.shot([0, 0, 0], 'smle', true)); }, 0.35);
  return r; })()`);
const { mkdirSync } = await import('node:fs');
for (const [k, v] of Object.entries(res)) { writeFileSync(`${out}/${k}.wav`, Buffer.from(v.b64, 'base64')); log(k, "peak", v.pk.toFixed(2), "rms", v.rms.toFixed(3), "clipped samples", v.clip); }
