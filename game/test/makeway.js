// Making way in a trench: the player walks along a bay of his own front trench at a comrade standing in the middle of
// it. The comrade must step aside before the player reaches him (up onto the fire-step or back to the wall: smoothly,
// never jumping more than a stride a tick), stand side-on to the trench while the player squeezes by (slowed), and go
// back to what he was doing once the player is past. Filmed: the approach, the squeeze, after.
// Run: node test/cdp.mjs "http://localhost:8642/index.html?agent" test/makeway.js <outdir>
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
const setup = await ev(`(() => { const S = TF.sim, p = S.player, T = TF.T; TF.god(true);
  // a long straight bay of the British fire trench near the player, its men moved out of it but one, in the middle
  const bays = S.trenchPts.BRI.filter(q => T.segs[q[2]].kind === 0 && T.segs[q[2]].len > 8 && Math.hypot(q[0] - p.x, q[1] - p.z) < 300).sort((a, b) => T.segs[b[2]].len - T.segs[a[2]].len);
  const b = bays[0], sg = T.segs[b[2]], L = sg.len, ux = (sg.bx - sg.ax) / L, uz = (sg.bz - sg.az) / L;
  const at = t => { const q = S._alongBay(b, t); return [q[0], q[1]]; };
  for (const o of S.soldiers) if (!o.isPlayer && o.alive && Math.abs((o.x - b[0]) * ux + (o.z - b[1]) * uz) < L / 2 + 3 && Math.abs((o.x - b[0]) * -uz + (o.z - b[1]) * ux) < 3) { o.x += 40; o.z += 0; o.y = T.height(o.x, o.z); }
  const c = S.soldiers.find(o => !o.isPlayer && o.alive && o.side === 'BRI' && !(o.gun >= 0)); const [cx, cz] = at(0.5); Object.assign(c, { x: cx, z: cz, y: T.height(cx, cz), vy: 0, stance: 0, intent: null }); c.ai.mode = 'hold'; c.ai.post = [cx, cz]; c.ai.think = 9999;
  const [px, pz] = at(-L / 2 + 1); Object.assign(p, { x: px, z: pz, y: T.height(px, pz), vy: 0, onGround: true, alive: true, climb: 0 });
  window.__mw = { c: c.id, yaw: Math.atan2(-ux, -uz), ux, uz, L, home: [cx, cz] };
  return { len: +L.toFixed(1), c: c.id, d0: +Math.hypot(cx - px, cz - pz).toFixed(2), time: S.clock() }; })()`);
log('[setup]', JSON.stringify(setup));
// walk along the bay, frame by frame, the camera behind and above the player for the film
const run = await ev(`(() => { const S = TF.sim, p = S.player, W = window.__mw, c = S.soldiers[W.c], r = { gaveAt: null, maxJump: 0, minD: 99, passed: false, slowest: 99, up: false, side: 0, frames: [] };
  let last = [c.x, c.z];
  for (let i = 0; i < 60 * 6; i++) {
    const x0 = p.x, z0 = p.z;
    TF.step({ forward: 1, yaw: W.yaw, pitch: 0 }, 1);
    const along = (c.x - p.x) * W.ux + (c.z - p.z) * W.uz;
    if (c.giveWay && r.gaveAt === null) { r.gaveAt = +along.toFixed(2); r.up = c.giveWay.up; }
    r.maxJump = Math.max(r.maxJump, Math.hypot(c.x - last[0], c.z - last[1])); last = [c.x, c.z];
    r.minD = Math.min(r.minD, Math.hypot(c.x - p.x, c.z - p.z));
    if (Math.hypot(c.x - p.x, c.z - p.z) < 1) r.slowest = Math.min(r.slowest, Math.hypot(p.x - x0, p.z - z0) * 60);
    r.side = Math.max(r.side, Math.abs((c.x - W.home[0]) * -W.uz + (c.z - W.home[1]) * W.ux));
    if (along < -1.5) { r.passed = true; break; }
  }
  r.giving = !!c.giveWay; return r; })()`);
log('[walk]', JSON.stringify(run));
ok('a comrade in the player\'s path steps aside before he is reached', run.gaveAt !== null && run.gaveAt > 0.8, `began at ${run.gaveAt} m ahead${run.up ? ', up onto the fire-step' : ', back to the wall'}; ${run.side.toFixed(2)} m to the side`);
ok('smoothly: he moves no more than 6 cm a tick (no jump)', run.maxJump < 0.06, `${run.maxJump.toFixed(3)} m`);
ok('the player gets past him (squeezing by, slowed, where he stays on the floor; at a walk where he is up on the fire-step), never into him', run.passed && run.minD >= 0.42 && (run.up || run.slowest < 1.2), `closest ${run.minD.toFixed(2)} m; ${run.slowest.toFixed(2)} m/s beside him${run.up ? ' (he is up on the step)' : ''}`);
const after = await ev(`(() => { const S = TF.sim, p = S.player, W = window.__mw, c = S.soldiers[W.c]; TF.step({ forward: 1, yaw: W.yaw, pitch: 0 }, 60); TF.step({ yaw: W.yaw }, 60); c.ai.think = 0; TF.step({ yaw: W.yaw }, 60 * 4); return { giving: !!c.giveWay, home: +Math.hypot(c.x - W.home[0], c.z - W.home[1]).toFixed(2) }; })()`);
ok('once the player is past he goes back to what he was doing', !after.giving, JSON.stringify(after));
// the film: the same again in a crowded bay before zero hour (the battalion packed in), seen from behind the player
await ev(`(() => { location.hash = ''; return true; })()`);
const crowd = await ev(`(() => { const S = TF.sim, p = S.player, T = TF.T;
  const bays = S.trenchPts.BRI.filter(q => T.segs[q[2]].kind === 0 && T.segs[q[2]].len > 8 && Math.hypot(q[0] - p.x, q[1] - p.z) < 400).sort((a, b) => T.segs[b[2]].len - T.segs[a[2]].len);
  const b = bays[1], sg = T.segs[b[2]], L = sg.len, ux = (sg.bx - sg.ax) / L, uz = (sg.bz - sg.az) / L, yaw = Math.atan2(-ux, -uz);
  const men = S.soldiers.filter(o => !o.isPlayer && o.alive && o.side === 'BRI' && !(o.gun >= 0)).slice(10, 13);
  men.forEach((o, k) => { const q = S._alongBay(b, -L / 2 + 3.5 + k * 2.4); Object.assign(o, { x: q[0] + (k % 2 ? 0.15 : -0.15) * -uz, z: q[1] + (k % 2 ? 0.15 : -0.15) * ux, y: T.height(q[0], q[1]), vy: 0, stance: 0, intent: null }); o.ai.mode = 'hold'; o.ai.post = [o.x, o.z]; o.ai.think = 9999; });
  const q0 = S._alongBay(b, -L / 2 + 0.8); Object.assign(p, { x: q0[0], z: q0[1], y: T.height(q0[0], q0[1]), vy: 0 });
  window.__cr = { yaw, ux, uz }; return men.map(o => o.id); })()`);
for (let k = 0; k < 3; k++) {
  await ev(`(() => { const S = TF.sim, p = S.player, C = window.__cr; TF.step({ forward: 1, yaw: C.yaw, pitch: 0 }, ${k ? 70 : 40}); TF.view = { pos: [p.x - C.ux * 3.2, p.y + 2.6, p.z - C.uz * 3.2], look: [p.x + C.ux * 4, p.y + 0.9, p.z + C.uz * 4], fov: 70 }; for (let i = 0; i < 6; i++) TF.render(1 / 30); TF.hold = true; return true; })()`);
  await shot('makeway_' + k, 88); await ev('TF.hold = false; TF.view = null; true');
}
const cr = await ev(`(() => { const S = TF.sim; return ${JSON.stringify(crowd)}.map(id => { const o = S.soldiers[id]; return { id, gave: !!o.giveWay, up: o.giveWay ? o.giveWay.up : null }; }); })()`);
log('[crowd]', JSON.stringify(cr));
