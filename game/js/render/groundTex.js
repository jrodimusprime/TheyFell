// Ground textures generated at load (no image files): summer grass, churned shell-torn earth, and Somme chalk.
// Each is a 512 px tile (~2.2 m of ground) with a matching normal map, drawn wrap-around so it tiles seamlessly.
// The terrain shader samples them at two scales and rotations so the repeat never shows.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

const N = 512;
function canvas() { const c = document.createElement('canvas'); c.width = c.height = N; return c; }
// draw a shape at every wrap offset so the tile is seamless
export function wrap(fn) { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) fn(ox, oy); }
export function noiseLayer(g, r, scale, alpha, colors) {
  // soft blotches: many large faint discs
  const n = Math.round(N * N / (scale * scale) * 3);
  for (let i = 0; i < n; i++) {
    const x = r() * N, y = r() * N, rad = scale * (0.4 + r()), c = colors[Math.floor(r() * colors.length)];
    wrap((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gr.addColorStop(0, `rgba(${c},${alpha})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, rad, 0, 7); g.fill(); });
  }
}
export function grass(r) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = '#4c5a2a'; g.fillRect(0, 0, N, N);
  noiseLayer(g, r, 90, 0.35, ['62,74,34', '92,96,48', '58,64,30', '104,100,58']);
  // soil showing through at the roots
  for (let i = 0; i < 900; i++) { const x = r() * N, y = r() * N, s = 2 + r() * 5; wrap((ox, oy) => { g.fillStyle = `rgba(${70 + r() * 20},${58 + r() * 15},${40},0.5)`; g.fillRect(x + ox, y + oy, s, s * 0.7); }); }
  // blades: thousands of short strokes, light and dark, leaning with the wind
  for (let i = 0; i < 26000; i++) {
    const x = r() * N, y = r() * N, len = 5 + r() * 14, a = -Math.PI / 2 + (r() - 0.5) * 0.9 + 0.25, w = 0.8 + r() * 1.4;
    const t = r(), col = t < 0.15 ? `rgba(150,148,82,0.9)` : t < 0.55 ? `rgba(${70 + r() * 30},${92 + r() * 30},${36 + r() * 16},0.85)` : `rgba(${38 + r() * 20},${52 + r() * 18},${22 + r() * 10},0.85)`;
    wrap((ox, oy) => { if (x + ox < -20 || x + ox > N + 20 || y + oy < -20 || y + oy > N + 20) return; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke(); });
  }
  return c;
}
export function earth(r) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = '#5a4a38'; g.fillRect(0, 0, N, N);
  noiseLayer(g, r, 70, 0.45, ['70,56,42', '96,82,64', '48,40,32', '120,108,88']);
  // clods: lumps with a lit top edge and a shadowed bottom
  for (let i = 0; i < 2200; i++) {
    const x = r() * N, y = r() * N, s = 3 + r() * 14, sh = 0.55 + r() * 0.5, base = 60 + r() * 50;
    wrap((ox, oy) => { if (x + ox < -30 || x + ox > N + 30 || y + oy < -30 || y + oy > N + 30) return;
      g.fillStyle = `rgba(20,16,12,0.35)`; g.beginPath(); g.ellipse(x + ox + 1.5, y + oy + 2, s, s * sh, 0, 0, 7); g.fill();
      g.fillStyle = `rgb(${base + 12},${base},${base * 0.78})`; g.beginPath(); g.ellipse(x + ox, y + oy, s, s * sh, 0, 0, 7); g.fill();
      g.fillStyle = `rgba(255,240,220,0.12)`; g.beginPath(); g.ellipse(x + ox - s * 0.2, y + oy - s * sh * 0.3, s * 0.6, s * sh * 0.4, 0, 0, 7); g.fill(); });
  }
  // chalk flecks thrown up by the shells, and small flints
  for (let i = 0; i < 1500; i++) { const x = r() * N, y = r() * N, s = 1 + r() * 4, chalk = r() < 0.75; wrap((ox, oy) => { g.fillStyle = chalk ? `rgba(220,214,196,${0.5 + r() * 0.4})` : `rgba(40,38,40,0.8)`; g.beginPath(); g.arc(x + ox, y + oy, s, 0, 7); g.fill(); }); }
  // a few wet, darker hollows
  noiseLayer(g, r, 40, 0.25, ['32,26,20']);
  return c;
}
export function chalk(r) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = '#c4beab'; g.fillRect(0, 0, N, N);
  noiseLayer(g, r, 80, 0.4, ['214,208,190', '176,168,148', '196,186,160', '150,140,118']);
  // broken chalk lumps
  for (let i = 0; i < 1600; i++) {
    const x = r() * N, y = r() * N, s = 3 + r() * 11, v = 180 + r() * 50, k = 4 + Math.floor(r() * 4), rot = r() * 6;
    wrap((ox, oy) => { if (x + ox < -30 || x + ox > N + 30 || y + oy < -30 || y + oy > N + 30) return;
      g.fillStyle = 'rgba(70,64,54,0.3)'; g.beginPath(); for (let j = 0; j <= k; j++) { const a = rot + j / k * 6.283, rr = s * (0.7 + 0.3 * Math.sin(j * 2.3 + x)); g.lineTo(x + ox + 1.5 + Math.cos(a) * rr, y + oy + 2 + Math.sin(a) * rr); } g.fill();
      g.fillStyle = `rgb(${v},${v - 6},${v - 20})`; g.beginPath(); for (let j = 0; j <= k; j++) { const a = rot + j / k * 6.283, rr = s * (0.7 + 0.3 * Math.sin(j * 2.3 + x)); g.lineTo(x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr); } g.fill(); });
  }
  // flint nodules and mud smears
  for (let i = 0; i < 260; i++) { const x = r() * N, y = r() * N, s = 2 + r() * 6; wrap((ox, oy) => { g.fillStyle = `rgba(52,50,54,0.85)`; g.beginPath(); g.ellipse(x + ox, y + oy, s, s * 0.7, r() * 3, 0, 7); g.fill(); }); }
  noiseLayer(g, r, 50, 0.22, ['110,92,70']);
  return c;
}
// normal map from the picture's brightness (lumps are lit from above-left, so brightness ~ height)
export function normalMap(src, strength) {
  const d = src.getContext('2d').getImageData(0, 0, N, N).data, h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) h[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const out = new Uint8Array(N * N * 4), H = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), k = (y * N + x) * 4;
    out[k] = (-dx / l * 0.5 + 0.5) * 255; out[k + 1] = (-dy / l * 0.5 + 0.5) * 255; out[k + 2] = (1 / l * 0.5 + 0.5) * 255; out[k + 3] = 255;
  }
  return out;
}
export function makeGroundTextures(renderer) {
  const r = mulberry32(1916);
  const srcs = [grass(r), earth(r), chalk(r)];
  // pack the three tiles into array-like strips: one 512x1536 atlas (rows: grass, earth, chalk) for colour and one for normals
  const atlas = document.createElement('canvas'); atlas.width = N; atlas.height = N * 3;
  const ag = atlas.getContext('2d'); srcs.forEach((c, i) => ag.drawImage(c, 0, i * N));
  const nrm = new Uint8Array(N * N * 3 * 4); [6, 9, 7].forEach((s, i) => nrm.set(normalMap(srcs[i], s), i * N * N * 4));
  const color = new THREE.CanvasTexture(atlas); color.colorSpace = THREE.SRGBColorSpace; color.flipY = false;   // rows top to bottom, like the normal-map data
  const normal = new THREE.DataTexture(nrm, N, N * 3, THREE.RGBAFormat); normal.needsUpdate = true;
  for (const t of [color, normal]) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
  return { color, normal };
}
