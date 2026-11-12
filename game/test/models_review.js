// Model review: the skinned soldiers with their baked uniforms, lined up in the trench line for a close look.
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'r';
await ev(`(async () => {
  const THREE = await import('three'); const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); const SU = await import('three/addons/utils/SkeletonUtils.js');
  const { bakeSoldier, addBrodie } = await import('./js/render/soldierSkin.js');
  const L = new GLTFLoader(), load = u => new Promise((res, rej) => L.load(u, res, undefined, rej));
  const [bri, ger, le, k98] = await Promise.all([load('models/characters/soldier_british.glb'), load('models/characters/soldier_german.glb'), load('models/weapons/lee_enfield.glb'), load('models/weapons/kar98k.glb')]);
  bakeSoldier(bri, 'BRI'); bakeSoldier(ger, 'GER'); addBrodie(bri);
  const S = TF.sim, p = S.player, scene = TF.scene;
  // a clear stretch of ground behind the British line
  const ox = p.x - 40, oz = p.z + 10, yaw = Math.PI, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  window.__dolls = [];
  const place = (gltf, gun, clip, side, fwd, t = 0.4) => { const o = SU.clone(gltf.scene); const x = ox + fx * fwd + rx * side, z = oz + fz * fwd + rz * side;
    o.position.set(x, TF.T.height(x, z), z); o.rotation.y = yaw; scene.add(o); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    const mix = new THREE.AnimationMixer(o), a = gltf.animations.find(a => a.name === clip); if (a) mix.clipAction(a).play(); mix.update(t);
    const mount = o.getObjectByName('RifleMount'); if (mount) { const r = gun.scene.clone(); if (gun === le) r.position.set(-0.005, -0.069, 0.565); else { r.position.set(-0.042, -0.053, 0.555); for (const n of ['Clip', 'Bullet1', 'Bullet2', 'Bullet3', 'Bullet4', 'Bullet5']) { const b = r.getObjectByName(n); if (b) b.visible = false; } } mount.add(r); }
    __dolls.push(o); return o; };
  place(bri, le, 'Rifle_Idle', -1.8, 5); place(ger, k98, 'Rifle_Idle', -0.6, 5); place(bri, le, 'Rifle_Aim', 0.6, 5); place(ger, k98, 'Rifle_Walk', 1.8, 5, 0.3);
  place(bri, le, 'Rifle_Kneel_Aim', -1.2, 7); place(ger, k98, 'Rifle_Crouch_Idle', 1.2, 7);
  window.__rev = { ox, oz, fx, fz, rx, rz };
  return true; })()`);
const view = async (name, cam, look) => { await ev(`(() => { const R = __rev, at = (s, f, h) => { const x = R.ox + R.fx * f + R.rx * s, z = R.oz + R.fz * f + R.rz * s; return [x, TF.T.height(x, z) + h, z]; };
  TF.view = { pos: at(...${JSON.stringify(cam)}), look: at(...${JSON.stringify(look)}) }; TF.render(0.03); TF.settle(); for (let i = 0; i < 6; i++) TF.render(0.03); return true; })()`); await shot(`${tag}_${name}`, 92); };
await view('lineup', [0, 0.4, 1.4], [0, 5, 1.0]);
await view('british_face', [-1.8, 3.9, 1.65], [-1.8, 5, 1.55]);
await view('german_face', [-0.6, 3.9, 1.65], [-0.6, 5, 1.55]);
await view('backs', [0, 9.6, 1.5], [0, 5, 1.0]);
