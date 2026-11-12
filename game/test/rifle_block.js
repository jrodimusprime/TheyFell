// The rifle must not go into walls: in a trench, facing the wall from 0.4 m, it is drawn back (pull ~1); along the trench it is clear.
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'rb';
const setup = await ev(`(() => { const S = TF.sim, T = TF.T, p = S.player; TF.view = null;
  const empty = s => S.soldiers.every(o => o.isPlayer || !o.alive || Math.hypot(o.x - (s.ax + s.bx) / 2, o.z - (s.az + s.bz) / 2) > 8);
  const sg = T.segs.find(s => s.side === 'BRI' && s.kind === 0 && s.len > 7 && empty(s));
  const mx = (sg.ax + sg.bx) / 2, mz = (sg.az + sg.bz) / 2, x = mx - sg.nx * 0.35, z = mz - sg.nz * 0.35;   // 0.4 m from the back wall (the parados side)
  Object.assign(p, { x, z, y: T.height(x, z), stance: 0, ads: false, cool: 0, reloading: 0 });
  return { wallYaw: Math.atan2(sg.nx, sg.nz), alongYaw: Math.atan2(-(sg.bx - sg.ax), -(sg.bz - sg.az)) }; })()`);
const res = {};
for (const [name, yaw] of [['facing_wall', setup.wallYaw], ['along_trench', setup.alongYaw]]) {
  res[name] = await ev(`(() => { const p = TF.sim.player; p.yaw = ${yaw}; p.pitch = -0.05; TF.render(0.03); TF.settle(); for (let i = 0; i < 40; i++) TF.render(1 / 60); return [+TF.fp.pull.toFixed(2), TF.rifleBlock.why, TF.rifleBlock.best]; })()`);
  await shot(`${tag}_${name}`, 88);
}
log('[rifle]', JSON.stringify(res));
log(res.facing_wall[0] > 0.8 && res.along_trench[0] < 0.2 ? 'PASS' : 'FAIL', 'the rifle draws back from a wall and not in the open', JSON.stringify(res));
