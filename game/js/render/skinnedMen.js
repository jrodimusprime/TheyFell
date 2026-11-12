// The near soldiers, living and dead, drawn with the skinned models (uniforms baked by soldierSkin.js).
// Skinned figures are costly, so the nearest few dozen per side are skinned; the rest stay the cheap instanced figures.
// Bodies: the 11 ragdoll parts (soldiers.js RIG) are mapped onto the real skeleton, so a corpse lies however the physics
// left it, and a man who dies in view starts his fall from his actual pose.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SU from 'three/addons/utils/SkeletonUtils.js';
import { bakeSoldier, addBrodie, loadFaces, makeRifleRig, holdRifle, twoBoneIK, aimBone } from './soldierSkin.js';
import { climbPose, climbT } from './climb.js';
import { RIG, PART } from './soldiers.js';
import { loadHands } from './xrHands.js';

const MAP = { pelvis: 'pelvis', chest: 'spine_03', head: 'Head', uarmL: 'upperarm_l', farmL: 'lowerarm_l', uarmR: 'upperarm_r', farmR: 'lowerarm_r', thighL: 'thigh_l', shinL: 'calf_l', thighR: 'thigh_r', shinR: 'calf_r' };
const CHILD = { pelvis: ['pelvis', 'spine_01', 1], chest: ['spine_03', 'neck_01', 1], head: ['neck_01', 'Head', 1], uarmL: ['upperarm_l', 'lowerarm_l', -1], farmL: ['lowerarm_l', 'hand_l', -1], uarmR: ['upperarm_r', 'lowerarm_r', -1], farmR: ['lowerarm_r', 'hand_r', -1], thighL: ['thigh_l', 'calf_l', -1], shinL: ['calf_l', 'foot_l', -1], thighR: ['thigh_r', 'calf_r', -1], shinR: ['calf_r', 'foot_r', -1] };
const ORDER = RIG.map(r => r[0]);   // parents before children
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();

// a part frame built from the skeleton, by the rig's convention: +Y up the trunk / back up the limb, -Z the way he faces
function partFrame(bones, part, fwd, out) {
  const [a, b, sgn] = CHILD[part];
  bones[a].getWorldPosition(_a); bones[b].getWorldPosition(_b);
  const y = _b.sub(_a).multiplyScalar(sgn).normalize();
  let z = _f.copy(fwd).negate(); z.addScaledVector(y, -z.dot(y)); if (z.lengthSq() < 1e-4) z.set(0, 1, 0).addScaledVector(y, -y.y); z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  bones[MAP[part]].getWorldPosition(_a);
  return out.makeBasis(x, y, z).setPosition(_a);
}

export async function loadSkinnedMen(scene, renderer) {
  const L = new GLTFLoader(), load = u => new Promise((res, rej) => L.load(u, res, undefined, rej));
  const [bri, ger, le, k98, faces] = await Promise.all([load('models/characters/soldier_british.glb'), load('models/characters/soldier_german.glb'), load('models/weapons/lee_enfield.glb'), load('models/weapons/kar98k.glb'), loadFaces()]);
  bakeSoldier(bri, 'BRI', 1, faces); bakeSoldier(ger, 'GER', 1, faces); addBrodie(bri);
  const men = new SkinnedMen(scene, { BRI: { gltf: bri, gun: le.scene, kind: 'smle' }, GER: { gltf: ger, gun: k98.scene, kind: 'g98' } });
  men.xrHands = await loadHands('models/hands/', { skin: 0xa77a64 });   // the player's own hands (WebXR generic hands, MIT)
  return men;
}

const _UP = new THREE.Vector3(0, 1, 0), _Q1 = new THREE.Quaternion(), _Q2 = new THREE.Quaternion(), _Q3 = new THREE.Quaternion(), _V1 = new THREE.Vector3(), _V2 = new THREE.Vector3(), _V3 = new THREE.Vector3();
const clamp01 = v => Math.max(0, Math.min(1, v));
class SkinnedMen {
  constructor(scene, T) {
    this.scene = scene; this.T = T; this.pools = {}; this.offsets = {};
    this.LIVE = 32; this.DEAD = 40; this.RLIVE = 80; this.RDEAD = 60;
    for (const side of ['BRI', 'GER']) {
      // part-frame -> bone offsets from the bind pose (the model faces +Z there)
      const t = T[side].gltf.scene; t.updateMatrixWorld(true);
      const bones = this._bones(t), off = {};
      for (const part of ORDER) { partFrame(bones, part, new THREE.Vector3(0, 0, 1), _m); off[part] = _m.clone().invert().multiply(bones[MAP[part]].matrixWorld); }
      this.offsets[side] = off;
      this.pools[side] = { live: [...Array(this.LIVE)].map(() => this._make(side, true)), dead: [...Array(this.DEAD)].map(() => this._make(side, false)) };
    }
    this.liveIds = new Set(); this.byId = new Map();
    this.hipH = {}; for (const side of ['BRI', 'GER']) { const t = T[side].gltf.scene; t.updateMatrixWorld(true); this.hipH[side] = t.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3()).y; }
  }
  _bones(root) { const b = {}; root.traverse(o => { if (o.isBone) b[o.name] = o; }); return b; }
  _make(side, live) {
    const T = this.T[side], o = SU.clone(T.gltf.scene); o.visible = false;
    o.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = live; m.receiveShadow = true; } });
    const gun = makeRifleRig(T.gun, T.kind); (live ? o : this.scene).add(gun); gun.visible = false;
    this.scene.add(o);
    const e = { o, gun, bones: this._bones(o), side, mixer: live ? new THREE.AnimationMixer(o) : null, clip: null, action: null };
    e.rest = Object.fromEntries(Object.entries(e.bones).map(([n, b]) => [n, b.position.clone()]));
    o.updateMatrixWorld(true); if (e.bones.Head) e.bones.Head.userData.lookLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(e.bones.Head.getWorldQuaternion(new THREE.Quaternion()).invert());   // the way the face looks (bind pose faces +Z)   // each bone's own offset from its parent
    if (live) e.clips = Object.fromEntries(T.gltf.animations.map(a => [a.name, a]));
    return e;
  }
  _play(e, name, scale, dt = 1 / 60) {
    // a new clip only once the man has held the new state for a quarter second (a target flickering in and out of
    // sight must not restart the blend every few frames)
    if (e.clip && e.clip !== name) { if (e.want !== name) { e.want = name; e.wantT = 0; } e.wantT += dt; if (e.wantT < 0.25) { e.action.timeScale = scale; return; } }
    if (e.clip !== name) { const a = e.mixer.clipAction(e.clips[name] || e.clips.Idle_Loop); a.reset().play(); if (e.action) e.action.crossFadeTo(a, 0.2, false); e.action = a; e.clip = name; }
    e.action.timeScale = scale;
  }
  // which men are drawn skinned this frame; men.state gives each one's smoothed speed
  update(dt, sim, men, cam, playerId) {
    this.terrain = sim.T;
    const cx = cam.position.x, cz = cam.position.z;
    this.liveIds.clear(); this.byId.clear();
    for (const side of ['BRI', 'GER']) {
      // the living
      const near = [];
      for (const s of sim.soldiers) { if (!s.alive || s.side !== side || (s.id === playerId && men.hidePlayer)) continue; const d = Math.abs(s.x - cx) + Math.abs(s.z - cz); if (d < this.RLIVE * 1.4) { const dd = Math.hypot(s.x - cx, s.z - cz); if (dd < this.RLIVE) near.push([dd, s]); } }
      near.sort((a, b) => a[0] - b[0]);
      const pool = this.pools[side].live;
      pool.forEach((e, i) => {
        const s = near[i] && near[i][1]; e.o.visible = !!s; e.gun.visible = !!s; if (!s) return;
        this.liveIds.add(s.id); this.byId.set(s.id, e);
        const ct = climbT(s);
        if (ct >= 0) { this._climb(e, s, ct, dt); return; }
        const st = men.state[s.id], sp = st.speed || 0, aim = s.ai ? s.ai.target >= 0 && sp < 0.4 : s.ads;
        let clip, scale = 1;
        if (s.stance >= 1) { clip = sp > 0.35 ? 'Crouch_Fwd_Loop' : aim ? 'Rifle_Kneel_Aim' : 'Crouch_Idle_Loop'; scale = sp > 0.35 ? Math.min(1.6, Math.max(0.7, sp / 1.1)) : 1; }
        else if (sp > 3.8) { clip = 'Sprint_Loop'; scale = Math.min(1.5, sp / 5.2); }
        else if (sp > 2.0) { clip = 'Jog_Fwd_Loop'; scale = Math.min(1.5, Math.max(0.7, sp / 3.1)); }
        else if (sp > 0.35) { clip = 'Walk_Loop'; scale = Math.min(1.6, Math.max(0.6, sp / 1.4)); }
        else clip = aim ? 'Rifle_Aim' : 'Idle_Loop';
        this._play(e, clip, scale, dt); e.mixer.update(dt);
        e.o.position.set(s.x, s.y, s.z); e.o.rotation.set(0, s.yaw + Math.PI, 0);
        const aiming = /Aim/.test(e.clip);
        holdRifle(e.o, e.gun, aiming ? 'aim' : sp > 0.35 && s.stance === 0 ? 'port' : 'low', aiming ? s.pitch : 0, e.bones);
      });
      // the dead
      const dnear = [];
      for (const c of men.corpses) { if (c.side !== side || c.removed) continue; const e2 = c.mats[0].elements, d = Math.hypot(e2[12] - cx, e2[14] - cz); if (d < this.RDEAD) dnear.push([d, c]); }
      dnear.sort((a, b) => a[0] - b[0]);
      const dpool = this.pools[side].dead;
      for (const c of men.corpses) if (c.side === side) c.skinned = false;
      dpool.forEach((e, i) => {
        const c = dnear[i] && dnear[i][1]; e.o.visible = !!c; e.gun.visible = !!c; if (!c) return;
        c.skinned = true; this._poseCorpse(e, c);
      });
    }
  }
  // climbing out: the clip for the head and spine, then the body placed on the climb path, leant, and its hands and feet
  // pinned with IK to the lip, the fire-step and the top
  _climb(e, s, t, dt) {
    const T = this.terrain, side = e.side, hipH = this.hipH[side];
    const cp = climbPose(s, T, t, hipH); e.cp = cp;
    const P = s._climbPlan, yaw = Math.atan2(P.f.x, P.f.z), B = e.bones, up = _UP, fw = P.f, left = P.side.clone().negate();
    // the clip under the IK (the spine and head's life): switched at once, no blend from a crouch fighting the climb
    const base = cp.kind === 'slope' ? 'Walk_Loop' : cp.kind === 'leap' ? 'Jog_Fwd_Loop' : 'Idle_Loop';
    if (e.clip !== base) { e.mixer.stopAllAction(); e.action = e.mixer.clipAction(e.clips[base]).reset().play(); e.clip = base; e.want = base; }
    e.action.timeScale = cp.kind === 'slope' ? 1.1 : cp.kind === 'leap' ? 1.2 : 1; e.mixer.update(dt);
    e.o.rotation.set(0, yaw, 0); e.o.position.set(cp.hip.x, cp.hip.y - hipH, cp.hip.z); e.o.updateMatrixWorld(true);
    // lean: half at the pelvis, half up the spine (a rounded back over the parapet), and the head kept looking ahead
    const turn = (bone, axis, ang) => { const q = _Q1.setFromAxisAngle(axis, ang).multiply(bone.getWorldQuaternion(_Q2)); bone.quaternion.copy(bone.parent.getWorldQuaternion(_Q3).invert().multiply(q)); bone.updateMatrixWorld(true); };
    // (the clip's own spine posture differs from upright: the pelvis takes half, the spine whatever brings the hips-to-neck
    // line to exactly the lean wanted)
    // (measured on the hips-to-shoulders line, which is what puts the hands where they must go; spread over the three
    // spine bones so the back rounds rather than kinks)
    turn(B.pelvis, left, cp.lean * 0.5);
    for (let it = 0; it < 3; it++) {
      const v = B.upperarm_l.getWorldPosition(_V1).add(B.upperarm_r.getWorldPosition(_V2)).multiplyScalar(0.5).sub(B.pelvis.getWorldPosition(_V2));
      const err = cp.lean - Math.atan2(v.dot(fw), v.y); if (Math.abs(err) < 0.01) break;
      for (const b of [B.spine_01, B.spine_02, B.spine_03]) turn(b, left, err / 3);
    }
    turn(B.Head, left, -cp.lean * 0.6);
    // legs: boots on their holds; knees forward and up, out to the side on the wall (never into it), down onto the top
    // when kneeling up; the foot level on the ground it stands on, toes into the wall on a foothold
    if (cp.feet) for (const [k, sd] of [['r', -1], ['l', 1]]) {
      const hipJ = B['thigh_' + k].getWorldPosition(new THREE.Vector3());
      let tgt = cp.feet[k].clone().addScaledVector(up, 0.085), pole;
      if (cp.knees && cp.knees.dir && cp.knees.dir[k]) {
        // a knee going up onto the top: its direction from the real hip joint, a thigh's length out, lifted clear of the
        // ground under it; the boot a shin's length on from the knee (blended into its planted place as he stands)
        const kneeB = B['calf_' + k], thigh = kneeB.position.length() * kneeB.parent.getWorldScale(_V3).x, shin = B['foot_' + k].position.length() * B['foot_' + k].parent.getWorldScale(_V3).x;
        const [a, b, c] = cp.knees.dir[k], right = left.clone().negate(), kp = new THREE.Vector3();
        for (let it = 0, u2 = b; it < 10; it++, u2 += 0.12) {
          kp.copy(hipJ).addScaledVector(fw, a * thigh / Math.hypot(a, u2, c)).addScaledVector(up, u2 * thigh / Math.hypot(a, u2, c)).addScaledVector(right, c * thigh / Math.hypot(a, u2, c));
          let g = T.height(kp.x, kp.z); for (let q = 0; q < 6; q++) g = Math.max(g, T.height(kp.x + Math.cos(q) * 0.07, kp.z + Math.sin(q) * 0.07));
          if (kp.y - 0.07 >= g) break;
        }
        const sh = cp.knees.shin[k], ft = kp.clone().addScaledVector(fw, -Math.sin(sh) * shin).addScaledVector(up, -Math.cos(sh) * shin);
        { let g = T.height(ft.x, ft.z); for (let q = 0; q < 6; q++) g = Math.max(g, T.height(ft.x + Math.cos(q) * 0.08, ft.z + Math.sin(q) * 0.08)); ft.y = Math.max(ft.y, g + 0.085); }   // (the whole sole clear of the ground)
        tgt = ft.lerp(tgt, 1 - (cp.knees.w[k] ?? 1)); pole = kp.sub(hipJ);
      } else {
        const out = 0.1 + 0.6 * clamp01((cp.feet[k].y - (cp.baseY ?? cp.hip.y - hipH) - 0.1) / 0.25);   // a boot up on the wall: the knee out to the side, not into it
        pole = fw.clone().multiplyScalar(0.5).addScaledVector(up, 0.35 + (cp.poleUp || 0)).addScaledVector(left, sd * out);   // sd: -1 right, +1 left
      }
      twoBoneIK(B['thigh_' + k], B['calf_' + k], B['foot_' + k], tgt, pole);
      const ball = B['ball_' + k]; if (ball) aimBone(B['foot_' + k], ball.getWorldPosition(_V1), B['foot_' + k].getWorldPosition(_V2).add(_V3.copy(fw).multiplyScalar(0.14)).addScaledVector(up, -0.06));
    }
    if (cp.kind === 'slope') this._footFloor(e, T);
    // arms: palms on the lip (blended in and out); elbows out to the side while reaching up, back as he presses down
    if (cp.hands && cp.armW > 0) for (const [k, sd] of [['r', -1], ['l', 1]]) {
      const hand = B['hand_' + k], cur = hand.getWorldPosition(new THREE.Vector3()), tgt = cur.lerp(cp.hands[k].clone().addScaledVector(up, 0.045).addScaledVector(fw, -0.04), cp.armW);
      const sh = B['upperarm_' + k].getWorldPosition(_V1), above = clamp01((tgt.y - sh.y) / 0.3 + 0.5);
      if (tgt.distanceTo(sh) > 0.505) tgt.sub(sh).setLength(0.505).add(sh);   // never past arm's length: no stretched or snapping arms
      const pole = left.clone().multiplyScalar(sd * (0.4 + above * 0.6)).addScaledVector(fw, -(1 - above) * 0.9).addScaledVector(up, -0.3);
      twoBoneIK(B['upperarm_' + k], B['lowerarm_' + k], hand, tgt, pole);
      // the palm flat on the top: the hand turned so its fingers point ahead over the parapet
      const mid = B['middle_01_' + k]; if (mid && cp.armW > 0.5) aimBone(hand, mid.getWorldPosition(_V1), hand.getWorldPosition(_V2).addScaledVector(fw, 0.1).addScaledVector(up, -0.02));
    }
    // the rifle: slung across his back while both hands are busy, back in his hands at the top
    if (cp.rifle === 'slung') this._sling(e);
    else holdRifle(e.o, e.gun, 'port', 0, e.bones);
  }
  // the rifle slung across the back: butt behind the right hip, muzzle up past the left shoulder, sights outward
  _sling(e) {
    const B = e.bones, pel = B.pelvis.getWorldPosition(new THREE.Vector3()), neck = B.neck_01.getWorldPosition(new THREE.Vector3());
    const L = B.upperarm_l.getWorldPosition(new THREE.Vector3()), R = B.upperarm_r.getWorldPosition(new THREE.Vector3());
    const bUp = neck.clone().sub(pel).normalize(), bLeft = L.sub(R).normalize(), bFwd = new THREE.Vector3().crossVectors(bLeft, bUp).normalize();
    bLeft.crossVectors(bUp, bFwd).normalize();
    const dir = bUp.clone().multiplyScalar(0.84).addScaledVector(bLeft, 0.54).normalize();
    const butt = pel.addScaledVector(bFwd, -0.19).addScaledVector(bLeft, -0.2).addScaledVector(bUp, -0.08);
    const rUp = bFwd.clone().negate(), rX = new THREE.Vector3().crossVectors(rUp, dir).normalize(); rUp.crossVectors(dir, rX);
    const m = new THREE.Matrix4().makeBasis(rX, rUp, dir).setPosition(butt);
    e.o.matrixWorld.clone().invert().multiply(m).decompose(e.gun.position, e.gun.quaternion, e.gun.scale); e.gun.updateMatrixWorld(true);
  }
  // the clip's boots kept on uneven ground (a slope): each foot lifted to the ground under it, the leg bent to suit
  _footFloor(e, T) {
    const B = e.bones;
    for (const k of ['r', 'l']) {
      const f = B['foot_' + k].getWorldPosition(new THREE.Vector3()), g = T.height(f.x, f.z) + 0.085;
      if (f.y < g) twoBoneIK(B['thigh_' + k], B['calf_' + k], B['foot_' + k], f.setY(g), new THREE.Vector3(0, 0, 1).transformDirection(e.o.matrixWorld).addScaledVector(_UP, 0.3));
    }
  }
  // corpse: bone world = part world x offset, set down the hierarchy (unmapped bones keep their local pose)
  _poseCorpse(e, c) {
    const off = this.offsets[e.side], o = e.o;
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.updateMatrixWorld(true);
    for (const part of ORDER) {
      const bone = e.bones[MAP[part]], W = _m.multiplyMatrices(c.mats[PART[part]], off[part]);
      bone.parent.updateMatrixWorld(false);
      if (part === 'pelvis') _m2.copy(bone.parent.matrixWorld).invert().multiply(W).decompose(bone.position, bone.quaternion, bone.scale);
      else {
        // only the rotation comes from the ragdoll: the bone keeps its own length from its parent (the ragdoll's simple rig
        // has different proportions; taking its positions stretched the neck and limbs)
        const wq = new THREE.Quaternion().setFromRotationMatrix(W), pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        bone.quaternion.copy(pq.multiply(wq)); bone.position.copy(e.rest[MAP[part]]); bone.scale.set(1, 1, 1);
      }
      bone.updateMatrixWorld(true);
    }
    // the rifle where it fell (the instanced rifle's frame: muzzle -Z, origin near the trigger)
    e.gun.matrixAutoUpdate = true;
    _m.copy(c.rifle).multiply(_m2.makeRotationY(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.42));
    _m.decompose(e.gun.position, e.gun.quaternion, e.gun.scale);
  }
  // a man drawn skinned has just died: start the ragdoll from his real pose
  toCorpse(s, corpse) {
    const e = this.byId.get(s.id); if (!e) return;
    e.o.updateMatrixWorld(true);
    const off = this.offsets[e.side];
    for (const part of ORDER) corpse.mats[PART[part]].multiplyMatrices(e.bones[MAP[part]].matrixWorld, _m.copy(off[part]).invert());
  }
}
