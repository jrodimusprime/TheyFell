// Flicker regression: with the camera still (and then bobbing as when walking) while the battle runs and shells land,
// the set of terrain tiles drawn must not change frame to frame (no LOD popping, no fallback to coarse tiles).
const r = await ev(`(() => {
  const S = TF.sim, terr = TF.terrain; S.player.hp = 1e12; TF.step({ yaw: S.player.yaw }, 60 * 200);   // (he must not fall: the death camera moves) TF.render(0.03); TF.settle();
  const visKey = () => terr.group.children.filter(m => m.visible).map(m => m.userData.level + ':' + m.userData.x0 + ':' + m.userData.z0).sort().join('|');
  // warm-up: the battle running and the ground refining (near, then the distance) until it has been steady for 30 frames
  { let k0 = visKey(), quiet = 0; for (let i = 0; i < 600 && quiet < 30; i++) { TF.step({ yaw: S.player.yaw }, 1); TF.render(1 / 60); const k = visKey(); quiet = k === k0 ? quiet + 1 : 0; k0 = k; } }
  const run = (frames, bob) => { let prev = visKey(), changes = 0, craters = 0;
    for (let i = 0; i < frames; i++) {
      const before = S.events.filter(e => e.t === 'crater').length; TF.step({ yaw: S.player.yaw }, 1); craters += S.events.filter(e => e.t === 'crater').length - before;
      if (bob) S.player.y += Math.sin(i * 0.35) * 0.04;
      TF.render(1 / 60); const k = visKey(); if (k !== prev) changes++; prev = k; }
    return { frames, changes, craters, deaths: S.player.deaths, alive: S.player.alive }; };
  return { still: run(600, false), bobbing: run(600, true) }; })()`);
log('[flicker]', JSON.stringify(r));
log(r.still.changes === 0 ? 'PASS' : 'FAIL', 'terrain tiles never pop with the camera still while shells land', JSON.stringify(r.still));
log(r.bobbing.changes <= 2 ? 'PASS' : 'FAIL', 'terrain tiles do not pop with head-bob', JSON.stringify(r.bobbing));
