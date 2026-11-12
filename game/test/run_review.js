// Running review: follows a British soldier jogging across no man's land, side-on, 8 frames 0.1 s apart, and measures his
// gait: the hips' rise and fall, and how far a planted boot slides over the ground (it should hardly move).
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'run';
await ev(`(() => { TF.step({ yaw: TF.sim.player.yaw }, 60 * 50); return true; })()`);
// pick a jogging man near the player and follow him
const pick = await ev(`(() => { const S = TF.sim; for (let tries = 0; tries < 600; tries++) { TF.step({ yaw: S.player.yaw }, 1); TF.render(1 / 60);
  for (const [id, e] of TF.skinned.byId) { const s = S.soldiers[id]; if (s.side === 'BRI' && /Jog|Sprint/.test(e.clip) && !(s.climb > 0)) { window.__run = id; return { id, clip: e.clip, tries }; } } } return null; })()`);
log('[pick]', JSON.stringify(pick));
const stats = await ev(`(() => { const S = TF.sim, id = window.__run, V = TF.camera.position.constructor; let pel = [], slip = [], prev = {}, clips = {};
  for (let i = 0; i < 120; i++) { TF.step({ yaw: S.player.yaw }, 1);
    const s = S.soldiers[id]; if (!s.alive) break;
    TF.view = { pos: [s.x + 5, s.y + 1.2, s.z], look: [s.x, s.y + 0.9, s.z] }; TF.render(1 / 60);
    const e = TF.skinned.byId.get(id); if (!e) continue; clips[e.clip] = (clips[e.clip] || 0) + 1; if (!/Jog|Sprint/.test(e.clip)) { prev = {}; continue; }
    pel.push(e.bones.pelvis.getWorldPosition(new V()).y - s.y);
    for (const k of ['l', 'r']) { const f = e.bones['foot_' + k].getWorldPosition(new V()), g = TF.T.height(f.x, f.z);
      if (prev[k] && f.y - g < 0.13) slip.push(Math.hypot(f.x - prev[k].x, f.z - prev[k].z) * 60); prev[k] = f; } }
  TF.view = null; slip.sort((a, b) => a - b); const s = S.soldiers[id];
  return { frames: pel.length, clips, hipBob: +(Math.max(...pel) - Math.min(...pel)).toFixed(3), plantedSlipMedian: +(slip[slip.length >> 1] || 0).toFixed(2), speed: +(TF.men.state[id].speed || 0).toFixed(2) }; })()`);
log('[gait]', JSON.stringify(stats));
for (let k = 0; k < 8; k++) {
  await ev(`(() => { const S = TF.sim, id = window.__run; TF.step({ yaw: S.player.yaw }, 6); const s = S.soldiers[id];
    TF.view = { fov: 40, pos: [s.x + 6, s.y + 1.1, s.z + 0.5], look: [s.x, s.y + 0.85, s.z] }; for (let i = 0; i < 3; i++) TF.render(1 / 60); TF.hold = true; return true; })()`);
  await shot(`${tag}_${k}`, 85); await ev('TF.hold = false; true');
}
await ev('TF.view = null; true');
