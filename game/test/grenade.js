// Grenades: G gets a bomb out, the arc shows where it will land and the meter swings; the throw (pin out, overhand, let
// go) and the bomb lands where the arc's ring said; men on both sides throw them in the fight (filmed side-on).
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'grenade';
// out on open ground facing the most open way, after zero hour
const setup = await ev(`(() => { const S = TF.sim, p = S.player; TF.god(true); TF.step({ yaw: p.yaw }, 60 * 30);
  for (let r = 10; r < 300; r += 4) { let done = false; for (let k = 0; k < 8 && !done; k++) { const a = k * Math.PI / 4, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
    if (TF.T.trenchAt(x, z, {}).d > 8 && Math.abs(TF.T.height(x + 4, z) - TF.T.height(x - 4, z)) < 0.4 && Math.abs(TF.T.height(x, z + 4) - TF.T.height(x, z - 4)) < 0.4) { Object.assign(p, { x, z, y: TF.T.height(x, z), vy: 0, stance: 0 }); done = true; } } if (done) break; }
  let yaw = p.yaw, far = 0; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, sx = -Math.sin(a), sz = -Math.cos(a); let d = 0; while (d < 40 && TF.T.height(p.x + sx * (d + 0.5), p.z + sz * (d + 0.5)) < p.y + 1.0) d += 0.5; if (d > far) { far = d; yaw = a; } }
  window.__yaw = yaw; TF.step({ yaw, pitch: 0.05 }, 10); return { far, grenades: p.grenades }; })()`);
log('[setup]', JSON.stringify(setup));
// 1. ready: the arc and the meter, the bomb in the hand
const r1 = await ev(`(() => { const pw = TF.nade(true, 0.45); TF.step({ yaw: __yaw, pitch: 0.05 }, 1); for (let i = 0; i < 20; i++) TF.render(1 / 60); TF.nade(true, 0.45); TF.render(1 / 60); TF.hold = true;
  return { arc: TF.nades.arc.visible, ring: TF.nades.ring.visible, meter: !document.getElementById('meter').hidden, fpNade: TF.fp.nade.visible, pw }; })()`);
await shot(`${tag}_1_ready_arc`, 88); await ev('TF.hold = false; true');
ok('G: the bomb in the hand, the arc, the landing ring and the meter show', r1.arc && r1.ring && r1.meter && r1.fpNade, JSON.stringify(r1));
// 2. throw at the meter's power: does it land where the ring said?
const r2 = await ev(`(() => { const p = TF.sim.player; TF.nade(false); TF.step({ yaw: __yaw, pitch: 0.05, grenade: 0.6 }, 1); window.__t = { i: 1 }; window.__pred = null; return { throw: p.throw, left: p.grenades }; })()`);
ok('a click throws: the throw starts and a bomb is used', r2.throw > 0 && r2.left === 2, JSON.stringify(r2));
// (the stages are filmed one at a time below)
const stages = [];
for (const at of [12, 38, 46]) {
  const r = await ev(`(async () => { const { nadeLaunch, nadePath } = await import('/js/sim/sim.js'); const S = TF.sim, p = S.player;
    TF.hold = false; while (window.__t.i < ${at}) { if (p.throw === 51 && !window.__pred) window.__pred = nadePath(nadeLaunch(p.x, S._eye(p), p.z, __yaw, 0.05, 0.6), TF.T).land; TF.step({ yaw: __yaw, pitch: 0.05 }, 1); window.__t.i++; }
    TF.render(1 / 60); TF.render(1 / 60); TF.hold = true; return { i: window.__t.i, throw: p.throw, nadeVisible: TF.fp.nade.visible }; })()`);
  stages.push(r); await shot(`${tag}_2_throw_${at}`, 88); await ev('TF.hold = false; true');
}
log('[stages]', JSON.stringify(stages));
// follow the bomb: film it in flight from the side, then see where it first lands
const r3 = await ev(`(async () => { const { nadeLaunch, nadePath } = await import('/js/sim/sim.js'); const S = TF.sim, p = S.player;
  while (p.throw > 50) { if (p.throw === 51 && !window.__pred) window.__pred = nadePath(nadeLaunch(p.x, S._eye(p), p.z, __yaw, 0.05, 0.6), TF.T).land; TF.step({ yaw: __yaw, pitch: 0.05 }, 1); }
  const g = S.grenades[S.grenades.length - 1]; if (!g) return { none: true };
  let land = null, filmed = false;
  for (let i = 0; i < 300 && !land; i++) { const b = g.bounces || 0; TF.step({ yaw: __yaw, pitch: 0.05 }, 1); if ((g.bounces || 0) > b) land = [g.x, g.y, g.z];
    if (i === 30 && !filmed) { filmed = true; const fx = -Math.sin(__yaw), fz = -Math.cos(__yaw); TF.view = { fov: 40, pos: [g.x + fz * 7, g.y + 0.6, g.z - fx * 7], look: [g.x, g.y, g.z] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 3; j++) TF.render(1 / 60); TF.hold = true; window.__mid = { land: null, g: [g.x, g.y, g.z] }; return { flying: true, at: [g.x, g.y, g.z] }; } }
  return { land }; })()`);
await shot(`${tag}_3_in_flight`, 88); await ev('TF.hold = false; TF.view = null; true');
const r4 = await ev(`(() => { const S = TF.sim, g = S.grenades[S.grenades.length - 1]; let land = null; if (!g) return null;
  for (let i = 0; i < 300 && !land; i++) { const b = g.bounces || 0; TF.step({ yaw: __yaw, pitch: 0.05 }, 1); if ((g.bounces || 0) > b) land = [g.x, g.y, g.z]; }
  const P = window.__pred; return { land, pred: P, miss: land && P ? Math.hypot(land[0] - P[0], land[2] - P[2]) : null, dist: land ? Math.hypot(land[0] - S.player.x, land[2] - S.player.z) : null, left: S.player.grenades }; })()`);
ok('the bomb lands where the arc\'s ring showed', r4 && r4.miss !== null && r4.miss < 0.05, JSON.stringify(r4));
ok('a 0.6 throw goes a fair way (15-35 m) and one bomb is gone', r4 && r4.dist > 15 && r4.dist < 35 && r4.left === 2, JSON.stringify(r4));
// 3. AI bombers, filmed
await ev('TF.god(true); true');
const got = await ev(`(() => { const S = TF.sim, p = S.player; let n = 0; for (let i = 0; i < 60 * 240; i++) { TF.step({ yaw: p.yaw }, 1);
    for (const e of S.events) if (e.t === 'throw' && e.id !== p.id) { n++; const s = S.soldiers[e.id]; if (n > 3 && s.alive) { window.__th = e.id; S.events.length = 0; return { id: e.id, side: s.side, n, secs: i / 60 }; } }
    S.events.length = 0; } return { n }; })()`);
log('[throw]', JSON.stringify(got));
if (got && got.id !== undefined) for (let k = 0; k < 5; k++) {
  await ev(`(() => { const S = TF.sim, s = S.soldiers[window.__th]; if (${k} > 0) TF.step({ yaw: S.player.yaw }, ${[0, 30, 16, 6, 30][k]}); const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    if (!window.__cam) { let best = null; for (const side of [1, -1]) for (const ang of [0, 0.4, -0.4, 0.8, -0.8]) for (const r of [5, 7, 9]) for (const h of [1.8, 2.6, 3.4]) {
        const c = Math.cos(ang), sn = Math.sin(ang), ox = fz * side * c + fx * sn, oz = -fx * side * c + fz * sn, px = s.x + ox * r, pz = s.z + oz * r, py = Math.max(s.y + h, TF.T.height(px, pz) + 1.2);
        const tx = s.x - px, ty = s.y + 1.3 - py, tz = s.z - pz, L = Math.hypot(tx, ty, tz); if (TF.T.raycast(px, py, pz, tx / L, ty / L, tz / L, L - 0.4) < 0) { const sc = -Math.abs(ang) - r * 0.05 - (py - s.y) * 0.1; if (!best || sc > best.sc) best = { sc, pos: [px, py, pz] }; } }
      window.__cam = best ? best.pos : [s.x + fz * 5, s.y + 3, s.z - fx * 5]; }
    TF.view = { fov: 40, pos: window.__cam, look: [s.x + fx * 0.4, s.y + 1.2, s.z + fz * 0.4] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 3; j++) TF.render(1 / 60); TF.hold = true; return true; })()`);
  await shot(`${tag}_4_ai_${k}`, 85); await ev('TF.hold = false; true');
}
ok('men throw bombs in the fight', got && got.id !== undefined, JSON.stringify(got));
