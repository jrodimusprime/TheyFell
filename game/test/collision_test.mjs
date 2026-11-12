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

// ---- Rambo mode: the player survives 10 bullets, the 11th kills him; off, one rifle bullet kills ----
{
  const shooter = S.soldiers.find(x => !x.isPlayer) || S._spawn('GER', p.x + 5, p.z, 'rifle');
  const hits = rambo => { S.rambo = rambo; Object.assign(p, { alive: true, hp: 100 }); let n = 0; while (p.alive && n < 30) { S._damage(p, 100, shooter, { kind: 'bullet', zone: 'body', dir: [1, 0, 0], point: [p.x, p.y, p.z] }); n++; } S.rambo = false; return n; };
  const r = hits(true), off = hits(false);
  ok('Rambo mode: survives 10 bullets, the 11th kills', r === 11, `died on bullet ${r}`);
  ok('without Rambo mode a rifle bullet kills', off === 1, `died on bullet ${off}`);
}

// ---- a mine takes the trenches and wire in its blast with it ----
{
  const m = T.map.mines[0], [cx, cz] = m.c, R = m.craterR + 12;
  const inBlast = T.segs.filter(s => s.side === 'GER' && Math.hypot((s.ax + s.bx) / 2 - cx, (s.az + s.bz) / 2 - cz) < m.craterR);
  const wasTrench = inBlast.filter(s => T.isTrench((s.ax + s.bx) / 2, (s.az + s.bz) / 2)).length;
  while (!S.flags.mine) S.step({});
  const stillTrench = inBlast.filter(s => T.isTrench((s.ax + s.bx) / 2, (s.az + s.bz) / 2)).length;
  const wireLeft = F.wire.items.filter(w => !w.gone && Math.hypot((w.ax + w.bx) / 2 - cx, (w.az + w.bz) / 2 - cz) < m.craterR).length;
  const spawnsIn = S.trenchPts.GER.filter(q => Math.hypot(q[0] - cx, q[1] - cz) < m.craterR).length;
  ok('Lochnagar: no trench survives inside the crater', wasTrench > 5 && stillTrench === 0, `${wasTrench} trench pieces before, ${stillTrench} after`);
  ok('Lochnagar: no wire or posts left inside the crater', wireLeft === 0 && spawnsIn === 0, `wire ${wireLeft}, posts ${spawnsIn}`);
}

// ---- God mode: nothing hurts the player ----
{
  const shooter = S.soldiers.find(x => !x.isPlayer) || S._spawn('GER', p.x + 5, p.z, 'rifle');
  S.god = true; Object.assign(p, { alive: true, hp: 100 });
  for (let i = 0; i < 50; i++) S._damage(p, 200, shooter, { kind: 'bullet', zone: 'head', dir: [1, 0, 0], point: [p.x, p.y, p.z] });
  S._explode(p.x, p.y + 1, p.z, 20, 10, null, 'heavy'); S._damage(p, 500, null, { kind: 'fall', dir: [0, -1, 0], zone: 'legs', point: [p.x, p.y, p.z] });
  ok('God mode: 50 head shots, a heavy shell at his feet and a fall, and he is untouched', p.alive && p.hp === 100, `hp ${p.hp}`);
  S.god = false;
}

// ---- men are solid: the player can't walk through another soldier ----
{
  const S2 = new Sim(T, F, { seed: 3, bri: 0, ger: 0 }), q = S2.player;
  const pt = S2.trenchPts.BRI[40], o = S2._spawn('BRI', pt[0], pt[1]); o.ai.mode = 'hold'; o.ai.think = 1e9;
  let minD = 99, through = false;
  for (const ang of [0, 1, 2, 3, 4, 5]) {
    const a = ang * Math.PI / 3, sx = o.x + Math.cos(a) * 1.5, sz = o.z + Math.sin(a) * 1.5;
    if (T.height(sx, sz) - o.y > 0.5 || T.height(sx, sz) - o.y < -0.5) continue;
    Object.assign(q, { x: sx, z: sz, y: T.height(sx, sz), vy: 0, onGround: true, climb: 0, climbTo: null, alive: true, stance: 0 });
    const yaw = Math.atan2(-(o.x - sx), -(o.z - sz)), side0 = Math.sign((q.x - o.x) * Math.cos(a) + (q.z - o.z) * Math.sin(a));
    for (let i = 0; i < 120; i++) { S2._buildGrid(); S2._player(q, { forward: 1, yaw, run: true }); S2._move(q); minD = Math.min(minD, Math.hypot(q.x - o.x, q.z - o.z)); }
    if (Math.sign((q.x - o.x) * Math.cos(a) + (q.z - o.z) * Math.sin(a)) !== side0 && Math.hypot(q.x - o.x, q.z - o.z) < 1.2) through = true;
  }
  ok('the player cannot walk through another soldier', minD >= 0.55 && !through, `closest ${minD.toFixed(2)} m`);
}
