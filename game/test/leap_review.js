// Leap review: catches a British soldier jumping a trench near the player and films it side-on, 6 frames across the jump.
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'leap';
await ev(`(() => { TF.god(true); TF.step({ yaw: TF.sim.player.yaw }, 60 * 40); return true; })()`);
const got = await ev(`(() => { const S = TF.sim, p = S.player;
  for (let i = 0; i < 60 * 120; i++) { TF.step({ yaw: p.yaw }, 1);
    for (const e of S.events) if (e.t === 'leap' && e.id !== p.id) { const s = S.soldiers[e.id]; if (Math.hypot(s.x - p.x, s.z - p.z) < 120) { window.__lp = { id: e.id, dur: s.climbDur, from: s.climbFrom, to: s.climbTo }; S.events.length = 0; return window.__lp; } }
    S.events.length = 0; }
  return null; })()`);
log('[leap]', JSON.stringify(got));
if (got) for (let k = 0; k < 6; k++) {
  await ev(`(() => { const S = TF.sim, L = window.__lp, s = S.soldiers[L.id]; if (${k} > 0) TF.step({ yaw: S.player.yaw }, Math.max(1, Math.round(L.dur * 60 / 5)));
    const fx = L.to[0] - L.from[0], fz = L.to[1] - L.from[1], d = Math.hypot(fx, fz), mx = (L.from[0] + L.to[0]) / 2, mz = (L.from[2 - 1 + 1] ?? L.from[2]), cz = (L.from[2] + L.to[1]) / 2, sx = -fz / d, sz = fx / d, y = L.from[1];
    TF.view = { fov: 45, pos: [mx + sx * 6, y + 1.6, cz + sz * 6], look: [mx, y + 0.9, cz] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 3; j++) TF.render(1 / 60); TF.hold = true; return true; })()`);
  await shot(`${tag}_${k}`, 85); await ev('TF.hold = false; true');
}
