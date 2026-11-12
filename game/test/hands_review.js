// Close-ups of the player's hands on the rifle, from cameras placed in the rifle's own frame (the first-person pass
// rendered with a debug camera): right side, left side, from above; at the ready, mid bolt-cycle and reloading.
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'h';
await ev(`(() => { TF.view = null; TF.render(0.03); TF.settle(); return true; })()`);
const views = [['right_side', [-0.42, 0.12, 0.42], [0, -0.03, 0.4]], ['left_side', [0.4, 0.05, 0.62], [0, -0.04, 0.45]], ['above', [-0.08, 0.42, 0.38], [0, 0, 0.42]]];
for (const [phase, setup] of [['ready', 'p.ads = false; p.cool = 0; p.reloading = 0'], ['bolt', 'p.ads = false; p.reloading = 0; p.cool = 0.58 * 0.95'], ['reload', 'p.ads = false; p.cool = 0; TF.fp.relLast = 0; p.reloading = 4.0; TF.fp.update(0, TF.camera, p, { cycle: 0.95 }, 0, 0, false); p.reloading = 2.4']]) {
  for (const [name, cam, look] of views) {
    if (phase !== 'ready' && name === 'left_side') continue;
    await ev(`(async () => { const THREE = await import('three'); const p = TF.sim.player; ${setup}; TF.render(1 / 60);
      const fp = TF.fp; fp.update(0, TF.camera, p, { cycle: 0.95 }, 0, 0, false);
      const G = fp.gun.matrixWorld, at = v => new THREE.Vector3(...v).applyMatrix4(G);
      const dc = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 10); dc.position.copy(at(${JSON.stringify(cam)})); dc.up.set(0, 1, 0); dc.lookAt(at(${JSON.stringify(look)}));
      TF.hold = true; const r = TF.renderer; r.setClearColor(0x6d7a86); r.clear(); r.render(fp.scene, dc); return true; })()`);
    await shot(`${tag}_${phase}_${name}`, 90); await ev('TF.hold = false; true');
  }
}
