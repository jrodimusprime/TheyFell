// First person: the player's own arms (the British soldier model, head and legs collapsed out of view) holding the SMLE.
// Hands are solved onto the rifle every frame (two-bone IK), so the right hand really works the bolt: up, back, forward,
// down after every shot, and the charger-clip reload. Drawn in its own pass after the world, so it never clips into walls.
import * as THREE from 'three';
import * as SU from 'three/addons/utils/SkeletonUtils.js';
import { makeRifleRig, twoBoneIK, aimBone } from './soldierSkin.js';

const lerp = (a, b, t) => a + (b - a) * t, ease = t => t * t * (3 - 2 * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, t) => a.clone().lerp(b, ease(Math.min(1, Math.max(0, t))));

// in the rifle's frame (origin at the butt plate, +Z to the muzzle, +Y up, -X the right side)
const GRIP_R = V(0, -0.045, 0.27), GRIP_L = V(0, -0.045, 0.62);
const KNOB = V(-0.055, -0.01, 0.392), KNOB_UP = V(-0.032, 0.033, 0.392), BOLT_TRAVEL = 0.09, CHARGER = V(0, 0.055, 0.37);

export class FirstPerson {
  constructor(skinned, sunDir) {
    const T = skinned.T.BRI;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xc7d6e8, 0x7a6e58, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4); sun.position.copy(sunDir).multiplyScalar(10); this.scene.add(sun);
    this.rig = new THREE.Group(); this.rig.matrixAutoUpdate = false; this.scene.add(this.rig);
    this.body = SU.clone(T.gltf.scene); this.rig.add(this.body);
    this.body.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
    this.bones = {}; this.body.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    for (const n of ['Head', 'thigh_l', 'thigh_r']) this.bones[n].scale.setScalar(0.0001);   // no head (the camera is in it), no legs
    // he faces +Z; the camera looks down -Z. Eyes at the camera.
    this.body.rotation.y = Math.PI; this.body.position.set(0, -1.68, 0.12);
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
  update(dt, camera, p, W, recoil, bob, moving) {
    this.rig.matrix.copy(camera.matrixWorld); this.rig.updateMatrixWorld(true);
    this.ads = lerp(this.ads, p.ads && !(p.reloading > 0) ? 1 : 0, Math.min(1, dt * 12));
    const a = ease(this.ads);
    // bolt cycle (after each shot) and reload progress
    const cyc = p.cool > 0 && W.cycle > 0.5 ? 1 - p.cool / W.cycle : -1;
    if (p.reloading > this.relLast + 1e-3) this.relTotal = p.reloading; this.relLast = p.reloading;
    const rel = p.reloading > 0 && this.relTotal > 0 ? 1 - p.reloading / this.relTotal : -1;
    // where the rifle is, in camera space: hip (low, right, angled in) to the shoulder with the sights on the eye line
    const hip = { pos: V(0.12, -0.2, 0.03), yaw: 0.1, pitch: 0.03, roll: 0.0 }, aim = { pos: V(0, -0.052, 0.13), yaw: 0, pitch: 0, roll: 0 };
    const sway = moving ? Math.sin(bob) * 0.012 : 0, bobY = moving ? Math.abs(Math.cos(bob)) * 0.01 : 0;
    const pos = hip.pos.clone().lerp(aim.pos, a).add(V(sway * (1 - a), bobY * (1 - a * 0.7) - recoil * 0.012, recoil * 0.06));
    let yaw = lerp(hip.yaw, aim.yaw, a), pitch = lerp(hip.pitch, aim.pitch, a) + recoil * 0.05, roll = 0;
    // working the bolt, he brings the rifle down a little off the shoulder and cants it; reloading, more so
    let k = 0; if (cyc >= 0) k = Math.sin(Math.min(1, cyc) * Math.PI); if (rel >= 0) k = Math.max(k, Math.min(1, Math.min(rel, 1 - rel) * 6));
    pos.add(V(0.02 * k, -0.04 * k, 0.02 * k)); roll += 0.28 * k; pitch += 0.06 * k;
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
    // arms: the clip for the body, then hands onto the rifle
    this.mixer.update(dt); this.body.updateMatrixWorld(true);
    const B = this.bones, w = v => v.clone().applyMatrix4(this.gun.matrixWorld);
    const up = V(0, 1, 0).transformDirection(this.rig.matrixWorld), right = V(1, 0, 0).transformDirection(this.rig.matrixWorld);
    twoBoneIK(B.upperarm_r, B.lowerarm_r, B.hand_r, w(hand), up.clone().multiplyScalar(-1).addScaledVector(right, 0.9));
    twoBoneIK(B.upperarm_l, B.lowerarm_l, B.hand_l, w(GRIP_L), up.clone().multiplyScalar(-1).addScaledVector(right, -0.35));
    const dir = V(0, 0, 1).transformDirection(this.gun.matrixWorld), rUp = V(0, 1, 0).transformDirection(this.gun.matrixWorld);
    for (const [h, f] of [['hand_r', 'middle_01_r'], ['hand_l', 'middle_01_l']]) {
      const hb = B[h], fb = B[f]; if (!hb || !fb) continue;
      aimBone(hb, fb.getWorldPosition(new THREE.Vector3()), hb.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.1).addScaledVector(rUp, -0.05));
    }
  }
}
