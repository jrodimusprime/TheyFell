// Boned hands that work: load the WebXR generic hands (MIT, Immersive Web / Amazon), turn their flat joint list into
// real finger chains, and pose them by curling each finger (0 = straight, 1 = fully closed) or by named poses.
//
//   import { loadHands, POSES } from './js/hands.js';
//   const { left, right } = await loadHands('models/');
//   scene.add(right.object);
//   right.setPose('fist');                 // instantly
//   right.animateTo('trigger', 0.25);      // over 0.25 s; call right.update(dt) every frame
//   right.setCurl('index', 0.3);           // one finger
//
// Each joint's bending axis is computed from the model (perpendicular to joint->tip and the way the tip should travel),
// so the curl is right for both hands, mirrored, without hand-tuned numbers.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const CHAIN = {
  thumb: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
  index: ['index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'],
  middle: ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'],
  ring: ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'],
  pinky: ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'],
};
// how far each joint bends at curl 1 (radians): knuckle, middle, end; the thumb: base, middle, end
const RANGE = { thumb: [0.55, 0.6, 0.75], finger: [1.45, 1.65, 1.15] };

// named poses: curl per finger, 0..1
export const POSES = {
  open:      { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
  relaxed:   { thumb: 0.15, index: 0.2, middle: 0.25, ring: 0.3, pinky: 0.35 },
  fist:      { thumb: 0.85, index: 1, middle: 1, ring: 1, pinky: 1 },
  grip:      { thumb: 0.6, index: 0.72, middle: 0.75, ring: 0.78, pinky: 0.8 },     // round a 3-4 cm handle (a rifle's wrist, a fore-end)
  trigger:   { thumb: 0.6, index: 0.35, middle: 0.75, ring: 0.78, pinky: 0.8 },     // grip with the index finger forward on a trigger
  point:     { thumb: 0.7, index: 0, middle: 1, ring: 1, pinky: 1 },
  pinch:     { thumb: 0.55, index: 0.5, middle: 0.75, ring: 0.85, pinky: 0.9 },     // finger and thumb together (a bolt knob, a pin)
  thumbsUp:  { thumb: 0, index: 1, middle: 1, ring: 1, pinky: 1 },
};

export async function loadHands(base = 'models/', { skin = 0xc9a088 } = {}) {
  const L = new GLTFLoader(), load = u => new Promise((res, rej) => L.load(u, res, undefined, rej));
  const [l, r] = await Promise.all([load(base + 'left.glb'), load(base + 'right.glb')]);
  return { left: new Hand(l, 'left', skin), right: new Hand(r, 'right', skin) };
}

export class Hand {
  constructor(gltf, side, skin) {
    this.side = side; this.object = gltf.scene; this.bones = {};
    this.object.traverse(o => { if (o.isBone) this.bones[o.name] = o; if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
      o.material = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.62, metalness: 0 }); } });
    this.object.updateMatrixWorld(true);
    // 1. the WebXR joints are all children of the armature (tracking poses each one); chain them so a finger bends as one
    const wrist = this.bones.wrist;
    for (const f of FINGERS) { let parent = wrist; for (const n of CHAIN[f]) { const b = this.bones[n]; parent.attach(b); parent = b; } }
    this.object.updateMatrixWorld(true);
    // 2. palm normal: perpendicular to the palm (wrist, index knuckle, pinky knuckle), on the side the thumb folds to
    const P = n => this.bones[n].getWorldPosition(new THREE.Vector3());
    const w = P('wrist'), ik = P('index-finger-phalanx-proximal'), pk = P('pinky-finger-phalanx-proximal');
    const N = new THREE.Vector3().crossVectors(ik.clone().sub(w), pk.clone().sub(w)).normalize();
    const palmMid = ik.clone().add(pk).add(w).divideScalar(3);
    if (P('thumb-tip').sub(palmMid).dot(N) < 0) N.negate();
    this.palm = N;
    // 3. each joint: its rest rotation and the local axis that curls the finger's tip toward the palm
    this.joints = {};
    for (const f of FINGERS) {
      const names = f === 'thumb' ? CHAIN.thumb.slice(0, 3) : CHAIN[f].slice(1, 4), tip = this.bones[CHAIN[f][CHAIN[f].length - 1]];
      this.joints[f] = names.map((n, k) => {
        const bone = this.bones[n], rest = bone.quaternion.clone(), t0 = tip.getWorldPosition(new THREE.Vector3());
        const want = f === 'thumb' && k === 0 ? ik.clone().sub(t0).normalize().add(N).normalize() : N.clone();   // the thumb's base swings across to the index knuckle; its joints bend into the palm
        // the exact axis: perpendicular to joint->tip and the direction the tip should travel, in the bone's own frame
        const jp = bone.getWorldPosition(new THREE.Vector3()), axisW = new THREE.Vector3().crossVectors(t0.clone().sub(jp), want).normalize();
        const best = axisW.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
        return { bone, rest, axis: best, range: (f === 'thumb' ? RANGE.thumb : RANGE.finger)[k] };
      });
    }
    this.curls = { ...POSES.open }; this.anim = null;
  }
  setCurl(finger, c) {
    this.curls[finger] = c;
    if (finger === 'thumb') return this._thumb(c);
    for (const j of this.joints[finger]) j.bone.quaternion.copy(j.rest).multiply(new THREE.Quaternion().setFromAxisAngle(j.axis, j.range * c));
    if (finger === 'index' || finger === 'middle') this._thumb(this.curls.thumb);   // the thumb rests on these: follow them
  }
  // the thumb folds across the fingers, not into the palm: reach its tip (a few CCD passes over its three joints) toward
  // a spot on the outside of the index and middle fingers' middle joints, blended from where it rests by the curl
  _thumb(c) {
    const js = this.joints.thumb; for (const j of js) j.bone.quaternion.copy(j.rest);
    this.object.updateMatrixWorld(true);
    if (c <= 0.001) return;
    const B = this.bones, P = n => B[n].getWorldPosition(new THREE.Vector3()), tipB = B['thumb-tip'];
    const pc = this.palmCentre(), mid = P('index-finger-phalanx-intermediate').lerp(P('middle-finger-phalanx-intermediate'), 0.35);
    const out = mid.clone().sub(pc).normalize(), closed = mid.addScaledVector(out, 0.012), target = tipB.getWorldPosition(new THREE.Vector3()).lerp(closed, Math.min(1, c));
    const q = new THREE.Quaternion(), pq = new THREE.Quaternion();
    for (let it = 0; it < 8; it++) for (let k = js.length - 1; k >= 0; k--) {
      const b = js[k].bone, jp = b.getWorldPosition(new THREE.Vector3()), tp = tipB.getWorldPosition(new THREE.Vector3());
      const a = tp.sub(jp).normalize(), t = target.clone().sub(jp).normalize();
      q.setFromUnitVectors(a, t); const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
      if (ang > 0.35) q.slerp(new THREE.Quaternion(), 1 - 0.35 / ang);   // a little at a time: a natural curl, no flips
      const wq = b.getWorldQuaternion(new THREE.Quaternion()); b.parent.getWorldQuaternion(pq);
      b.quaternion.copy(pq.invert().multiply(q.multiply(wq))); b.updateMatrixWorld(true);
    }
  }
  setPose(p) { const pose = typeof p === 'string' ? POSES[p] : p; for (const f of FINGERS) this.curls[f] = pose[f] ?? 0; for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) this.setCurl(f, this.curls[f]); this.anim = null; }
  animateTo(p, secs = 0.2) { this.anim = { from: { ...this.curls }, to: typeof p === 'string' ? POSES[p] : p, t: 0, secs }; }
  update(dt) {
    if (!this.anim) return;
    const a = this.anim; a.t = Math.min(1, a.t + dt / Math.max(1e-3, a.secs)); const e = a.t * a.t * (3 - 2 * a.t);
    for (const f of FINGERS) this.curls[f] = a.from[f] + ((a.to[f] ?? 0) - a.from[f]) * e;
    for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) this.setCurl(f, this.curls[f]);
    if (a.t >= 1) this.anim = null;
  }
  // world positions useful for attaching or checking a grip
  fingertip(f) { return this.bones[CHAIN[f][CHAIN[f].length - 1]].getWorldPosition(new THREE.Vector3()); }
  palmCentre() { const P = n => this.bones[n].getWorldPosition(new THREE.Vector3()); return P('wrist').add(P('middle-finger-phalanx-proximal')).multiplyScalar(0.5); }
}
