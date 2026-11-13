// The dead who fell out of the player's view (no ragdoll: over 260 m off, or too many at once): filmed where they lie,
// close up, after a few minutes of the battle. Their rifles should lie on the ground beside them.
const r = await ev(`(() => { const S = TF.sim, p = S.player; TF.god(true); for (let i = 0; i < 150; i++) { TF.step({ yaw: p.yaw }, 60); TF.render(1 / 60); }
  const far = TF.men.corpses.filter(c => !c.removed && Math.hypot(c.x - p.x, c.z - p.z) > 300); window.__far = far.slice(0, 40);
  return { all: TF.men.corpses.length, far: far.length, poses: [...new Set(far.map(c => c.pose))].length }; })()`);
log('[corpses]', JSON.stringify(r));
for (let k = 0; k < 6; k++) {
  const info = await ev(`(() => { const c = window.__far[${k} * 5]; if (!c) return null; const S = TF.sim, p = S.player, T = TF.T;
    const e = c.mats[0].elements, x = e[12], z = e[14]; Object.assign(p, { x: x + 4, z: z + 4, y: T.height(x + 4, z + 4), vy: 0 }); TF.step({ yaw: p.yaw }, 1);
    TF.view = { fov: 45, pos: [x + 2.6, T.height(x, z) + 1.8, z + 2.6], look: [x, T.height(x, z) + 0.2, z] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 4; j++) TF.render(1 / 60); TF.hold = true;
    const rf = c.rifle.elements; return { pose: c.pose, rifleOverGround: +(rf[13] - T.height(rf[12], rf[14])).toFixed(2), skinned: c.skinned }; })()`);
  log('[corpse]', k, JSON.stringify(info));
  await shot(`corpse_${k}`, 85); await ev('TF.hold = false; true');
}
// the field: where most fell, from a man's height 25-40 m off
for (let k = 0; k < 3; k++) {
  await ev(`(() => { const S = TF.sim, p = S.player, T = TF.T, cs = TF.men.corpses.filter(c => !c.removed); const c = cs[Math.floor(cs.length * ${[0.3, 0.6, 0.9][k]})], e = c.mats[0].elements, x = e[12], z = e[14];
    Object.assign(p, { x: x - 30, z: z + 8, y: T.height(x - 30, z + 8), vy: 0 }); TF.step({ yaw: p.yaw }, 1);
    TF.view = { fov: 50, pos: [x - 30, T.height(x - 30, z + 8) + 2.2, z + 8], look: [x, T.height(x, z), z] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 4; j++) TF.render(1 / 60); TF.hold = true; return true; })()`);
  await shot(`field_${k}`, 85); await ev('TF.hold = false; true');
}
