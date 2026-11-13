// Machine guns you can see: the German MG 08 on its sledge mount (Schlitten 08) and the British Vickers on its Mk IV
// tripod, both water-cooled and belt-fed, built here to their real proportions. Each sits on its emplacement with a
// horseshoe of sandbags and an ammunition box, the belt running from the box up into the feed. The working part
// (jacket, receiver, grips) traverses and elevates with the gun's aim; the crew's hands are put on its spade grips
// (gripsOf). Steam rises off a hot jacket.
// Gun frame: +Z is the muzzle, +Y up, origin at the pivot (the trunnion over the mount); the grips are at the rear.
import * as THREE from 'three';

const M = (c, r = 0.55, m = 0.45) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const STEEL = M(0x575b5e, 0.5, 0.2), DARK = M(0x34383a, 0.6, 0.2), BRONZE = M(0x5f5a48, 0.5, 0.25), WOOD = M(0x4c3828, 0.85, 0.05),
  CANVAS = M(0x8a7a58, 0.95, 0), BRASS = M(0xa88a45, 0.35, 0.8), BOX = M(0x4a4a3a, 0.8, 0.2), BAG = M(0xa8987a, 1, 0);
BAG.flatShading = true;
const BAG_G = new THREE.SphereGeometry(1, 9, 6);   // a sandbag: a lumpy, squashed round
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
const cyl = (r0, r1, len, mat, n = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, n), mat); m.rotation.x = Math.PI / 2; return m; };   // along +Z (r0 at the back, r1 at the front)
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

// the working part: water jacket, receiver, spade grips and thumb trigger, sights, feed block and the belt hanging from it
function gunBody(kind) {
  const g = new THREE.Group(), vk = kind === 'vickers';
  // receiver: a box behind the pivot
  g.add(box(0.105, 0.125, 0.34, STEEL, 0, 0.02, -0.12));
  g.add(box(0.11, 0.02, 0.34, DARK, 0, 0.09, -0.12));                                            // top cover
  // water jacket: forward of the receiver (the Vickers's corrugated)
  const jr = vk ? 0.058 : 0.05, jl = vk ? 0.62 : 0.58;
  g.add(at(cyl(jr, jr, jl, vk ? BRONZE : STEEL, 18), 0, 0.03, 0.05 + jl / 2));
  if (vk) for (let i = 0; i < 9; i++) g.add(at(cyl(jr + 0.006, jr + 0.006, 0.025, BRONZE, 18), 0, 0.03, 0.1 + i * 0.06));   // corrugations
  else for (const z of [0.07, 0.6]) g.add(at(cyl(jr + 0.008, jr + 0.008, 0.03, DARK, 16), 0, 0.03, z));                // jacket bands
  // muzzle: the recoil booster / flash cone, and the barrel's end
  g.add(at(cyl(0.03, vk ? 0.024 : 0.034, 0.1, DARK, 12), 0, 0.03, 0.05 + jl + 0.05));
  g.add(at(cyl(0.011, 0.011, 0.03, DARK, 8), 0, 0.03, 0.05 + jl + 0.115));
  // sights: the front blade on the jacket's muzzle end, the leaf rear sight on the receiver top
  g.add(box(0.006, 0.035, 0.01, DARK, 0, 0.03 + jr + 0.016, 0.05 + jl - 0.02));
  g.add(box(0.03, 0.05, 0.008, DARK, 0, 0.12, -0.22));
  // spade grips at the back, the thumb trigger between them
  for (const sx of [-1, 1]) { g.add(box(0.025, 0.11, 0.025, WOOD, sx * 0.065, 0.0, -0.36)); g.add(box(0.13, 0.016, 0.03, STEEL, 0, sx > 0 ? 0.06 : -0.06, -0.345)); }
  g.add(box(0.03, 0.03, 0.02, DARK, 0, 0.0, -0.33));
  // feed block on the right (the MG 08's from the right too), the belt hanging from it
  g.add(box(0.05, 0.06, 0.07, STEEL, -0.075, 0.03, -0.04));
  const belt = new THREE.Group(); belt.name = 'belt';
  const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push(new THREE.Vector3(-0.1 - u * 0.12, 0.02 - u * u * 0.5, -0.04 + u * 0.08)); }
  for (let i = 0; i < 10; i++) {
    const a = pts[i], b = pts[i + 1], m = box(0.05, 0.012, a.distanceTo(b) + 0.004, CANVAS); m.position.copy(a).lerp(b, 0.5); m.lookAt(b); belt.add(m);
    for (const k of [0.25, 0.75]) { const r = cyl(0.0055, 0.0045, 0.075, BRASS, 6); r.rotation.set(0, Math.PI / 2, 0); r.position.copy(a).lerp(b, k); r.position.y += 0.008; belt.add(r); }
  }
  g.add(belt);
  if (vk) {   // the condenser hose off the jacket, down towards the can
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, 0.06, 0.5), new THREE.Vector3(0.14, -0.05, 0.42), new THREE.Vector3(0.24, -0.3, 0.25)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.012, 6), M(0x2c2a22, 0.9, 0)));
  }
  g.userData = { muzzle: new THREE.Vector3(0, 0.03, 0.05 + jl + 0.13), gripL: new THREE.Vector3(0.065, 0.0, -0.36), gripR: new THREE.Vector3(-0.065, 0.0, -0.36),
    rear: new THREE.Vector3(0, 0.145, -0.22), feed: new THREE.Vector3(-0.1, 0.02, -0.04), jacket: new THREE.Vector3(0, 0.03 + jr, 0.4) };
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// the mount under the pivot, standing `h` m down to the ground: the MG 08's sledge (a folding frame with its front legs
// up), the Vickers's tripod (two legs spread behind, one forward)
function mount(kind, h) {
  const g = new THREE.Group(), vk = kind === 'vickers';
  g.add(box(0.12, 0.05, 0.14, STEEL, 0, -0.06, 0));                                        // the cradle under the gun
  const leg = (from, to, r = 0.016, mat = STEEL) => { const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), mat); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m); };
  const y0 = -0.08, yg = -h;
  if (vk) {
    leg([0, y0, 0], [0, yg, 0.6], 0.018); leg([0, y0, 0], [0.42, yg, -0.45], 0.018); leg([0, y0, 0], [-0.42, yg, -0.45], 0.018);
    g.add(box(0.06, 0.06, 0.06, DARK, 0, y0 - 0.02, 0));                                    // the crosshead
  } else {
    // the sledge: two runners on the ground, joined, the column up to the cradle, front legs braced forward
    for (const sx of [-1, 1]) { leg([sx * 0.22, yg + 0.03, -0.55], [sx * 0.22, yg + 0.03, 0.45], 0.017); leg([sx * 0.22, yg + 0.03, 0.45], [sx * 0.08, y0, 0.12], 0.015); leg([sx * 0.22, yg + 0.03, -0.45], [sx * 0.06, y0, -0.08], 0.015); }
    leg([-0.22, yg + 0.03, -0.55], [0.22, yg + 0.03, -0.55], 0.017); leg([-0.22, yg + 0.03, 0.2], [0.22, yg + 0.03, 0.2], 0.014);
    leg([0, yg + 0.03, -0.1], [0, y0, 0], 0.024, DARK);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
export class GunsView {
  constructor(scene, sim) {
    this.scene = scene; this.sim = sim; this.views = [];
    for (const gun of sim.guns) {
      const root = new THREE.Group(); root.position.set(gun.x, gun.by, gun.z);
      const body = gunBody(gun.kind); root.add(body);
      const base = new THREE.Group(); base.position.copy(root.position); base.rotation.y = gun.yaw0 + Math.PI;   // (the model faces +Z; yaw 0 faces -Z)
      const h = Math.max(0.15, Math.min(1.7, gun.by - gun.gy)), mnt = mount(gun.kind, h); base.add(mnt);
      const bags = new THREE.Group(); bags.position.copy(base.position); bags.rotation.y = base.rotation.y; scene.add(bags);
      // the emplacement: a horseshoe of sandbags at the gun's feet, an ammunition box by the loader with the belt running up
      const T = sim.T;
      for (let i = 0; i < 9; i++) {
        const a = (i - 4) * 0.33, r = 0.95 + (i % 2) * 0.06, lx = Math.sin(a) * r, lz = Math.cos(a) * r + 0.1;
        const wx = gun.x + lx * Math.cos(gun.yaw0 + Math.PI) + lz * Math.sin(gun.yaw0 + Math.PI), wz = gun.z - lx * Math.sin(gun.yaw0 + Math.PI) + lz * Math.cos(gun.yaw0 + Math.PI);
        const gy = T.height(wx, wz); if (gy > gun.by - 0.2) continue;   // (not where the parapet is already high)
        for (let j = 0; j < 2; j++) { const b = new THREE.Mesh(BAG_G, BAG); b.scale.set(0.31, 0.11, 0.18); b.position.set(lx, gy - gun.by + 0.09 + j * 0.17, lz); b.rotation.y = a + (j ? 0.2 : 0) + Math.PI / 2; b.castShadow = true; bags.add(b); }
      }
      const fx = -Math.sin(gun.yaw0), fz = -Math.cos(gun.yaw0), ax = gun.crew[0] - fz * 0.55 + fx * 0.35, az = gun.crew[1] + fx * 0.55 + fz * 0.35;
      const ammo = box(0.28, 0.2, 0.13, BOX); ammo.position.set(ax, T.height(ax, az) + 0.1, az); ammo.rotation.y = gun.yaw0; ammo.castShadow = true; scene.add(ammo);
      if (gun.kind === 'vickers') { const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12), M(0x3a3e34, 0.7, 0.3)); const cx2 = gun.x - fz * 0.45 - fx * 0.1, cz2 = gun.z + fx * 0.45 - fz * 0.1; can.position.set(cx2, T.height(cx2, cz2) + 0.15, cz2); scene.add(can); }
      // the gunner's crate, where the parapet is high
      if (gun.lift > 0.05) { const c = box(0.5, gun.lift, 0.36, WOOD); c.position.set(gun.crew[0], T.height(gun.crew[0], gun.crew[1]) + gun.lift / 2, gun.crew[1]); c.rotation.y = gun.yaw0; c.castShadow = c.receiveShadow = true; scene.add(c); }
      scene.add(root); scene.add(base);
      this.views.push({ gun, root, body, base, mnt, bags, ammo, steamT: 0 });
    }
  }
  // the working part follows the gun's aim; hidden while the player is on it (his own is drawn in first person)
  update(dt, fx, playerId, showPlayers = false) {
    for (const v of this.views) {
      const g = v.gun;
      _e.set(-g.aimPitch, g.aimYaw + Math.PI, 0); v.root.quaternion.setFromEuler(_e);
      // the shake of a gun firing
      if (g.cool > 0 && g.trigger) { v.root.position.set(g.x + (Math.random() - 0.5) * 0.006, g.by + (Math.random() - 0.5) * 0.006, g.z + (Math.random() - 0.5) * 0.006); } else v.root.position.set(g.x, g.by, g.z);
      if (g.yaw0 !== v.yaw0) { v.yaw0 = g.yaw0; v.base.rotation.y = g.yaw0 + Math.PI; v.bags.rotation.y = g.yaw0 + Math.PI; }   // (a taken gun swung round)
      const mine = g.gunner === playerId && !showPlayers && this.sim.soldiers[playerId]?.gun === g.id;
      v.root.visible = !mine; v.base.visible = !mine;   // (his own drawn in first person; its legs would run through his view)
      v.root.updateMatrixWorld(true);
      // steam off a jacket that has boiled
      if (fx && g.heat > 0.55 && (v.steamT -= dt) <= 0) { v.steamT = 0.12 + (1 - g.heat) * 0.5; const p = v.body.userData.jacket.clone().applyMatrix4(v.root.matrixWorld); fx.smoke.add(fx.time, p.x, p.y + 0.04, p.z, (Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2, 0.92, 0.92, 0.92, false, 1.4, 0.08, 0.7); }
    }
  }
  // world positions of a gun's grips, feed and muzzle (for the crew's hands, the flash)
  gripsOf(id) {
    const v = this.views[id]; if (!v) return null; const u = v.body.userData, m = v.root.matrixWorld;
    return { gripL: u.gripL.clone().applyMatrix4(m), gripR: u.gripR.clone().applyMatrix4(m), feed: u.feed.clone().applyMatrix4(m), muzzle: u.muzzle.clone().applyMatrix4(m), quat: v.root.getWorldQuaternion(new THREE.Quaternion()) };
  }
}
export { gunBody };
