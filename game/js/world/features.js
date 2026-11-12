// Deterministic battlefield features shared by the simulation (collision, slowing) and the renderer:
// barbed-wire belts in front of every fire trench, ruined village houses (walls you can't walk through), shattered woods.
import { mulberry32 } from '../core/rng.js';
import { segDist } from './terrain.js';

const CELL = 16;
class SegHash {
  constructor(size, pad) { this.N = Math.ceil(size / CELL); this.cells = new Map(); this.items = []; this.pad = pad; }
  add(s) {
    const i = this.items.push(s) - 1, p = this.pad + (s.r || 0);
    for (let cz = Math.floor((Math.min(s.az, s.bz) - p) / CELL); cz <= Math.floor((Math.max(s.az, s.bz) + p) / CELL); cz++)
      for (let cx = Math.floor((Math.min(s.ax, s.bx) - p) / CELL); cx <= Math.floor((Math.max(s.ax, s.bx) + p) / CELL); cx++) {
        if (cx < 0 || cz < 0 || cx >= this.N || cz >= this.N) continue;
        const k = cz * this.N + cx; let l = this.cells.get(k); if (!l) this.cells.set(k, l = []); l.push(i);
      }
  }
  near(x, z) { return this.cells.get(Math.floor(z / CELL) * this.N + Math.floor(x / CELL)); }
}

export class Features {
  constructor(T, seed = 7) {
    this.T = T; const rng = mulberry32(seed);
    // ---- wire: German belts thick and deep (often uncut on 1 July), British thinner; gaps where the bombardment cut them
    this.wire = new SegHash(T.size, 0);
    for (const t of T.map.trenches) {
      if (t.kind !== 'fire') continue;
      const ger = t.side === 'GER', [ex, ez] = ger ? [-0.95, 0.3] : [0.95, -0.3];
      const pts = t.pts, depth = ger ? 9 : 5, off = ger ? 28 : 20;
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
        let nx = -(bz - az) / L, nz = (bx - ax) / L; if (nx * ex + nz * ez < 0) { nx = -nx; nz = -nz; }
        for (let s = 0; s < L; s += 12) {
          if (rng() < (ger ? 0.22 : 0.35)) continue;          // a gap
          const e = Math.min(L, s + 12), o = off + rng.range(-3, 3);
          this.wire.add({ ax: ax + (bx - ax) * s / L + nx * o, az: az + (bz - az) * s / L + nz * o, bx: ax + (bx - ax) * e / L + nx * o, bz: az + (bz - az) * e / L + nz * o, r: depth / 2, side: t.side, kind: rng() < 0.6 ? 'apron' : 'entangle' });
        }
      }
    }
    // ---- ruined villages: houses along the village streets, knocked down by the bombardment
    this.walls = new SegHash(T.size, 0.6);
    this.houses = [];
    for (const v of T.map.villages) {
      const n = Math.round(v.r * v.r / 900);
      for (let k = 0, tries = 0; k < n && tries < n * 20; tries++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * v.r, x = v.c[0] + Math.cos(a) * d, z = v.c[1] + Math.sin(a) * d;
        if (T.inTrench(x, z)) continue;
        const w = rng.range(5.5, 9), l = rng.range(7, 12), rot = (rng() < 0.5 ? 0 : Math.PI / 2) + rng.range(-0.15, 0.15) + 0.65;
        if (this.houses.some(h => Math.hypot(h.x - x, h.z - z) < (h.l + l) * 0.55)) continue;
        const ruin = Math.min(1, v.ruin * rng.range(0.6, 1.3)), H = rng.range(4.5, 6.5);
        const house = { x, z, w, l, rot, ruin, H, y: T.height(x, z), walls: [] };
        const c = Math.cos(rot), s = Math.sin(rot), corner = (u, vv) => [x + u * c - vv * s, z + u * s + vv * c];
        const corners = [corner(-w / 2, -l / 2), corner(w / 2, -l / 2), corner(w / 2, l / 2), corner(-w / 2, l / 2)];
        for (let e = 0; e < 4; e++) {
          const [ax, az] = corners[e], [bx, bz] = corners[(e + 1) % 4];
          // each wall broken into pieces of varying remaining height
          const pieces = 3;
          for (let p = 0; p < pieces; p++) {
            const h = Math.max(0, H * (1 - ruin * rng.range(0.5, 1.15)));
            if (h < 0.3) continue;
            const t0 = p / pieces, t1 = (p + 1) / pieces;
            const wall = { ax: ax + (bx - ax) * t0, az: az + (bz - az) * t0, bx: ax + (bx - ax) * t1, bz: az + (bz - az) * t1, h, y: house.y, r: 0.3 };
            house.walls.push(wall); if (h > 1.0) this.walls.add(wall);
          }
        }
        this.houses.push(house); k++;
      }
    }
    // ---- woods: trunk positions, shattered by shellfire to a degree
    this.trees = [];
    for (const w of T.map.woods) {
      const n = Math.round(w.r * w.r * 0.012 * w.density);
      for (let k = 0; k < n; k++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * w.r, x = w.c[0] + Math.cos(a) * d, z = w.c[1] + Math.sin(a) * d;
        if (T.inTrench(x, z)) continue;
        const shattered = rng() < w.shattered;
        this.trees.push({ x, z, y: T.height(x, z), h: shattered ? rng.range(2, 7) : rng.range(12, 20), r: rng.range(0.15, 0.3), shattered, lean: shattered ? rng.range(-0.25, 0.25) : rng.range(-0.04, 0.04), rot: rng() * 6.28 });
      }
    }
    // a few lone trees and hedgerow stumps along the roads
    for (const r of T.roadSegs) { const L = Math.hypot(r.bx - r.ax, r.bz - r.az); for (let s = 0; s < L; s += 60) if (rng() < 0.3) { const x = r.ax + (r.bx - r.ax) * s / L + 6, z = r.az + (r.bz - r.az) * s / L; this.trees.push({ x, z, y: T.height(x, z), h: rng.range(3, 9), r: 0.25, shattered: true, lean: rng.range(-0.2, 0.2), rot: rng() * 6.28 }); } }
  }
  // how badly wire holds you here: 0 = clear, 1 = in the thick of a belt
  wireAt(x, z) {
    const l = this.wire.near(x, z); if (!l) return 0; let w = 0;
    for (const i of l) { const s = this.wire.items[i]; if (s.gone) continue; const d = segDist(x, z, s); if (d < s.r) w = Math.max(w, 1 - d / s.r * 0.5); }
    return w;
  }
  // a mine went up here: the wire in the blast is gone
  clearWire(x, z, r) { for (const s of this.wire.items) if (segDist(x, z, s) < r + s.r) s.gone = true; }
  // is a ruined wall (taller than you can step) in the way at this point?
  wallAt(x, z, footY, rad = 0.35) {
    const l = this.walls.near(x, z); if (!l) return null;
    for (const i of l) { const s = this.walls.items[i]; if (footY > s.y + s.h - 0.6) continue; if (segDist(x, z, s) < rad + 0.25) return s; }
    return null;
  }
}
