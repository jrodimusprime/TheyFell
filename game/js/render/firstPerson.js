// First person: the player's own arms (the British soldier model, head and legs collapsed out of view) holding the SMLE.
// Hands are solved onto the rifle every frame (two-bone IK), so the right hand really works the bolt: up, back, forward,
// down after every shot, and the charger-clip reload. Drawn in its own pass after the world, so it never clips into walls.
import * as THREE from 'three';
import * as SU from 'three/addons/utils/SkeletonUtils.js';
import { makeRifleRig, twoBoneIK, bakeSoldier } from './soldierSkin.js';
import { Hands, GRIPS, blendGrip } from './hands.js';

const lerp = (a, b, t) => a + (b - a) * t, ease = t => t * t * (3 - 2 * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, t) => a.clone().lerp(b, ease(Math.min(1, Math.max(0, t))));

// in the rifle's frame (origin at the butt plate, +Z to the muzzle, +Y up, -X the right side)
const GRIP_R = V(0, -0.045, 0.27), GRIP_L = V(0, -0.045, 0.54);
const KNOB = V(-0.055, -0.01, 0.392), KNOB_UP = V(-0.032, 0.033, 0.392), BOLT_TRAVEL = 0.09, CHARGER = V(0, 0.055, 0.37);

export class FirstPerson {
  constructor(skinned, sunDir) {
    const T = skinned.T.BRI;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xc7d6e8, 0x7a6e58, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4); sun.position.copy(sunDir).multiplyScalar(10); this.scene.add(sun);
    this.rig = new THREE.Group(); this.rig.matrixAutoUpdate = false; this.scene.add(this.rig);
    this.body = SU.clone(T.gltf.scene);
    // the player's own arms get their own finer texture (skin creases, nails, knuckles, serge twill) with relief,
    // and smooth shading so the low-poly gloves read as rounded hands
    this.body.traverse(o => { if (o.isSkinnedMesh) { o.geometry = smoothNormals(roundHands(smoothNormals(o.geometry.toNonIndexed()), o.skeleton.bones, 2)); o.material = o.material.clone(); o.material.map = T.gltf.scene.getObjectByProperty('isSkinnedMesh', true).material.map; } });
    const tex = bakeSoldier({ scene: this.body }, 'BRI', 1, null, { detail: true, res: 2 });
    if (tex) { const cv = tex.userData.canvas, nm = new THREE.DataTexture(reliefFrom(cv, 5), cv.width, cv.height, THREE.RGBAFormat); nm.flipY = tex.flipY; nm.needsUpdate = true; nm.generateMipmaps = true; nm.minFilter = THREE.LinearMipmapLinearFilter; nm.magFilter = THREE.LinearFilter;
      this.body.traverse(o => { if (o.isSkinnedMesh) { o.material.normalMap = nm; o.material.normalScale.set(0.6, 0.6); o.material.roughness = 0.8; o.material.needsUpdate = true; } }); }
    this.rig.add(this.body);
    this.body.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
    this.bones = {}; this.body.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.hands = new Hands(this.bones, this.body);   // measured in the rest pose, before anything moves
    for (const n of ['Head', 'thigh_l', 'thigh_r']) this.bones[n].scale.setScalar(0.0001);   // no head (the camera is in it), no legs
    // he faces +Z; the camera looks down -Z. Eyes at the camera.
    this.body.rotation.y = Math.PI; this.body.position.set(0, -1.66, 0.03);   // shoulders just behind and below the eyes
    this.gun = makeRifleRig(T.gun, 'smle'); this.rig.add(this.gun);
    // a working bolt on the right of the receiver: body, handle and knob, slides and turns
    const steel = new THREE.MeshStandardMaterial({ color: 0x2f3134, roughness: 0.35, metalness: 0.8 });
    this.bolt = new THREE.Group(); this.gun.add(this.bolt);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.13, 10), steel); body.rotation.x = Math.PI / 2; body.position.set(-0.012, 0.004, 0.40); this.bolt.add(body);
    this.handle = new THREE.Group(); this.handle.position.set(-0.012, 0.004, 0.392); this.bolt.add(this.handle);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.05, 8), steel); arm.rotation.z = Math.PI / 2; arm.position.set(-0.026, -0.008, 0); this.handle.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), steel); knob.position.set(-0.045, -0.014, 0); this.handle.add(knob);
    this.mixer = new THREE.AnimationMixer(this.body); const idle = T.gltf.animations.find(a => a.name === 'Idle_Loop'); if (idle) this.mixer.clipAction(idle).play();
    this.ads = 0; this.relTotal = 0; this.relLast = 0; this.bob = 0;
  }
  // block: how far ahead (m) the nearest wall, bank or man is along the rifle's line (Infinity if clear)
  update(dt, camera, p, W, recoil, bob, moving, block = Infinity) {
    this.rig.matrix.copy(camera.matrixWorld); this.rig.updateMatrixWorld(true);
    // the rifle can't go through things: when something is closer than the muzzle would reach, pull the rifle back and up
    const reach = lerp(1.0, 0.85, this.ads), want = Math.min(1, Math.max(0, (reach - block) / 0.55));
    this.pull = lerp(this.pull || 0, want, Math.min(1, dt * 14));
    this.ads = lerp(this.ads, p.ads && !(p.reloading > 0) && this.pull < 0.4 ? 1 : 0, Math.min(1, dt * 12));
    const a = ease(this.ads);
    // bolt cycle (after each shot) and reload progress
    const cyc = p.cool > 0 && W.cycle > 0.5 ? 1 - p.cool / W.cycle : -1;
    if (p.reloading > this.relLast + 1e-3) this.relTotal = p.reloading; this.relLast = p.reloading;
    const rel = p.reloading > 0 && this.relTotal > 0 ? 1 - p.reloading / this.relTotal : -1;
    // where the rifle is, in camera space: hip (low, right, angled in) to the shoulder with the sights on the eye line
    const hip = { pos: V(0.1, -0.2, 0.13), yaw: 0.12, pitch: 0.05, roll: 0.0 }, aim = { pos: V(0, -0.052, 0.13), yaw: 0, pitch: 0, roll: 0 };
    const sway = moving ? Math.sin(bob) * 0.012 : 0, bobY = moving ? Math.abs(Math.cos(bob)) * 0.01 : 0;
    const pos = hip.pos.clone().lerp(aim.pos, a).add(V(sway * (1 - a), bobY * (1 - a * 0.7) - recoil * 0.012, recoil * 0.06));
    let yaw = lerp(hip.yaw, aim.yaw, a), pitch = lerp(hip.pitch, aim.pitch, a) + recoil * 0.05, roll = 0;
    // working the bolt, he brings the rifle down a little off the shoulder and cants it; reloading, more so
    let k = 0; if (cyc >= 0) k = Math.sin(Math.min(1, cyc) * Math.PI); if (rel >= 0) k = Math.max(k, Math.min(1, Math.min(rel, 1 - rel) * 6));
    pos.add(V(0.02 * k, -0.04 * k, 0.02 * k)); roll += 0.28 * k; pitch += 0.06 * k;
    { const u = ease(this.pull); pos.add(V(-0.02 * u, 0.04 * u, 0.32 * u)); pitch += 0.95 * u; yaw -= 0.1 * u; }   // up against a wall: rifle drawn back, muzzle up
    if (rel >= 0) { pos.add(V(0.03, 0.03, 0).multiplyScalar(k)); roll += 0.25 * k; yaw -= 0.15 * k; }
    // the rifle group: +Z is the muzzle, so turn it to look down -Z, then yaw/pitch/roll
    this.gun.position.copy(pos);
    this.gun.quaternion.setFromEuler(new THREE.Euler(-pitch, Math.PI + yaw, roll, 'YXZ'));
    this.gun.updateMatrixWorld(true);
    // bolt: lift (turn) and slide
    let lift = 0, back = 0, hand = GRIP_R.clone();
    const knobAt = (l, b) => KNOB.clone().lerp(KNOB_UP, l).add(V(0, 0, -b));
    if (cyc >= 0) {
      const t = cyc;
      if (t < 0.15) hand = lerpV(GRIP_R, KNOB, t / 0.15);
      else if (t < 0.28) { lift = ease((t - 0.15) / 0.13); hand = knobAt(lift, 0); }
      else if (t < 0.45) { lift = 1; back = ease((t - 0.28) / 0.17) * BOLT_TRAVEL; hand = knobAt(1, back); }
      else if (t < 0.62) { lift = 1; back = (1 - ease((t - 0.45) / 0.17)) * BOLT_TRAVEL; hand = knobAt(1, back); }
      else if (t < 0.74) { lift = 1 - ease((t - 0.62) / 0.12); hand = knobAt(lift, 0); }
      else hand = lerpV(KNOB, GRIP_R, (t - 0.74) / 0.26);
    } else if (rel >= 0) {
      // open the bolt, thumb a charger in (twice for 10 rounds), close it
      const t = rel;
      if (t < 0.06) hand = lerpV(GRIP_R, KNOB, t / 0.06);
      else if (t < 0.12) { lift = ease((t - 0.06) / 0.06); hand = knobAt(lift, 0); }
      else if (t < 0.18) { lift = 1; back = ease((t - 0.12) / 0.06) * BOLT_TRAVEL; hand = knobAt(1, back); }
      else if (t < 0.82) { lift = 1; back = BOLT_TRAVEL; const u = (t - 0.18) / 0.64, c = (u * 2) % 1; hand = c < 0.3 ? lerpV(knobAt(1, back), CHARGER.clone().add(V(0, 0.05, 0)), c / 0.3) : CHARGER.clone().add(V(0, 0.05 - Math.sin(Math.min(1, (c - 0.3) / 0.5) * Math.PI) * 0.06, 0)); }
      else if (t < 0.88) { lift = 1; back = (1 - ease((t - 0.82) / 0.06)) * BOLT_TRAVEL; hand = knobAt(1, back); }
      else if (t < 0.93) { lift = 1 - ease((t - 0.88) / 0.05); hand = knobAt(lift, 0); }
      else hand = lerpV(KNOB, GRIP_R, (t - 0.93) / 0.07);
    }
    this.handle.rotation.z = -lift * 1.35; this.bolt.position.z = -back;
    // arms: the clip for the body, then each wrist placed so the hand (oriented for its grip) closes on the rifle
    this.mixer.update(dt); this.body.updateMatrixWorld(true);
    const B = this.bones, G = this.gun.matrixWorld, w = v => v.clone().applyMatrix4(G), d = v => v.clone().transformDirection(G);
    const up = V(0, 1, 0).transformDirection(this.rig.matrixWorld), right = V(1, 0, 0).transformDirection(this.rig.matrixWorld);
    // right hand: on the stock (fingers round under the wrist of the stock, palm on its right side) or at the bolt / charger
    const away = Math.min(1, hand.distanceTo(GRIP_R) / 0.05), pressing = rel >= 0.18 && rel < 0.82 && hand.y > KNOB_UP.y + 0.01;
    const Fr = d(V(0.15, -0.8, 0.55)).lerp(pressing ? d(V(-0.1, -0.35, 0.9)) : d(V(0.25, -0.2, 0.95)), away).normalize();
    const Nr = d(V(1, 0, 0)).lerp(pressing ? d(V(0, -1, 0)) : d(V(0.7, -0.3, 0.2)), away).normalize();
    const gripR = blendGrip(GRIPS.stock, pressing ? GRIPS.press : GRIPS.pinch, away);
    // left hand: palm up under the fore-end, fingers across to the far side
    const Fl = d(V(-0.75, 0.1, 0.65)).normalize(), Nl = d(V(0, 1, 0));
    const wrist = (grip, F, N, palm = 0.03, reach = 0.055) => w(grip).addScaledVector(N, -palm).addScaledVector(F, -reach);
    twoBoneIK(B.upperarm_r, B.lowerarm_r, B.hand_r, wrist(hand, Fr, Nr, away > 0.5 ? 0.015 : 0.035, away > 0.5 ? 0.075 : 0.05), up.clone().multiplyScalar(-1).addScaledVector(right, 0.9));
    twoBoneIK(B.upperarm_l, B.lowerarm_l, B.hand_l, wrist(GRIP_L, Fl, Nl, 0.035, 0.05), up.clone().multiplyScalar(-1).addScaledVector(right, -0.35));
    this.hands.orient('r', Fr, Nr); this.hands.orient('l', Fl, Nl);
    this.hands.curl('r', gripR); this.hands.curl('l', GRIPS.foreend);
  }
}

// average the normals of vertices that share a position (the mesh keeps its UV seams), so facets shade smoothly
function smoothNormals(g) {
  const pos = g.attributes.position, nor = g.attributes.normal, map = new Map(), acc = [];
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
    let a = map.get(k); if (!a) { a = new THREE.Vector3(); map.set(k, a); } a.x += nor.getX(i); a.y += nor.getY(i); a.z += nor.getZ(i); acc.push(a);
  }
  for (let i = 0; i < pos.count; i++) { const a = acc[i].clone().normalize(); nor.setXYZ(i, a.x, a.y, a.z); }
  nor.needsUpdate = true; return g;
}

// a normal map from a painted canvas: brightness read as height (creases dark, weave ridges light)
function reliefFrom(cv, strength) {
  const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data, h = new Float32Array(W * H), out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) h[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const at = (x, y) => h[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), k = (y * W + x) * 4;
    out[k] = (-dx / l * 0.5 + 0.5) * 255; out[k + 1] = (-dy / l * 0.5 + 0.5) * 255; out[k + 2] = (1 / l * 0.5 + 0.5) * 255; out[k + 3] = 255;
  }
  return out;
}

// subdivide the hands' triangles (each into 4, `levels` times), placing the new points on the curved surface the normals
// describe (the sagitta of a circular arc), so blocky fingers and knuckles round off; skin weights carried across
function roundHands(g, bones, levels) {
  const isHand = n => /hand_|index_|middle_|ring_|pinky_|thumb_/.test(n);
  for (let lv = 0; lv < levels; lv++) {
    const A = g.attributes, P = A.position, N = A.normal, UV = A.uv, SI = A.skinIndex, SW = A.skinWeight, out = { p: [], n: [], uv: [], si: [], sw: [] };
    const V = i => ({ p: new THREE.Vector3().fromBufferAttribute(P, i), n: new THREE.Vector3().fromBufferAttribute(N, i), uv: [UV.getX(i), UV.getY(i)], si: [SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)], sw: [SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)] });
    const push = v => { out.p.push(v.p.x, v.p.y, v.p.z); out.n.push(v.n.x, v.n.y, v.n.z); out.uv.push(...v.uv); out.si.push(...v.si); out.sw.push(...v.sw); };
    const mid = (a, b) => {
      const m = a.p.clone().add(b.p).multiplyScalar(0.5), nn = a.n.clone().add(b.n).normalize();
      m.addScaledVector(nn, 0.125 * b.p.clone().sub(a.p).dot(b.n.clone().sub(a.n)));
      // skin weights: the two ends' influences averaged, best four kept, in a fixed order (so neighbouring triangles agree)
      const acc = new Map(); for (const v of [a, b]) v.si.forEach((bi, k) => { if (v.sw[k] > 0) acc.set(bi, (acc.get(bi) || 0) + v.sw[k] / 2); });
      const top = [...acc].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, 4), tot = top.reduce((t, x) => t + x[1], 0) || 1;
      while (top.length < 4) top.push([0, 0]);
      return { p: m, n: nn, uv: [(a.uv[0] + b.uv[0]) / 2, (a.uv[1] + b.uv[1]) / 2], si: top.map(x => x[0]), sw: top.map(x => x[1] / tot) };
    };
    const dominant = v => { let k = 0; for (let j = 1; j < 4; j++) if (v.sw[j] > v.sw[k]) k = j; return bones[v.si[k]] ? bones[v.si[k]].name : ''; };
    for (let t = 0; t < P.count; t += 3) {
      const a = V(t), b = V(t + 1), c = V(t + 2);
      if (!(isHand(dominant(a)) || isHand(dominant(b)) || isHand(dominant(c)))) { push(a); push(b); push(c); continue; }
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      for (const tri of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) tri.forEach(push);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(out.p, 3)); ng.setAttribute('normal', new THREE.Float32BufferAttribute(out.n, 3));
    ng.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2)); ng.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.si, 4)); ng.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.sw, 4));
    g = ng;
  }
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);   // the uniform painter walks indexed triangles
  return g;
}
