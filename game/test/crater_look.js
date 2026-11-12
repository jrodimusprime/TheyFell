// Review shots of the Lochnagar crater after the mine: from the British line, from the lip, and from above.
const tag = (await ev(`location.search`)).match(/loop=(\w+)/)?.[1] || 'x';
await ev(`(() => { TF.step({ yaw: TF.sim.player.yaw }, 60 * 12); return true; })()`);   // past 07:28 (the clock runs 5x before zero)
const L = await ev(`TF.T.map.mines[0].c`);
for (const [name, off, h, lookH] of [['crater_far', [-170, 130], 3, 0], ['crater_lip', [-62, 18], 2, -6], ['crater_above', [-45, 60], 60, -10]]) {
  await ev(`(() => { const H = (x, z) => TF.T.height(x, z), cx = ${L[0]}, cz = ${L[1]}, px = cx + ${off[0]}, pz = cz + ${off[1]};
    TF.view = { pos: [px, H(px, pz) + ${h}, pz], look: [cx, H(cx, cz) + ${lookH} + 6, cz] }; TF.render(0.03); TF.settle(); for (let i = 0; i < 15; i++) TF.render(0.05); return true; })()`);
  await shot(`${tag}_${name}`, 88);
}
