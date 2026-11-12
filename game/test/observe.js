// Observer shots of the battle from a free camera: [name, ticksToRun, camPos[x,y(above ground),z], look[x,y(above ground),z]]
const V = JSON.parse(process.env.TF_VIEWS);
for (const [name, ticks, pos, look] of V) {
  const r = await ev(`(() => { if (${ticks} > 0) TF.step({ yaw: TF.sim.player.yaw }, ${ticks}); const H = (x, z) => TF.T.height(x, z);
    TF.view = { pos: [${pos[0]}, H(${pos[0]}, ${pos[2]}) + ${pos[1]}, ${pos[2]}], look: [${look[0]}, H(${look[0]}, ${look[2]}) + ${look[1]}, ${look[2]}] };
    TF.render(0.03); TF.settle(); for (let i = 0; i < 25; i++) TF.render(0.033); return { perf: TF.perf(), time: TF.sim.clock(), alive: TF.sim.soldiers.filter(s => s.alive).length }; })()`);
  log(name, JSON.stringify(r)); await shot(name, 85);
}
