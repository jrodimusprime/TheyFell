// Deterministic randomness and hashing (Cimmerian README §11: seeded RNG for every sim decision, FNV-1a state hash).
export function mulberry32(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = n => Math.floor(f() * n);
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += f(); return (s - 2) * 1.732; };
  f.state = () => a;
  f.setState = s => { a = s >>> 0; };
  return f;
}
export function hash2(x, z, seed = 0) {
  let h = Math.imul((x | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul((z | 0) + seed, 0x9E3779B1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae3d); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export class FNV {
  constructor() { this.h = 0x811c9dc5; }
  u32(v) { v = v >>> 0; for (let i = 0; i < 4; i++) { this.h ^= (v >>> (i * 8)) & 255; this.h = Math.imul(this.h, 0x01000193); } return this; }
  f(v) { return this.u32(Math.round(v * 1000)); }
  hex() { return (this.h >>> 0).toString(16).padStart(8, '0'); }
}
