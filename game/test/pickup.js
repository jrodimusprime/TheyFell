// Picking up a fallen man's rifle: E beside him, a stoop (the view goes down, your rifle out of sight), and you come up with
// his rifle and what ammunition he had; yours is left lying there. Taking a German rifle, it is drawn in first person and its
// own sights (V-notch and front post) line up on the screen centre when aiming.
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
const setup = await ev(`(() => { const S = TF.sim, p = S.player; TF.god(true); TF.step({ yaw: p.yaw }, 60 * 40);
  const g = S.soldiers.find(o => o.side === 'GER' && o.alive && o.role !== 'mg'); g.mag = 3; g.reserve = 25;
  S._damage(g, 1e4, null, { kind: 'shell', zone: 'body', dir: [0, -1, 0], point: [g.x, g.y + 1, g.z] });
  let px = g.x, pz = g.z; for (const [ox, oz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8], [0.5, 0.5], [-0.5, -0.5]]) if (Math.abs(TF.T.height(g.x + ox, g.z + oz) - g.y) < 0.3) { px = g.x + ox; pz = g.z + oz; break; }
  Object.assign(p, { x: px, z: pz, y: TF.T.height(px, pz), vy: 0 }); TF.step({ yaw: p.yaw, pitch: -0.3 }, 2); TF.render(1 / 60);
  return { near: S.nearDrop(p), weapon: p.weapon, prompt: document.getElementById('prompt').textContent }; })()`);
ok('beside a fallen German the HUD offers his rifle', setup.near >= 0 && /Gewehr 98/.test(setup.prompt), JSON.stringify(setup));
await ev(`(() => { TF.step({ yaw: TF.sim.player.yaw, pitch: -0.3, pickup: true }, 1); TF.step({ yaw: TF.sim.player.yaw, pitch: -0.3 }, 26); for (let i = 0; i < 3; i++) TF.render(1 / 60); TF.hold = true; return true; })()`);
await shot('pickup_1_stooping', 85); await ev('TF.hold = false; true');
const mid = await ev(`(() => ({ pickup: TF.sim.player.pickup, camY: TF.camera.position.y - TF.sim.player.y }))()`);
ok('E starts a stoop: the view goes down to him', mid.pickup > 0 && mid.camY < 1.2, JSON.stringify(mid));
const done = await ev(`(() => { const S = TF.sim, p = S.player; TF.step({ yaw: p.yaw, pitch: 0 }, 50); for (let i = 0; i < 3; i++) TF.render(1 / 60);
  const d = S.drops[S.nearDrop(p)]; return { weapon: p.weapon, mag: p.mag, reserve: p.reserve, left: d && d.weapon, fpKind: TF.fp.kindName, fpVisible: TF.fp.gun.visible }; })()`);
ok('you come up with his Gewehr 98 and his rounds; your rifle lies in its place', done.weapon === 'g98' && done.mag === 3 && done.reserve === 25 && done.left === 'smle', JSON.stringify(done));
ok('the Gewehr 98 is in your hands in first person', done.fpKind === 'g98' && done.fpVisible, JSON.stringify(done));
await ev(`(() => { for (let i = 0; i < 3; i++) TF.render(1 / 60); TF.hold = true; return true; })()`);
await shot('pickup_2_holding_g98', 85); await ev('TF.hold = false; true');
// aim: the notch and the post on the centre of the screen
const sight = await ev(`(async () => { const THREE = await import('three'); const S = TF.sim, p = S.player;
  // out on open ground first (in a trench the walls are close enough to draw the rifle back off them)
  for (let r = 6; r < 200; r += 3) { let done = false; for (let k = 0; k < 8 && !done; k++) { const a = k * Math.PI / 4, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; if (!TF.T.inTrench(x, z) && !TF.T.trenchAt(x, z, {}, 0).seg >= 0 && Math.abs(TF.T.height(x + 3, z) - TF.T.height(x - 3, z)) < 0.3) { const tt = TF.T.trenchAt(x, z, {}); if (tt.d > 6) { Object.assign(p, { x, z, y: TF.T.height(x, z), vy: 0 }); done = true; } } } if (done) break; }
  // face the most open way
  let yaw = p.yaw, far = 0; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, sx = -Math.sin(a), sz = -Math.cos(a); let d = 0; while (d < 40 && TF.T.height(p.x + sx * (d + 0.5), p.z + sz * (d + 0.5)) < p.y + 1.3) d += 0.5; if (d > far) { far = d; yaw = a; } }
  for (let i = 0; i < 40; i++) { TF.step({ yaw, pitch: 0, ads: true }, 1); TF.render(1 / 60); }
  const fp = TF.fp, K = fp.K, cam = TF.camera, fc = fp.cam || cam;
  // in the first-person pass the rifle lives in camera space: project its sight points with the camera's projection
  const proj = v => { const w = v.clone().applyMatrix4(fp.gun.matrixWorld); const c = w.clone().applyMatrix4(fp.rig.matrixWorld.clone().invert()); const q = new THREE.Vector3(c.x, c.y, c.z).applyMatrix4(cam.projectionMatrix); return [q.x * innerWidth / 2, q.y * innerHeight / 2]; };
  const r = proj(K.rear), t = proj(K.tip); TF.hold = true; return { rear: r.map(v => +v.toFixed(1)), tip: t.map(v => +v.toFixed(1)) }; })()`);
await shot('pickup_3_aiming_g98', 88); await ev('TF.hold = false; true');
ok('aiming the Gewehr 98: its sight line (the measured V-notch and post) is the line of sight', Math.hypot(...sight.rear) < 3 && Math.hypot(...sight.tip) < 3, JSON.stringify(sight) + ' (the screenshot shows the model itself)');
