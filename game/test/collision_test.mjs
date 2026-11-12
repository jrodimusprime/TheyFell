// Trench-wall collision regression (Node, no browser). A man is placed on trench floors and driven at the walls from every
// direction; he must never overlap a wall (his 0.3 m body vs solid ground above step height) and never pass through one.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from '../js/core/rng.js';
const G = fileURLToPath(new URL('..', import.meta.url));
const { Terrain } = await import(G + 'js/world/terrain.js'); const { Features } = await import(G + 'js/world/features.js'); const { Sim, HZ } = await import(G + 'js/sim/sim.js');
const meta = JSON.parse(readFileSync(G + 'data/dem.json')), b = readFileSync(G + 'data/dem.bin'), map = JSON.parse(readFileSync(G + 'data/map_laboisselle.json'));
const T = new Terrain(meta, new Uint16Array(b.buffer, b.byteOffset, b.length / 2), map), F = new Features(T), S = new Sim(T, F, { seed: 1, bri: 0, ger: 0 });
const r = mulberry32(5), p = S.player, pts = S.trenchPts.BRI.concat(S.trenchPts.GER);
let worst = 0, through = 0, runs = 0, overlapTicks = 0, ticks = 0;
const overlap = () => {   // how far solid ground (above step height) reaches inside his 0.3 m circle
  let m = 0; for (let k = 0; k < 16; k++) for (const rr of [0.1, 0.2, 0.27]) { const a = k / 16 * Math.PI * 2, x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr; if (T.height(x, z) - p.y > 0.8) m = Math.max(m, 0.3 - rr); } return m; };
for (let n = 0; n < 120; n++) {
  const q = pts[r.int(pts.length)];
  for (let d = 0; d < 16; d++) {
    Object.assign(p, { x: q[0], z: q[1], y: T.height(q[0], q[1]), vy: 0, onGround: true, climb: 0, climbTo: null, alive: true, hp: 1e9, stance: 0 });
    const yaw = d / 16 * Math.PI * 2 + r() * 0.2, run = d % 2 === 0;
    let wasClimbing = false;
    for (let i = 0; i < HZ * 3; i++) {
      const bx = p.x, bz = p.z, by = p.y;
      S._player(p, { forward: 1, yaw, run, jump: true }); S._move(p); ticks++;
      if (p.climb > 0 || p.climbTo) { wasClimbing = true; continue; }
      if (wasClimbing) { wasClimbing = false; continue; }   // a legal climb out over the wall
      const o = overlap(); worst = Math.max(worst, o); if (o > 0.05) overlapTicks++;
      // passing through: he moved this tick from floor level to a point that is solid ground well above him
      if (Math.hypot(p.x - bx, p.z - bz) > 0 && T.height(p.x, p.z) - by > 0.8) through++;
    }
    runs++;
  }
}
const ok = (n, v, x) => { console.log(v ? 'PASS' : 'FAIL', n, x); if (!v) process.exitCode = 1; };
ok('never walks through a trench wall', through === 0, `${through} ticks in ${runs} runs`);
ok('body stays out of the walls (over 5 cm in < 1 tick per 100,000, never over 10 cm)', worst <= 0.1 && overlapTicks / ticks < 1e-5, `worst ${(worst * 100).toFixed(1)} cm, ${overlapTicks}/${ticks} ticks over 5 cm`);

// ---- climbing out (Space or E, standing still) and leaping a trench (E) ----
const fireBays = T.segs.filter(s => s.kind === 0 && s.side === 'BRI' && s.len > 6);
const settle = n => { for (let i = 0; i < n; i++) { S._player(p, { yaw: p.yaw }); S._move(p); } };
function climbTrial(key) {
  let okN = 0, n = 0;
  for (let k = 0; k < 40; k++) {
    const s = fireBays[(k * 37) % fireBays.length], mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2;
    // stand on the floor (rear half), face the enemy-side wall
    const x = mx - s.nx * 0.3, z = mz - s.nz * 0.3, yaw = Math.atan2(-s.nx, -s.nz);
    Object.assign(p, { x, z, y: T.height(x, z), vy: 0, onGround: true, climb: 0, climbTo: null, alive: true, hp: 1e9, stance: 0, yaw });
    settle(5); if (!T.isTrench(p.x, p.z)) continue; n++;
    const y0 = p.y;
    S._player(p, { yaw, [key]: true }); S._move(p); settle(90);
    if (!T.isTrench(p.x, p.z) && p.y > y0 + 1.2) okN++;
  }
  return [okN, n];
}
for (const key of ['jump', 'vault']) { const [a, n] = climbTrial(key); ok(`${key === 'jump' ? 'Space' : 'E'} climbs out of a trench, standing still (where there's ground to climb onto)`, n > 20 && a >= n * 0.9, `${a}/${n}`); }
{ // E on the lip of a trench: across it
  let okN = 0, n = 0;
  for (let k = 0; k < 40; k++) {
    const s = fireBays[(k * 53) % fireBays.length], mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2, o = s.hw + 0.45;
    const x = mx - s.nx * o, z = mz - s.nz * o, yaw = Math.atan2(-s.nx, -s.nz);   // on the parados side, facing across
    if (T.isTrench(x, z)) continue;
    Object.assign(p, { x, z, y: T.height(x, z), vy: 0, onGround: true, climb: 0, climbTo: null, alive: true, hp: 1e9, stance: 0, yaw });
    settle(3); if (T.isTrench(p.x, p.z)) continue; n++;
    S._player(p, { yaw, vault: true }); S._move(p); settle(60);
    const side = (p.x - mx) * s.nx + (p.z - mz) * s.nz;
    if (!T.isTrench(p.x, p.z) && side > s.hw) okN++;
  }
  ok('E leaps across a trench from its lip', n > 20 && okN >= n * 0.9, `${okN}/${n}`);
}
{ // Space with nothing to climb is a jump
  const s = fireBays[0], x = s.ax - s.nx * 8, z = s.az - s.nz * 8;
  Object.assign(p, { x, z, y: T.height(x, z), vy: 0, onGround: true, climb: 0, climbTo: null, stance: 0, yaw: Math.atan2(s.nx, s.nz) + Math.PI });
  settle(3); S._player(p, { yaw: p.yaw, jump: true }); S._move(p);
  ok('Space in the open is a jump', p.vy > 2 && !p.climbTo, `vy ${p.vy.toFixed(2)}`);
}
