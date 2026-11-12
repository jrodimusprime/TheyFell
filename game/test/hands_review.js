// Close-ups of the player's hands from a camera beside the rifle (the first-person pass rendered with a debug camera)
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'h';
await ev(`(() => { TF.view = null; TF.render(0.03); TF.settle(); return true; })()`);
const views = [['grip_right', 'hand_r', [-0.25, 0.08, 0.05]], ['grip_left', 'hand_l', [0.05, -0.2, 0.15]], ['grip_top', 'hand_r', [0.02, 0.3, 0.05]]];
for (const [phase, setup] of [['ready', 'p.ads = false; p.cool = 0; p.reloading = 0'], ['bolt', 'p.ads = false; p.cool = 0.58 * 0.95']]) {
  for (const [name, bone, off] of views) {
    if (phase === 'bolt' && name !== 'grip_right' && name !== 'grip_top') continue;
    await ev(`(async () => { const THREE = await import('three'); const p = TF.sim.player; ${setup}; TF.render(1 / 60);
      const fp = TF.fp; fp.update(0, TF.camera, p, { cycle: 0.95 }, 0, 0, false);
      const h = fp.bones['${bone}'].getWorldPosition(new THREE.Vector3()), cam = TF.camera, R = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), U = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), Bk = new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion);
      const dc = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 10); dc.position.copy(h).addScaledVector(R, ${off[0]}).addScaledVector(U, ${off[1]}).addScaledVector(Bk, ${off[2]}); dc.lookAt(h);
      TF.hold = true; const r = TF.renderer; r.setClearColor(0x6d7a86); r.clear(); r.render(fp.scene, dc); return true; })()`);
    await shot(`${tag}_${phase}_${name}`, 90); await ev('TF.hold = false; true');
  }
}
