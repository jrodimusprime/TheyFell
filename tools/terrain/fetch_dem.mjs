// Fetches the real terrain (IGN RGE ALTI, lidar-derived bare-earth DTM, 1 m source) for the
// La Boisselle map and writes game/data/dem.bin + dem.json.
// World frame: origin = Lambert-93 (X0, Y0) = SW corner; world x = east (m), world z = south (m).
// Usage: node tools/terrain/fetch_dem.mjs
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../game/data');
const X0 = 675000, Y0 = 6988000, SIZE = 6000, RES = 2.5;     // 6 km x 6 km at 2.5 m
const N = SIZE / RES + 1;                                      // 2401 samples a side (grid points on the 2.5 m lattice)
const TILE = 1200;                                             // samples per tile step
const cache = join(here, '.cache'); mkdirSync(cache, { recursive: true });
const grid = new Float32Array(N * N);
for (let ty = 0; ty * TILE < N - 1; ty++) for (let tx = 0; tx * TILE < N - 1; tx++) {
  const i0 = tx * TILE, j0 = ty * TILE, w = Math.min(TILE, N - 1 - i0) + 1, h = Math.min(TILE, N - 1 - j0) + 1;
  // row j counts from the NORTH edge (image rows), so lattice row j sits at y = Y0 + SIZE - j*RES
  const minx = X0 + i0 * RES - RES / 2, maxx = minx + w * RES;
  const maxy = Y0 + SIZE - j0 * RES + RES / 2, miny = maxy - h * RES;
  const f = join(cache, `t_${tx}_${ty}.bil`);
  if (!existsSync(f)) {
    const url = `https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES&STYLES=&CRS=EPSG:2154&BBOX=${minx},${miny},${maxx},${maxy}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/x-bil;bits=32`;
    const r = await fetch(url); if (!r.ok) throw new Error(`tile ${tx},${ty}: HTTP ${r.status}`);
    const b = Buffer.from(await r.arrayBuffer()); if (b.length !== w * h * 4) throw new Error(`tile ${tx},${ty}: got ${b.length} bytes, want ${w * h * 4}: ${b.slice(0, 200)}`);
    writeFileSync(f, b); console.log('fetched', f);
  }
  const b = readFileSync(f), t = new Float32Array(b.buffer, b.byteOffset, w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) grid[(j0 + j) * N + i0 + i] = t[j * w + i];
}
let mn = Infinity, mx = -Infinity, bad = 0;
for (const v of grid) { if (!(v > -100 && v < 1000)) { bad++; continue; } mn = Math.min(mn, v); mx = Math.max(mx, v); }
if (bad) throw new Error(bad + ' nodata samples');
const base = Math.floor(mn) - 1, q = new Uint16Array(N * N);
for (let k = 0; k < grid.length; k++) q[k] = Math.round((grid[k] - base) * 100);   // centimetres above `base`
writeFileSync(join(out, 'dem.bin'), Buffer.from(q.buffer));
writeFileSync(join(out, 'dem.json'), JSON.stringify({
  source: 'IGN RGE ALTI (ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES) via data.geopf.fr WMS-R, Licence Ouverte Etalab 2.0',
  crs: 'EPSG:2154', originL93: [X0, Y0 + SIZE], note: 'row 0 = north edge; world x = east, world z = south; z = 0 at the north edge',
  size: SIZE, res: RES, n: N, base, scale: 0.01, min: mn, max: mx }, null, 1));
console.log({ N, min: mn, max: mx, base, bytes: q.byteLength });
