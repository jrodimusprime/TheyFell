// The reload in first person, step by step: bolt up and back, the charger thumbed in (twice for ten rounds), bolt
// forward and down. Filmed from the player's eye and from the rifle's right side, at nine moments through it.
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'rl';
await ev(`(() => { TF.view = null; TF.render(0.03); TF.settle(); return true; })()`);
const total = 4.0;
for (const u of [0.04, 0.1, 0.15, 0.25, 0.35, 0.5, 0.6, 0.85, 0.92]) {
  for (const [name, cam, look] of [['eye', null, null], ['right', [-0.42, 0.1, 0.38], [0, 0, 0.38]]]) {
    await ev(`(async () => { const THREE = await import('three'); const p = TF.sim.player; p.ads = false; p.cool = 0; const fp = TF.fp;
      fp.relLast = 0; p.reloading = ${total}; fp.update(0, TF.camera, p, { cycle: 0.95 }, 0, 0, false); p.reloading = ${total * (1 - u)};
      TF.render(1 / 60); fp.update(0, TF.camera, p, { cycle: 0.95 }, 0, 0, false);
      TF.hold = true; const r = TF.renderer;
      if (${JSON.stringify(cam)}) { const G = fp.gun.matrixWorld, at = v => new THREE.Vector3(...v).applyMatrix4(G); const dc = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 10); dc.position.copy(at(${JSON.stringify(cam)})); dc.up.set(0, 1, 0); dc.lookAt(at(${JSON.stringify(look)})); r.setClearColor(0x6d7a86); r.clear(); r.render(fp.scene, dc); }
      return true; })()`);
    await shot(`${tag}_${String(Math.round(u * 100)).padStart(2, '0')}_${name}`, 88); await ev('TF.hold = false; true');
  }
}
