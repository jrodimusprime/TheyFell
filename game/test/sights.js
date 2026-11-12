// Aiming down the sights must be exact: in full aim, the rear aperture's centre and the foresight blade's tip both project
// to the centre of the screen (the line the bullet travels), at any look direction.
const yaw0 = await ev('TF.sim.player.yaw');
const r = await ev(`(async () => { const THREE = await import('three'); const p = TF.sim.player, fp = TF.fp, out = [];
  for (const [yaw, pitch] of [[p.yaw, 0], [p.yaw + 0.7, 0.25], [p.yaw - 1.2, -0.2]]) {
    p.yaw = yaw; p.pitch = pitch; p.ads = true; p.cool = 0; p.reloading = 0;
    for (let i = 0; i < 60; i++) TF.render(1 / 60);   // settle into the aim
    TF.camera.updateMatrixWorld(); fp.update(0, TF.camera, p, { cycle: 0.95 }, 0, 0, false, Infinity);
    const cam = TF.camera.clone(); cam.fov = TF.camera.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const proj = v => { const w = v.clone().applyMatrix4(fp.gun.matrixWorld).project(cam); return [+(w.x * innerWidth / 2).toFixed(2), +(w.y * innerHeight / 2).toFixed(2)]; };
    const up = new THREE.Vector3(0, 1, 0).transformDirection(fp.gun.matrixWorld).dot(new THREE.Vector3(0, 1, 0).transformDirection(cam.matrixWorld));
    out.push({ rear: proj(new THREE.Vector3(-0.0015, 0.022, 0.342)), tip: proj(new THREE.Vector3(-0.0002, 0.0179, 1.075)), up: +up.toFixed(4), handHidden: !fp.xr.right.object.visible });
  }
  p.ads = false; return out; })()`);
log('[sights]', JSON.stringify(r));
const worst = Math.max(...r.flatMap(q => [Math.hypot(...q.rear), Math.hypot(...q.tip)]));
log(worst <= 1.5 ? 'PASS' : 'FAIL', 'rear aperture and foresight tip on the screen centre when aiming', `worst ${worst.toFixed(2)} px off`);
const minUp = Math.min(...r.map(q => q.up)); log(minUp > 0.995 ? 'PASS' : 'FAIL', 'the rifle is held upright when aiming (not canted)', `up alignment ${minUp}`);
log(r.every(q => q.handHidden) ? 'PASS' : 'FAIL', 'the trigger hand is out of sight when aiming');
for (const [n, setup] of [['sights_aim', `p.yaw = ${yaw0}; p.pitch = 0.0;`], ['sights_aim_attack', `TF.step({ yaw: ${yaw0} }, 60 * 34); Object.assign(p, { x: 3100, z: 2600, y: TF.T.height(3100, 2600), yaw: -0.8, pitch: 0.0 });`]]) {
  await ev(`(() => { const p = TF.sim.player; ${setup} p.ads = true; TF.render(0.03); TF.settle(); for (let i = 0; i < 40; i++) TF.render(1 / 60); return true; })()`); await shot(n, 92); }
