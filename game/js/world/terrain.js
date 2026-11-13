// The battlefield ground, at true scale: 1 unit = 1 metre. World x = east, z = south, y = up (metres above sea level).
// height(x, z) = real IGN lidar terrain + bombardment craters + trench cuts (fire bays, traverses, parapet, parados).
// Pure data + maths, no three.js: the simulation (and a headless agent) uses the same ground as the renderer.
import { mulberry32 } from '../core/rng.js';

const TRENCH_CELL = 8, CRATER_CELL = 8;
const WALL = 0.06;    // the cut is near-vertical: revetted walls, not a slope

export async function loadTerrain(base = 'data/') {
  const [meta, buf, map] = await Promise.all([
    fetch(base + 'dem.json').then(r => r.json()),
    fetch(base + 'dem.bin').then(r => r.arrayBuffer()),
    fetch(base + 'map_laboisselle.json').then(r => r.json()),
  ]);
  return new Terrain(meta, new Uint16Array(buf), map);
}

export class Terrain {
  constructor(meta, q, map) {
    this.meta = meta; this.map = map; this.size = meta.size; this.res = meta.res; this.n = meta.n;
    const h = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) h[i] = meta.base + q[i] * meta.scale;
    // the lidar mosaic has faint scan-line striping: a light [1 2 1] blur takes it out without losing the shape of the ground
    const n = meta.n, b = new Float32Array(h.length);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i, u = j > 0 ? k - n : k, d = j < n - 1 ? k + n : k, l = i > 0 ? k - 1 : k, r = i < n - 1 ? k + 1 : k; b[k] = (4 * h[k] + 2 * (h[u] + h[d]) + h[l] + h[r]) / 10; }
    this.dem = b;
    this.minH = meta.min; this.maxH = meta.max;
    this.mineBlown = {};          // name -> true once detonated
    this._buildPreBlast();
    this._buildTrenches();
    this._buildCraters(1916);
    this._buildRoads();
  }

  // ---------- real terrain ----------
  demAt(x, z) {
    const r = this.res, n = this.n;
    let fx = x / r, fz = z / r;
    if (fx < 0) fx = 0; else if (fx > n - 1.001) fx = n - 1.001;
    if (fz < 0) fz = 0; else if (fz > n - 1.001) fz = n - 1.001;
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * n + i, d = this.dem;
    const a = d[k] + (d[k + 1] - d[k]) * tx, b = d[k + n] + (d[k + n + 1] - d[k + n]) * tx;
    return a + (b - a) * tz;
  }
  // Lochnagar exists in today's lidar: before 07:28 the ground there is restored to the pre-blast slope.
  _buildPreBlast() {
    this.pre = [];
    for (const m of this.map.mines) {
      if (!m.inDEM) continue;
      const R = m.craterR + 22, [cx, cz] = m.c, ring = [];
      for (let a = 0; a < 32; a++) { const t = a / 32 * Math.PI * 2; ring.push(this.demAt(cx + Math.cos(t) * R, cz + Math.sin(t) * R)); }
      this.pre.push({ name: m.name, cx, cz, R, ring });
    }
  }
  _preBlast(x, z, h) {
    for (const p of this.pre) {
      if (this.mineBlown[p.name]) continue;
      const dx = x - p.cx, dz = z - p.cz, d2 = dx * dx + dz * dz;
      if (d2 >= p.R * p.R) continue;
      const d = Math.sqrt(d2), t = (Math.atan2(dz, dx) / (Math.PI * 2) + 1) % 1 * 32, i = t | 0, f = t - i;
      const edge = p.ring[i] * (1 - f) + p.ring[(i + 1) % 32] * f;
      // smooth cap interpolated from the ring, blended in near the ring so there is no seam
      let mean = 0; for (const v of p.ring) mean += v; mean /= 32;
      const u = d / p.R, cap = mean + (edge - mean) * u * u, w = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
      return cap * w + h * (1 - w);
    }
    return h;
  }

  // ---------- trenches ----------
  _buildTrenches() {
    const segs = [];   // flat: ax az bx bz hw depth enemyNx enemyNz kind side
    const enemy = side => side === 'BRI' ? [0.95, -0.3] : [-0.95, 0.3];
    for (const t of this.map.trenches) {
      let pts = t.pts;
      const kind = t.kind === 'fire' ? 0 : t.kind === 'comm' ? 1 : 2;
      if (kind === 0) pts = crenellate(pts, enemy(t.side));
      else if (kind === 1) pts = zigzag(pts, 6, 2.2);
      // fire trench: 1.5 m floor whose enemy-side 0.5 m is the fire-step (0.9 m up: a man standing on it has his head and
      // shoulders over the parapet's sandbags, crouched he is under cover); ~1.65 m deep + 0.5 m parapet = a 2.15 m wall
      const hw = kind === 0 ? 0.75 : 0.5, depth = kind === 0 ? 1.65 : kind === 1 ? 1.8 : 1.75;
      const [ex, ez] = enemy(t.side);
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
        if (Math.hypot(bx - ax, bz - az) < 0.05) continue;
        // which side of this segment faces the enemy: parapet there, parados behind
        let nx = -(bz - az), nz = bx - ax; const L = Math.hypot(nx, nz); nx /= L; nz /= L;
        if (nx * ex + nz * ez < 0) { nx = -nx; nz = -nz; }
        segs.push({ ax, az, bx, bz, hw, depth, nx, nz, kind, side: t.side, len: Math.hypot(bx - ax, bz - az) });
      }
    }
    this.segs = segs;
    // spatial hash: each cell lists every segment whose influence (hw + 4.2 m of parapet) touches it
    const N = Math.ceil(this.size / TRENCH_CELL), cells = new Map(), R = 5.3;
    segs.forEach((s, idx) => {
      const x0 = Math.floor((Math.min(s.ax, s.bx) - R) / TRENCH_CELL), x1 = Math.floor((Math.max(s.ax, s.bx) + R) / TRENCH_CELL);
      const z0 = Math.floor((Math.min(s.az, s.bz) - R) / TRENCH_CELL), z1 = Math.floor((Math.max(s.az, s.bz) + R) / TRENCH_CELL);
      for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cz < 0 || cx >= N || cz >= N) continue;
        // keep only cells the segment really passes near
        const mx = (cx + 0.5) * TRENCH_CELL, mz = (cz + 0.5) * TRENCH_CELL;
        if (segDist(mx, mz, s) > TRENCH_CELL * 0.71 + R) continue;
        const k = cz * N + cx; let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(idx);
      }
    });
    this.tN = N; this.tCells = cells;
    // a 2 m map of where any trench (with its parapet and parados) reaches: everywhere else skips the trench search
    const M = Math.ceil(this.size / 2), near = new Uint8Array(M * M), reach = 5.0;
    for (const sg of segs) {
      const x0 = Math.max(0, Math.floor((Math.min(sg.ax, sg.bx) - sg.hw - reach) / 2)), x1 = Math.min(M - 1, Math.floor((Math.max(sg.ax, sg.bx) + sg.hw + reach) / 2));
      const z0 = Math.max(0, Math.floor((Math.min(sg.az, sg.bz) - sg.hw - reach) / 2)), z1 = Math.min(M - 1, Math.floor((Math.max(sg.az, sg.bz) + sg.hw + reach) / 2));
      for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) if (segDist(i * 2 + 1, j * 2 + 1, sg) < sg.hw + reach + 1.5) near[j * M + i] = 1;
    }
    this.nearM = M; this.near = near;
  }
  // trench carve (negative = below surface) and spoil banks (positive) at a point; also reports the trench under it
  // pad > 0 widens and deepens the cut (the renderer uses it so the ground mesh stays behind the revetment walls)
  trenchAt(x, z, out, pad = 0) {
    out.carve = 0; out.bank = 0; out.seg = -1; out.d = 99; out.depth = 0; out.step = false;
    const ni = Math.floor(x / 2), nj = Math.floor(z / 2);
    if (ni < 0 || nj < 0 || ni >= this.nearM || nj >= this.nearM || !this.near[nj * this.nearM + ni]) return out;   // nowhere near a trench
    const l = this.tCells.get(Math.floor(z / TRENCH_CELL) * this.tN + Math.floor(x / TRENCH_CELL));
    if (!l) return out;
    for (const idx of l) {
      const s = this.segs[idx]; if (s.gone) continue;   // blown away by a mine
      const hw = s.hw + pad, depth = s.depth + (pad ? 0.2 : 0);
      // each piece of trench is a rectangle with square ends, run on past its joint by its half-width, so corners are square
      // (as dug and revetted), not rounded: d is the box distance, |offset| inside the length, growing past the ends
      const vx = s.bx - s.ax, vz = s.bz - s.az, L = s.len, wx = x - s.ax, wz = z - s.az, t = (wx * vx + wz * vz) / L, off = Math.abs(wx * s.nx + wz * s.nz);
      const over = Math.max(0, -t - s.hw, t - L - s.hw), d = over > 0 ? Math.max(off, hw + over) : off;
      if (d > hw + 4.2) continue;
      if (d < out.d) { out.d = d; out.seg = idx; }
      const wall = WALL;
      if (d < hw) {
        let c = -depth;
        if (!pad && s.kind === 0 && d > s.hw - 0.5 && (x - s.ax) * s.nx + (z - s.az) * s.nz > 0) { c += 0.9; out.step = true; }   // the fire-step
        if (c < out.carve) { out.carve = c; out.depth = s.depth; }
      }
      else if (d < hw + wall) { const t = (d - hw) / wall, c = -depth * (1 - t); if (c < out.carve) { out.carve = c; out.depth = s.depth; } }
      else {
        // which side: parapet (enemy side, higher, wider) or parados
        const px = x - s.ax, pz = z - s.az, side = px * s.nx + pz * s.nz;
        const e = d - s.hw - WALL, H = s.kind === 2 ? 0.3 : side > 0 ? 0.42 : 0.35, Wd = side > 0 ? 3.2 : 2.4;
        if (e > 0 && e < Wd) { const t = e / Wd, b = H * (t < 0.25 ? 1 : 1 - (t - 0.25) / 0.75) ** 1.5; if (b > out.bank) out.bank = b; }
        else if (e <= 0 && H > out.bank) out.bank = H;
      }
    }
    return out;
  }
  // a mine goes up: the real crater replaces the ground, and every trench within the blast is gone with it
  blowMine(name) {
    if (this.mineBlown[name]) return null;
    this.mineBlown[name] = true;
    const m = this.map.mines.find(q => q.name === name); if (!m) return null;
    const R = m.craterR + 12;
    for (const s of this.segs) if (segDist(m.c[0], m.c[1], s) < R) s.gone = true;
    return { x: m.c[0], z: m.c[1], r: R };
  }
  // is this point open trench (floor or fire-step), as opposed to solid ground?
  isTrench(x, z) { return this.trenchAt(x, z, this._t3 || (this._t3 = {})).carve < -0.85; }

  // ---------- bombardment craters: the week-long preliminary bombardment, heaviest on the German lines ----------
  _buildCraters(seed) {
    const rng = mulberry32(seed), list = [];
    const germanFront = this.map.trenches.find(t => t.side === 'GER' && t.kind === 'fire').pts;
    const britFront = this.map.trenches.find(t => t.side === 'BRI' && t.kind === 'fire').pts;
    const dTo = (pts, x, z) => { let b = 1e9; for (let i = 1; i < pts.length; i++) b = Math.min(b, segDist(x, z, { ax: pts[i - 1][0], az: pts[i - 1][1], bx: pts[i][0], bz: pts[i][1] })); return b; };
    // density: very high in no man's land and the German front system, falling off behind the German lines, low behind the British
    for (let tries = 0; tries < 420000 && list.length < 85000; tries++) {
      const x = rng() * this.size, z = rng() * this.size;
      const dg = dTo(germanFront, x, z), db = dTo(britFront, x, z);
      const behindGer = x > 0 ? dg : 0;
      let p = 0.012;
      if (dg < 120) p = 0.9; else if (db < 60) p = 0.35; else if (dg < db && dg < 900) p = 0.55 * Math.exp(-dg / 500) + 0.1;
      else if (db < dg && dg < 900) p = 0.5;   // no man's land between the lines
      else if (dg < db) p = 0.12; else p = 0.03;
      if (rng() > p) continue;
      const big = rng() < 0.08, r = big ? rng.range(3.5, 6.5) : rng.range(1.2, 3.2);
      list.push({ x, z, r, d: r * rng.range(0.28, 0.42), age: rng() });
    }
    for (const m of this.map.mines) if (!m.inDEM) list.push({ x: m.c[0], z: m.c[1], r: m.craterR, d: m.depth, mine: m.name });
    this.craters = list;
    const N = Math.ceil(this.size / CRATER_CELL), cells = new Map();
    list.forEach((c, idx) => {
      const R = c.r * 1.6;
      for (let cz = Math.floor((c.z - R) / CRATER_CELL); cz <= Math.floor((c.z + R) / CRATER_CELL); cz++)
        for (let cx = Math.floor((c.x - R) / CRATER_CELL); cx <= Math.floor((c.x + R) / CRATER_CELL); cx++) {
          if (cx < 0 || cz < 0 || cx >= N || cz >= N) continue;
          const k = cz * N + cx; let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(idx);
        }
    });
    this.cN = N; this.cCells = cells;
  }
  craterAt(x, z) {
    const l = this.cCells.get(Math.floor(z / CRATER_CELL) * this.cN + Math.floor(x / CRATER_CELL));
    if (!l) return 0;
    let h = 0;
    for (const idx of l) {
      const c = this.craters[idx];
      if (c.mine && !this.mineBlown[c.mine]) continue;
      const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz, R = c.r * 1.6;
      if (d2 > R * R) continue;
      const u = Math.sqrt(d2) / c.r;
      // bowl inside r, raised lip of ejecta out to 1.6 r
      h += u < 1 ? -c.d * (1 - u * u) + c.d * 0.18 * u * u : c.d * 0.18 * (1 - (u - 1) / 0.6) ** 2;
    }
    return h;
  }
  addCrater(x, z, r, d) {   // a new shell hole during play (sim-side, deterministic)
    const c = { x, z, r, d, age: 0 }, idx = this.craters.push(c) - 1, R = r * 1.6;
    for (let cz = Math.floor((z - R) / CRATER_CELL); cz <= Math.floor((z + R) / CRATER_CELL); cz++)
      for (let cx = Math.floor((x - R) / CRATER_CELL); cx <= Math.floor((x + R) / CRATER_CELL); cx++) {
        if (cx < 0 || cz < 0 || cx >= this.cN || cz >= this.cN) continue;
        const k = cz * this.cN + cx; let l = this.cCells.get(k); if (!l) this.cCells.set(k, l = []); l.push(idx);
      }
    return c;
  }

  _buildRoads() {
    this.roadSegs = [];
    for (const r of this.map.roads) for (let i = 1; i < r.pts.length; i++)
      this.roadSegs.push({ ax: r.pts[i - 1][0], az: r.pts[i - 1][1], bx: r.pts[i][0], bz: r.pts[i][1], w: r.w });
  }

  // ---------- the one height function everything uses ----------
  height(x, z) {
    const tmp = this._tmp || (this._tmp = {});
    let h = this._preBlast(x, z, this.demAt(x, z)) + this.craterAt(x, z);
    this.trenchAt(x, z, tmp);
    return h + (tmp.carve < -0.01 ? tmp.carve : tmp.bank);
  }
  // ground height used for movement: the same, but a trench floor reads as its duckboards
  normal(x, z, e = 0.5) {
    const hx = this.height(x + e, z) - this.height(x - e, z), hz = this.height(x, z + e) - this.height(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l];
  }
  inTrench(x, z) { const t = this.trenchAt(x, z, this._tmp2 || (this._tmp2 = {})); return t.carve < -0.5 ? this.segs[t.seg] : null; }   // (the floor, or the fire-step 0.75 m down)
  // line of sight over the ground (bullets, AI eyes). Returns the hit distance or -1 if clear.
  // trenches and shell holes matter for sight and fire only near either end (a man in a trench, a lip in front of him);
  // in between the line is traced over the plain ground, which is several times cheaper
  raycast(ox, oy, oz, dx, dy, dz, maxD) {
    let t = 0.3, step = 0.6;
    while (t < maxD) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (x < 0 || z < 0 || x > this.size || z > this.size) return -1;
      const g = t < 30 || maxD - t < 30 ? this.height(x, z) : this._preBlast(x, z, this.demAt(x, z));
      if (y < g) {   // refine
        let a = t - step, b = t;
        for (let i = 0; i < 5; i++) { const m = (a + b) / 2; if (oy + dy * m < this.height(ox + dx * m, oz + dz * m)) b = m; else a = m; }
        return b;
      }
      t += step; step = t < 30 || maxD - t < 30 ? Math.min(1.5, 0.6 + t * 0.012) : Math.min(5, 1 + t * 0.02);
    }
    return -1;
  }
}

export function segDist(x, z, s) {
  const vx = s.bx - s.ax, vz = s.bz - s.az, wx = x - s.ax, wz = z - s.az;
  let t = (wx * vx + wz * vz) / (vx * vx + vz * vz); t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = wx - vx * t, dz = wz - vz * t; return Math.sqrt(dx * dx + dz * dz);
}

// Fire trench: straight fire bays separated by traverses. The trench steps back behind each traverse block
// (README §2: "crenellated" front line), so a shell or a raider in one bay commands only that bay.
export function crenellate(pts, [ex, ez], bay = 8.5, trav = 3.2, back = 2.6) {
  const out = []; let carry = 0, inBay = true;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L; let nx = -uz, nz = ux; if (nx * ex + nz * ez > 0) { nx = -nx; nz = -nz; }   // n points to the rear
    let s = 0;
    while (s < L) {
      const seg = (inBay ? bay : trav) - carry, e = Math.min(L, s + seg), o = inBay ? 0 : back;
      out.push([ax + ux * s + nx * o, az + uz * s + nz * o], [ax + ux * e + nx * o, az + uz * e + nz * o]);
      if (s + seg <= L) { inBay = !inBay; carry = 0; } else carry = L - s;
      s = e;
    }
  }
  return out;
}
// Communication trench: a zig-zag so no single shell or machine gun can rake its length
export function zigzag(pts, leg = 6, amp = 2.2) {
  const out = []; let k = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
    for (let s = 0; s < L; s += leg, k++) { const o = (k % 2 ? 1 : -1) * amp * (s > 0 && s + leg < L ? 1 : 0); out.push([ax + ux * s + nx * o, az + uz * s + nz * o]); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
