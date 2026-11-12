// Vectorises the trench lines of "Ovillers & La Boisselle sector - 1 July 1916" (Wikimedia Commons,
// tools/terrain/ref/) into world-space polylines: red = British front line, blue = German trenches.
// Georeference: least-squares affine from 5 village control points matched on the IGN Plan map (residuals ~70 m).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path'; import { fileURLToPath } from 'node:url';
import { readPNG } from './pngread.mjs'; import { png } from './png.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const im = readPNG(join(here, 'ref/La_Boisselle_sector_1_July_1916.png')), W = im.w, H = 1305;  // below 1305 is the title strip
// hist px -> world metres (x east, z south from the map's NW corner, Lambert-93 675000 / 6994000)
const AX = [4.344513662693735, 0.22056333188064112, 1714.5095083544677], AZ = [0.009682198688093483, 3.839223269778926, -639.1389761179053];
const toWorld = (u, v) => [AX[0] * u + AX[1] * v + AX[2], AZ[0] * u + AZ[1] * v + AZ[2]];
// label / box exclusions (hist px rectangles, or rotated bands given as polygons)
const rects = [[10,320,75,370],[8,535,72,582],[108,1072,172,1120],[268,1248,330,1295],[175,340,210,368],[148,890,240,950],
  [520,110,590,165],[740,1008,805,1055],[0,250,130,275],[130,65,190,100],[735,55,830,130],[130,240,200,300],[770,262,870,285],
  [270,875,380,900],[310,488,390,512],[715,685,820,712],[800,712,900,738],[680,610,720,635],[680,770,730,800],[685,1060,740,1090],[680,1245,735,1275],
  [25,410,80,438],[0,905,30,930],[0,1135,35,1160],[60,1155,115,1250],[140,1255,220,1275],[235,1135,320,1225],[160,720,250,790],[515,0,575,25],[30,30,190,100]];
const polys = [[[5,800],[25,785],[230,990],[210,1005]], [[218,1010],[238,995],[340,1135],[320,1150]], [[0,1020],[10,1010],[100,1140],[85,1155]]];
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const excluded = (x, y) => rects.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) || polys.some(p => inPoly(x, y, p));
function mask(test) { const m = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 3; if (!excluded(x, y) && test(im.px[k], im.px[k + 1], im.px[k + 2])) m[y * W + x] = 1; } return m; }
const red = mask((r, g, b) => r > 190 && g < 60 && b < 70);
const blue = mask((r, g, b) => b > 160 && r < 110 && g < 110 && b - r > 80);
// drop small components (text glyphs), keep lines
function prune(m, minPx) { const seen = new Uint8Array(W * H), st = [];
  for (let s = 0; s < W * H; s++) if (m[s] && !seen[s]) { const comp = []; st.push(s); seen[s] = 1;
    while (st.length) { const p = st.pop(); comp.push(p); const x = p % W, y = (p / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (m[q] && !seen[q]) { seen[q] = 1; st.push(q); } } }
    if (comp.length < minPx) for (const p of comp) m[p] = 0; } }
prune(red, 400); prune(blue, 70);
// line width per pixel (chessboard distance transform), used to class thick (main line) vs thin (minor) trenches
function dist(m) { const d = new Float32Array(W * H).fill(0); for (let i = 0; i < W * H; i++) d[i] = m[i] ? 1e9 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!d[i]) continue; let v = d[i]; if (x) v = Math.min(v, d[i - 1] + 1); if (y) v = Math.min(v, d[i - W] + 1); if (x && y) v = Math.min(v, d[i - W - 1] + 1.4); if (y && x < W - 1) v = Math.min(v, d[i - W + 1] + 1.4); d[i] = v; }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!d[i]) continue; let v = d[i]; if (x < W - 1) v = Math.min(v, d[i + 1] + 1); if (y < H - 1) v = Math.min(v, d[i + W] + 1); if (x < W - 1 && y < H - 1) v = Math.min(v, d[i + W + 1] + 1.4); if (x && y < H - 1) v = Math.min(v, d[i + W - 1] + 1.4); d[i] = v; }
  return d; }
// Zhang-Suen thinning
function thin(m) { const a = m.slice(); let changed = true; const P = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : a[y * W + x];
  while (changed) { changed = false; for (const pass of [0, 1]) { const del = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { if (!a[y * W + x]) continue;
      const p = [P(x, y - 1), P(x + 1, y - 1), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1), P(x - 1, y + 1), P(x - 1, y), P(x - 1, y - 1)];
      const B = p.reduce((s, v) => s + v, 0); if (B < 2 || B > 6) continue; let A = 0; for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) A++; if (A !== 1) continue;
      if (pass === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue; del.push(y * W + x); }
    for (const i of del) a[i] = 0; if (del.length) changed = true; } }
  return a; }
// trace skeleton into polylines (split at junctions)
function trace(sk) { const nb = i => { const x = i % W, y = (i / W) | 0, r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && sk[ny * W + nx]) r.push(ny * W + nx); } return r; };
  const deg = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) if (sk[i]) deg[i] = nb(i).length;
  const used = new Set(), key = (a, b) => a < b ? a + ',' + b : b + ',' + a, lines = [];
  const walk = (s, n) => { const pts = [s, n]; used.add(key(s, n)); let prev = s, cur = n;
    while (deg[cur] === 2) { const nx = nb(cur).find(q => q !== prev && !used.has(key(cur, q))); if (nx === undefined) break; used.add(key(cur, nx)); pts.push(nx); prev = cur; cur = nx; }
    return pts; };
  for (let i = 0; i < W * H; i++) if (sk[i] && deg[i] !== 2) for (const n of nb(i)) if (!used.has(key(i, n))) lines.push(walk(i, n));
  for (let i = 0; i < W * H; i++) if (sk[i] && deg[i] === 2) for (const n of nb(i)) if (!used.has(key(i, n))) lines.push(walk(i, n));   // loops
  return lines; }
function dp(pts, eps) { if (pts.length < 3) return pts; let md = 0, mi = 0; const [a, b] = [pts[0], pts[pts.length - 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L; if (d > md) { md = d; mi = i; } }
  return md > eps ? [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)] : [a, b]; }
const out = [];
for (const [side, m] of [['BRI', red], ['GER', blue]]) {
  const d = dist(m), lines = trace(thin(m));
  for (const l of lines) { if (l.length < 6) continue;
    const w = l.reduce((s, i) => s + d[i], 0) / l.length;
    const pts = dp(l.map(i => [i % W, (i / W) | 0]), 1.2).map(([u, v]) => toWorld(u, v).map(c => Math.round(c * 10) / 10));
    out.push({ side, kind: side === 'BRI' || w >= 2.0 ? 'fire' : 'minor', w: +w.toFixed(2), pts }); } }
const len = l => l.pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - l.pts[i - 1][0], p[1] - l.pts[i - 1][1]) : 0, 0);
console.log('lines', out.length, 'BRI km', (out.filter(l => l.side === 'BRI').reduce((s, l) => s + len(l), 0) / 1000).toFixed(1), 'GER fire km', (out.filter(l => l.side === 'GER' && l.kind === 'fire').reduce((s, l) => s + len(l), 0) / 1000).toFixed(1), 'GER minor km', (out.filter(l => l.side === 'GER' && l.kind === 'minor').reduce((s, l) => s + len(l), 0) / 1000).toFixed(1));
writeFileSync(join(here, 'trenches_1916.json'), JSON.stringify({ source: 'Wikimedia Commons: La_Boisselle_sector_1_July_1916.png (vectorised)', affine: { AX, AZ }, lines: out }));
// debug image: world 6 km at 5 m/px
const S = 1200, img = new Uint8Array(S * S * 3).fill(235);
for (const l of out) for (let i = 1; i < l.pts.length; i++) { const [a, b] = [l.pts[i - 1], l.pts[i]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
  for (let k = 0; k <= n; k++) { const x = Math.round((a[0] + (b[0] - a[0]) * k / n) / 5), y = Math.round((a[1] + (b[1] - a[1]) * k / n) / 5); if (x < 0 || y < 0 || x >= S || y >= S) continue; const o = (y * S + x) * 3;
    if (l.side === 'BRI') { img[o] = 220; img[o + 1] = 0; img[o + 2] = 0; } else if (l.kind === 'fire') { img[o] = 0; img[o + 1] = 0; img[o + 2] = 200; } else { img[o] = 120; img[o + 1] = 120; img[o + 2] = 230; } } }
writeFileSync(process.argv[2] || join(here, '.cache/trenches_debug.png'), png(S, S, img));
