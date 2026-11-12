// The near soldiers, living and dead, drawn with the skinned models (uniforms baked by soldierSkin.js).
// Skinned figures are costly, so the nearest few dozen per side are skinned; the rest stay the cheap instanced figures.
// Bodies: the 11 ragdoll parts (soldiers.js RIG) are mapped onto the real skeleton, so a corpse lies however the physics
// left it, and a man who dies in view starts his fall from his actual pose.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SU from 'three/addons/utils/SkeletonUtils.js';
import { bakeSoldier, addBrodie, loadFaces, makeRifleRig, holdRifle } from './soldierSkin.js';
import { RIG, PART } from './soldiers.js';

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
  return new SkinnedMen(scene, { BRI: { gltf: bri, gun: le.scene, kind: 'smle' }, GER: { gltf: ger, gun: k98.scene, kind: 'g98' } });
}

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
  }
  _bones(root) { const b = {}; root.traverse(o => { if (o.isBone) b[o.name] = o; }); return b; }
  _make(side, live) {
    const T = this.T[side], o = SU.clone(T.gltf.scene); o.visible = false;
    o.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = live; m.receiveShadow = true; } });
    const gun = makeRifleRig(T.gun, T.kind); (live ? o : this.scene).add(gun); gun.visible = false;
    this.scene.add(o);
    const e = { o, gun, bones: this._bones(o), side, mixer: live ? new THREE.AnimationMixer(o) : null, clip: null, action: null };
    if (live) e.clips = Object.fromEntries(T.gltf.animations.map(a => [a.name, a]));
    return e;
  }
  _play(e, name, scale) {
    if (e.clip !== name) { const a = e.mixer.clipAction(e.clips[name] || e.clips.Idle_Loop); a.reset().play(); if (e.action) e.action.crossFadeTo(a, 0.2, false); e.action = a; e.clip = name; }
    e.action.timeScale = scale;
  }
  // which men are drawn skinned this frame; men.state gives each one's smoothed speed
  update(dt, sim, men, cam, playerId) {
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
        const st = men.state[s.id], sp = st.speed || 0, aim = s.ai ? s.ai.target >= 0 && sp < 0.4 : s.ads;
        let clip, scale = 1;
        if (s.stance >= 1) { clip = sp > 0.35 ? 'Crouch_Fwd_Loop' : aim ? 'Rifle_Kneel_Aim' : 'Crouch_Idle_Loop'; scale = sp > 0.35 ? Math.min(1.6, Math.max(0.7, sp / 1.1)) : 1; }
        else if (sp > 3.8) { clip = 'Sprint_Loop'; scale = Math.min(1.5, sp / 5.2); }
        else if (sp > 2.0) { clip = 'Jog_Fwd_Loop'; scale = Math.min(1.5, Math.max(0.7, sp / 3.1)); }
        else if (sp > 0.35) { clip = 'Walk_Loop'; scale = Math.min(1.6, Math.max(0.6, sp / 1.4)); }
        else clip = aim ? 'Rifle_Aim' : 'Idle_Loop';
        this._play(e, clip, scale); e.mixer.update(dt);
        e.o.position.set(s.x, s.y, s.z); e.o.rotation.set(0, s.yaw + Math.PI, 0);
        holdRifle(e.o, e.gun, aim ? 'aim' : sp > 0.35 && s.stance === 0 ? 'port' : 'low', aim ? s.pitch : 0, e.bones);
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
  // corpse: bone world = part world x offset, set down the hierarchy (unmapped bones keep their local pose)
  _poseCorpse(e, c) {
    const off = this.offsets[e.side], o = e.o;
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.updateMatrixWorld(true);
    for (const part of ORDER) {
      const bone = e.bones[MAP[part]], W = _m.multiplyMatrices(c.mats[PART[part]], off[part]);
      bone.parent.updateMatrixWorld(false);
      _m2.copy(bone.parent.matrixWorld).invert().multiply(W).decompose(bone.position, bone.quaternion, bone.scale);
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
