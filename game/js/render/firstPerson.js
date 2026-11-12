// First person: the player's own arms (the British soldier model, head and legs collapsed out of view) holding the SMLE.
// Hands are solved onto the rifle every frame (two-bone IK), so the right hand really works the bolt: up, back, forward,
// down after every shot, and the charger-clip reload. Drawn in its own pass after the world, so it never clips into walls.
import * as THREE from 'three';
import * as SU from 'three/addons/utils/SkeletonUtils.js';
import { makeRifleRig, twoBoneIK, bakeSoldier } from './soldierSkin.js';
import { Hands, GRIPS, blendGrip } from './hands.js';
import { POSES } from './xrHands.js';

const lerp = (a, b, t) => a + (b - a) * t, ease = t => t * t * (3 - 2 * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, t) => a.clone().lerp(b, ease(Math.min(1, Math.max(0, t))));

// in the rifle's frame (origin at the butt plate, +Z to the muzzle, +Y up, -X the right side)
const GRIP_R = V(0, -0.045, 0.27), GRIP_L = V(0, -0.045, 0.54);
// sights of the Lee-Enfield model, measured from its mesh (rifle frame): centre of the rear aperture, tip of the foresight blade
const SIGHT_REAR = V(-0.0015, 0.022, 0.342), SIGHT_TIP = V(-0.0002, 0.0179, 1.075), EYE_RELIEF = 0.21;
const KNOB = V(-0.055, -0.01, 0.392), KNOB_UP = V(-0.032, 0.033, 0.392), BOLT_TRAVEL = 0.09, CHARGER = V(0, 0.055, 0.37);

export class FirstPerson {
  constructor(skinned, sunDir) {
    const T = skinned.T.BRI;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xb9c6d6, 0x4a4234, 0.95));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.9); sun.position.copy(sunDir).multiplyScalar(10); this.scene.add(sun);
    this.rig = new THREE.Group(); this.rig.matrixAutoUpdate = false; this.scene.add(this.rig);
    this.body = SU.clone(T.gltf.scene);
    // the player's own arms get their own finer texture (skin creases, nails, knuckles, serge twill) with relief,
    // and smooth shading so the low-poly gloves read as rounded hands
    this.body.traverse(o => { if (o.isSkinnedMesh) { o.geometry = smoothNormals(roundHands(smoothNormals(o.geometry.toNonIndexed()), o.skeleton.bones, 2)); o.material = o.material.clone(); o.material.map = T.gltf.scene.getObjectByProperty('isSkinnedMesh', true).material.map; } });
    const tex = bakeSoldier({ scene: this.body }, 'BRI', 1, null, { detail: true, res: 2 });
    if (tex) { const cv = tex.userData.canvas, nm = new THREE.DataTexture(reliefFrom(cv, 5), cv.width, cv.height, THREE.RGBAFormat); nm.flipY = tex.flipY; nm.needsUpdate = true; nm.generateMipmaps = true; nm.minFilter = THREE.LinearMipmapLinearFilter; nm.magFilter = THREE.LinearFilter;
      this.body.traverse(o => { if (o.isSkinnedMesh) { o.material.normalMap = nm; o.material.normalScale.set(0.6, 0.6); o.material.roughness = 0.8; o.material.needsUpdate = true; } }); }
    this.body.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; });   // no helmet or kit round the camera
    // only the arms are drawn in first person (the chest and shoulders sit round the camera): mark each vertex by the bone
    // that carries it and discard everything that isn't sleeve or hand
    this.body.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = o.skeleton.bones, arm = new Float32Array(si.count);
      for (let i = 0; i < si.count; i++) { let k = 0; for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, k)) k = j; const bn = bones[si.getComponent(i, k)].name; arm[i] = /lowerarm_r|hand_r|_r$/.test(bn) && !/upperarm/.test(bn) ? 2 : /upperarm|lowerarm|hand_|index_|middle_|ring_|pinky_|thumb_/.test(bn) ? 1 : 0; }
      g.setAttribute('aArm', new THREE.BufferAttribute(arm, 1));
      const hideRight = this.hideRight || (this.hideRight = { value: 0 });
      o.material.onBeforeCompile = sh => {
        sh.uniforms.uHideRight = hideRight;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aArm; varying float vArm;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvArm = aArm;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vArm; uniform float uHideRight;').replace('void main() {', 'void main() {\n  if (vArm < 0.5 || (uHideRight > 0.5 && vArm > 1.5)) discard;');
      };
      o.material.needsUpdate = true;
    });
    this.rig.add(this.body);
    this.body.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
    this.bones = {}; this.body.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.hands = new Hands(this.bones, this.body);   // measured in the rest pose, before anything moves
    // the real hands: rigged left and right hands fitted at the sleeve's wrists; the model's own glove hands collapsed away
    this.xr = skinned.xrHands || null;
    if (this.xr) {
      for (const [s, h] of [['l', this.xr.left], ['r', this.xr.right]]) {
        this.scene.add(h.object); h.object.updateMatrixWorld(true);
        const P = n => h.bones[n].getWorldPosition(new THREE.Vector3());
        h.wristLocal = P('wrist'); h.fingersLocal = P('middle-finger-phalanx-proximal').sub(h.wristLocal).normalize();
        h.palmLocal = h.palm.clone().addScaledVector(h.fingersLocal, -h.palm.dot(h.fingersLocal)).normalize();
        h.palmCentreLocal = h.palmCentre();
        // the wrist: a serge cuff from the forearm over the base of the hand, closing the hand's open end; flattened like a
        // real wrist and turned with the palm, so the join follows the hand
        const wide = P('index-finger-metacarpal').distanceTo(P('pinky-finger-metacarpal')) + 0.03;
        const g = new THREE.CylinderGeometry(1.32, 1.0, 1, 20, 4, true); g.translate(0, 0.5, 0);   // 0 at the wrist, 1 at the elbow (fuller there)
        const cuff = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x6f6142, roughness: 1, side: THREE.DoubleSide, map: sergeTexture() });
        cuff.add(new THREE.Mesh(g, m));
        cuff.userData = { wide }; this.scene.add(cuff); h.cuff = cuff;
      }
    }
    for (const n of ['Head', 'thigh_l', 'thigh_r']) this.bones[n].scale.setScalar(0.0001);   // no head (the camera is in it), no legs
    // he faces +Z; the camera looks down -Z. Eyes at the camera.
    this.body.rotation.y = Math.PI; this.body.position.set(0, -1.66, 0.03);   // shoulders just behind and below the eyes
    // both rifles a man may carry (his own, or one picked up from the fallen): each with its own sight line, eye relief,
    // bolt and grips. Gewehr 98 (measured off the model): V-notch bottom 0.595 m from the butt, front post tip 1.085 m
    const smle = makeRifleRig(T.gun, 'smle'), g98 = makeRifleRig(skinned.T.GER.gun, 'g98'); this.rig.add(smle, g98); g98.visible = false;
    this.gun = smle;
    // a working bolt on the right of the receiver: body, handle and knob, slides and turns
    const steel = new THREE.MeshStandardMaterial({ color: 0x2f3134, roughness: 0.35, metalness: 0.8 });
    this.bolt = new THREE.Group(); this.gun.add(this.bolt);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.13, 10), steel); body.rotation.x = Math.PI / 2; body.position.set(-0.012, 0.004, 0.40); this.bolt.add(body);
    this.handle = new THREE.Group(); this.handle.position.set(-0.012, 0.004, 0.392); this.bolt.add(this.handle);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.05, 8), steel); arm.rotation.z = Math.PI / 2; arm.position.set(-0.026, -0.008, 0); this.handle.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), steel); knob.position.set(-0.045, -0.014, 0); this.handle.add(knob);
    this.kinds = {
      smle: { gun: smle, bolt: this.bolt, handle: this.handle, rear: SIGHT_REAR, tip: SIGHT_TIP, eye: EYE_RELIEF, knob: KNOB, knobUp: KNOB_UP, travel: BOLT_TRAVEL, charger: CHARGER, gripR: GRIP_R, gripL: GRIP_L },
      g98: { gun: g98, bolt: new THREE.Group(), handle: new THREE.Group(), rear: V(0, 0.0205, 0.595), tip: V(0.0001, 0.0253, 1.085), eye: 0.44,
        knob: V(-0.06, -0.025, 0.40), knobUp: V(-0.036, 0.03, 0.40), travel: 0.1, charger: V(0, 0.05, 0.42), gripR: V(0, -0.045, 0.28), gripL: V(0, -0.045, 0.6) },
    };
    this.setKind('smle');
    this.mixer = new THREE.AnimationMixer(this.body); const idle = T.gltf.animations.find(a => a.name === 'Idle_Loop'); if (idle) this.mixer.clipAction(idle).play();
    this.ads = 0; this.relTotal = 0; this.relLast = 0; this.bob = 0;
  }
  setKind(k) {
    if (this.kindName === k || !this.kinds[k]) return;
    this.kindName = k; this.K = this.kinds[k];
    for (const [n, q] of Object.entries(this.kinds)) q.gun.visible = n === k;
    this.gun = this.K.gun; this.bolt = this.K.bolt; this.handle = this.K.handle;
  }
  // block: how far ahead (m) the nearest wall, bank or man is along the rifle's line (Infinity if clear)
  update(dt, camera, p, W, recoil, bob, moving, block = Infinity) {
    this.setKind(p.weapon === 'g98' ? 'g98' : 'smle');   // (swapped while it is down out of sight, stooping for another)
    const { rear: SIGHT_REAR, tip: SIGHT_TIP, eye: EYE_RELIEF, knob: KNOB, knobUp: KNOB_UP, travel: BOLT_TRAVEL, charger: CHARGER, gripR: GRIP_R, gripL: GRIP_L } = this.K;
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
    // stooping for another man's rifle: his own goes down out of sight, the other comes up in its place
    if (p.pickup > 0) { const u = 1 - p.pickup / (p.pickupTotal || 66), dn = Math.sin(Math.min(1, u) * Math.PI); pos.add(V(0.06 * dn, -0.6 * dn, 0.12 * dn)); pitch -= 0.7 * dn; roll += 0.5 * dn; }
    // the rifle group: +Z is the muzzle, so turn it to look down -Z, then yaw/pitch/roll
    // the hip / working pose, then blended onto the exact sight picture: the rifle turned so the line from the centre of
    // the rear aperture to the tip of the foresight blade points straight down the view (where the bullet goes), and slid
    // so the eye is on that line, EYE_RELIEF behind the aperture. Offsets (recoil, bolt cant, wall) carry over on top.
        const sightDir = SIGHT_TIP.clone().sub(SIGHT_REAR).normalize();
    // held normally (turned 180 deg about the vertical, upright), then a tiny correction so the sight line is exactly the view axis
    const qAim = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI);
    qAim.premultiply(new THREE.Quaternion().setFromUnitVectors(sightDir.clone().applyQuaternion(qAim), V(0, 0, -1)));
    const extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(-(pitch - lerp(hip.pitch, aim.pitch, a)), yaw - lerp(hip.yaw, aim.yaw, a), roll, 'YXZ'));
    const aimPos = V(0, 0, -EYE_RELIEF).sub(SIGHT_REAR.clone().applyQuaternion(qAim));
    const off = pos.clone().sub(hip.pos.clone().lerp(aim.pos, a));   // sway, bob, recoil, bolt and wall offsets
    const qHipBase = new THREE.Quaternion().setFromEuler(new THREE.Euler(-hip.pitch, Math.PI + hip.yaw, 0, 'YXZ'));
    this.gun.quaternion.copy(qHipBase).slerp(qAim, a).premultiply(extra);
    this.gun.position.copy(hip.pos).lerp(aimPos, a).add(off);
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
    this.bolt.visible = lift > 0.01 || back > 0.001;   // the model's own bolt shows at rest; this one only while it is worked
    // arms: the clip for the body, then each wrist placed so the hand (oriented for its grip) closes on the rifle
    this.mixer.update(dt); this.body.updateMatrixWorld(true);
    const B = this.bones, G = this.gun.matrixWorld, w = v => v.clone().applyMatrix4(G), d = v => v.clone().transformDirection(G);
    const up = V(0, 1, 0).transformDirection(this.rig.matrixWorld), right = V(1, 0, 0).transformDirection(this.rig.matrixWorld);
    // right hand: on the stock (fingers round under the wrist of the stock, palm on its right side) or at the bolt / charger
    const away = Math.min(1, hand.distanceTo(GRIP_R) / 0.05), pressing = rel >= 0.18 && rel < 0.82 && hand.y > KNOB_UP.y + 0.01;
    // aiming: an underarm grip, the hand cupping the wrist of the stock from below (palm up, fingers wrapping up the far
    // side, elbow tucked down), hidden under the stock from the eye; at the hip, round the wrist from the side
    const under = 0;   // normal grip; the right hand is simply hidden when aiming (it is out of sight)
    const Fr = d(V(0.15, -0.8, 0.55)).lerp(d(V(0.92, 0.05, 0.38)), under).lerp(pressing ? d(V(-0.1, -0.35, 0.9)) : d(V(0.25, -0.2, 0.95)), away).normalize();
    const Nr = d(V(1, 0, 0)).lerp(d(V(0.05, 1, 0)), under).lerp(pressing ? d(V(0, -1, 0)) : d(V(0.7, -0.3, 0.2)), away).normalize();
    const gripR = blendGrip(GRIPS.stock, pressing ? GRIPS.press : GRIPS.pinch, away);
    // left hand: palm up under the fore-end, fingers across to the far side
    const Fl = d(V(-0.97, -0.05, 0.22)).normalize(), Nl = d(V(0, 1, 0));   // fingers straight across under the fore-end, wrapping its far side
    const wrist = (grip, F, N, palm = 0.03, reach = 0.055) => w(grip).addScaledVector(N, -palm).addScaledVector(F, -reach);
    let wR = wrist(hand, Fr, Nr, away > 0.5 ? 0.015 : 0.035, away > 0.5 ? 0.075 : 0.05), wL = wrist(GRIP_L, Fl, Nl, 0.035, 0.05);
    if (this.xr) {
      // each real hand placed by its grip: palm centre on the wood (stock / fore-end radius ~2 cm), facing it
      const place = (h, gripW, F, N, stand) => {
        const f = F.clone().normalize(), n = N.clone().addScaledVector(f, -N.dot(f)).normalize(), x = new THREE.Vector3().crossVectors(f, n);
        const fl = h.fingersLocal, nl = h.palmLocal, xl = new THREE.Vector3().crossVectors(fl, nl);
        h.object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, n, x).multiply(new THREE.Matrix4().makeBasis(fl, nl, xl).transpose()));
        h.object.position.copy(gripW).addScaledVector(n, -stand).sub(h.palmCentreLocal.clone().applyQuaternion(h.object.quaternion));
        h.object.updateMatrixWorld(true);
        return h.wristLocal.clone().applyMatrix4(h.object.matrixWorld);
      };
      wR = place(this.xr.right, w(hand), Fr, Nr, away > 0.5 ? 0.012 : 0.034);
      wL = place(this.xr.left, w(GRIP_L), Fl, Nl, 0.034);
    }
    twoBoneIK(B.upperarm_r, B.lowerarm_r, B.hand_r, wR, up.clone().multiplyScalar(-1).addScaledVector(right, 0.9 - 0.7 * under));   // elbow tucked down when aiming
    twoBoneIK(B.upperarm_l, B.lowerarm_l, B.hand_l, wL, up.clone().multiplyScalar(-1).addScaledVector(right, -0.35));
    if (this.xr) for (const n of ['hand_l', 'hand_r']) { B[n].scale.setScalar(0.001); B[n].updateMatrixWorld(true); }
    if (this.xr) for (const [s, h] of [['l', this.xr.left], ['r', this.xr.right]]) {
      const wristW = h.wristLocal.clone().applyMatrix4(h.object.matrixWorld), elbow = B['lowerarm_' + s].getWorldPosition(new THREE.Vector3());
      const along = elbow.clone().sub(wristW).normalize();                       // up the forearm
      const palmW = h.palmLocal.clone().transformDirection(h.object.matrixWorld);
      const flat = palmW.addScaledVector(along, -palmW.dot(along)).normalize(), side = new THREE.Vector3().crossVectors(along, flat);
      const c = h.cuff, w = c.userData.wide / 2;
      // the whole forearm sleeve, wrist to elbow, so the arm runs unbroken from the hand out of view (no cut-off wrist)
      c.position.copy(wristW).addScaledVector(along, -0.015);                      // starts 1.5 cm over the base of the hand
      c.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, along, flat));
      c.scale.set(w, wristW.distanceTo(elbow) + 0.04, w * 0.72);                  // wider across the palm than through it
      c.visible = true;
    }   // the sleeve's own gloves hidden (after the clip, which resets scale)
    if (this.xr) {
      const mix = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + (b[k] - a[k]) * t]));
      this.xr.right.setPose(mix(mix(POSES.trigger, { thumb: 0.75, index: 0.45, middle: 0.95, ring: 0.98, pinky: 1 }, under), pressing ? { thumb: 0.2, index: 0.85, middle: 0.9, ring: 0.95, pinky: 1 } : POSES.pinch, away));
      this.xr.left.setPose({ thumb: 0.5, index: 0.7, middle: 0.72, ring: 0.74, pinky: 0.76 });   // cradling: fingertips on the far side, not over the top
      const hideRight = a > 0.55 && away < 0.3;   // aiming: the trigger hand is out of sight under the stock
      this.xr.left.object.visible = true; this.xr.right.object.visible = !hideRight; this.xr.right.cuff.visible = !hideRight;
      this.hideRight.value = hideRight ? 1 : 0;
    } else { this.hands.orient('r', Fr, Nr); this.hands.orient('l', Fl, Nl); this.hands.curl('r', gripR); this.hands.curl('l', GRIPS.foreend); }
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

// khaki serge for the forearm sleeves: a diagonal twill with wear
function sergeTexture() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#b8a77e'; g.fillRect(0, 0, N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 4 < 1) { g.fillStyle = 'rgba(70,60,40,0.22)'; g.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '60,50,34' : '220,205,170'},0.08)`; g.fillRect(Math.random() * N, Math.random() * N, 2 + Math.random() * 6, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
}
