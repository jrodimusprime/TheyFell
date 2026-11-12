// Screenshots from a set of viewpoints: [name, x, z, yaw, pitch, ticksToRun, stance]
const V = JSON.parse(process.env.TF_VIEWS || '[["start",null,null,-1.57,0.05,0]]');
await ev(`TF.render(0.016); true`);
for (const [name, x, z, yaw, pitch, ticks, stance] of V) {
  const r = await ev(`(() => { const s = TF.sim, p = s.player; if (${ticks || 0} > 0) TF.step({}, ${ticks || 0}); if (${x !== null}) { p.x = ${x}; p.z = ${z}; p.y = TF.T.height(p.x, p.z); } p.yaw = ${yaw}; p.pitch = ${pitch}; p.stance = ${stance || 0}; TF.render(0.03); TF.settle(); for (let i = 0; i < 20; i++) TF.render(0.033); return { perf: TF.perf(), time: s.clock() }; })()`);
  log(name, JSON.stringify(r)); await shot(name, 85);
}
