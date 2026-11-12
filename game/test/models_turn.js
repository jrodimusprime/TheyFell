// Turntable review of one soldier at a time: front, three-quarter, back. TF_SIDE = BRI or GER, TF_CLIP = animation
const side = (await ev(`location.search`)).match(/side=(\w+)/)?.[1] || 'BRI', clip = (await ev(`location.search`)).match(/clip=(\w+)/)?.[1] || 'Rifle_Idle';
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'r';
await ev(`(async () => {
  const THREE = await import('three'); const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); const SU = await import('three/addons/utils/SkeletonUtils.js');
  const SK = await import('./js/render/soldierSkin.js?' + Date.now()); const { bakeSoldier, addBrodie, makeRifleRig, holdRifle, loadFaces } = SK; if (location.search.includes('labels')) SK.setDebugLabels(true);
  const faces = await loadFaces();
  const L = new GLTFLoader(), load = u => new Promise((res, rej) => L.load(u, res, undefined, rej));
  const g = await load('models/characters/soldier_${side === 'BRI' ? 'british' : 'german'}.glb'), gun = await load('models/weapons/${side === 'BRI' ? 'lee_enfield' : 'kar98k'}.glb');
  bakeSoldier(g, '${side}', 1, faces); if ('${side}' === 'BRI') addBrodie(g);
  const p = TF.sim.player, x = p.x - 40, z = p.z + 15, o = SU.clone(g.scene);
  o.position.set(x, TF.T.height(x, z), z); o.rotation.y = Math.PI / 2; /* facing east, into the morning sun */ TF.scene.add(o); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
  const mix = new THREE.AnimationMixer(o), a = g.animations.find(a => a.name === '${clip}'); if (a) mix.clipAction(a).play(); mix.update(0.5);
  // the rifle is held by IK, not the clip's weapon bone
  const gun3 = makeRifleRig(gun.scene, '${side}' === 'BRI' ? 'smle' : 'g98'); o.add(gun3);
  const pose = '${clip}'.includes('Aim') || '${clip}'.includes('Shoot') ? 'aim' : '${clip}'.includes('Walk') || '${clip}'.includes('Run') ? 'port' : 'low';
  holdRifle(o, gun3, pose, 0);
  window.__doll = o; return true; })()`);
for (const [name, ang, dist, h] of [['front', 0, 2.6, 1.45], ['quarter', 0.8, 2.4, 1.5], ['back', Math.PI, 2.6, 1.45], ['face', 0.12, 0.75, 1.64]]) {
  await ev(`(() => { const o = __doll.position, a = ${ang} + Math.PI / 2; TF.view = { pos: [o.x + Math.sin(a) * ${dist}, o.y + ${h}, o.z + Math.cos(a) * ${dist}], look: [o.x, o.y + ${h > 1.6 ? 1.62 : 1.0}, o.z] }; TF.render(0.03); TF.settle(); for (let i = 0; i < 6; i++) TF.render(0.03); return true; })()`);
  await shot(`${tag}_${side}_${name}`, 92);
}
