// Hands that hold things: orients a hand (fingers direction + palm normal) and curls each finger joint by angle.
// Each joint's bending axis is measured from the skeleton's rest pose (the axis that swings the fingertip toward the
// palm), so the curl is right for any rig with the usual finger chains.
import * as THREE from 'three';

const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = new THREE.Vector3();

export class Hands {
  // bones: name -> Bone, in the rest (bind) pose when constructed
  constructor(bones, root) {
    this.b = bones; this.sides = {};
    root.updateMatrixWorld(true);
    const P = n => bones[n].getWorldPosition(new THREE.Vector3());
    for (const s of ['l', 'r']) {
      const hand = bones['hand_' + s], hq = hand.getWorldQuaternion(new THREE.Quaternion()), inv = hq.clone().invert();
      const F = P('middle_01_' + s).sub(P('hand_' + s)).normalize();
      const N = new THREE.Vector3(0, -1, 0).addScaledVector(F, F.y).normalize();   // palms down in the rest pose
      const side = { fingersLocal: F.clone().applyQuaternion(inv), palmLocal: N.clone().applyQuaternion(inv), joints: {} };
      // per joint: rest local rotation and the local axis that curls it toward the palm
      for (const f of FINGERS) {
        side.joints[f] = [];
        for (let k = 1; k <= 3; k++) {
          const bone = bones[`${f}_0${k}_${s}`]; if (!bone) continue;
          const tip = bones[`${f}_04_leaf_${s}`] || bones[`${f}_03_${s}`];
          const rest = bone.quaternion.clone();
          // the thumb curls across toward the palm's middle; the fingers straight toward the palm
          const want = f === 'thumb' ? P(`middle_01_${s}`).sub(P(`thumb_03_${s}`)).normalize().addScaledVector(N, 0.6).normalize() : N.clone();
          let best = null, bd = -2;
          const t0 = tip.getWorldPosition(new THREE.Vector3());
          for (const ax of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const axis = new THREE.Vector3(...ax);
            bone.quaternion.copy(rest).multiply(_q.setFromAxisAngle(axis, 0.4)); root.updateMatrixWorld(true);
            const d = tip.getWorldPosition(new THREE.Vector3()).sub(t0); const s2 = d.normalize().dot(want);
            if (s2 > bd) { bd = s2; best = axis; }
          }
          bone.quaternion.copy(rest); root.updateMatrixWorld(true);
          side.joints[f].push({ bone, rest, axis: best });
        }
      }
      this.sides[s] = side;
    }
  }
  // turn the hand so its fingers point along F and its palm faces N (world vectors)
  orient(s, F, N) {
    const side = this.sides[s], hand = this.b['hand_' + s];
    const f = F.clone().normalize(), n = N.clone().addScaledVector(f, -N.dot(f)).normalize(), x = new THREE.Vector3().crossVectors(f, n);
    const fl = side.fingersLocal, nl = side.palmLocal.clone().addScaledVector(fl, -side.palmLocal.dot(fl)).normalize(), xl = new THREE.Vector3().crossVectors(fl, nl);
    const W = _m.makeBasis(f, n, x), Lm = new THREE.Matrix4().makeBasis(fl, nl, xl);
    const target = new THREE.Quaternion().setFromRotationMatrix(W.multiply(Lm.transpose()));
    hand.parent.updateMatrixWorld(true);
    hand.quaternion.copy(hand.parent.getWorldQuaternion(_q2).invert().multiply(target)); hand.updateMatrixWorld(true);
  }
  // curls: { thumb: [a,b,c], index: [...], ... } radians per joint
  curl(s, curls) {
    const side = this.sides[s];
    for (const f of FINGERS) { const c = curls[f]; if (!c) continue; side.joints[f].forEach((j, k) => j.bone.quaternion.copy(j.rest).multiply(_q.setFromAxisAngle(j.axis, c[k] ?? c[c.length - 1]))); }
    this.b['hand_' + s].updateMatrixWorld(true);
  }
}
// grips (finger curls in radians, base / middle / tip)
export const GRIPS = {
  stock:   { thumb: [0.5, 0.6, 0.5], index: [0.55, 0.7, 0.35], middle: [1.35, 1.45, 1.0], ring: [1.4, 1.5, 1.0], pinky: [1.45, 1.5, 1.0] },   // round the wrist of the stock, finger on the trigger
  foreend: { thumb: [0.25, 0.35, 0.2], index: [1.0, 1.1, 0.7], middle: [1.05, 1.15, 0.7], ring: [1.1, 1.2, 0.75], pinky: [1.15, 1.2, 0.8] },  // cradling the fore-end
  pinch:   { thumb: [0.6, 0.7, 0.5], index: [0.9, 1.0, 0.6], middle: [1.2, 1.3, 0.9], ring: [1.35, 1.45, 1.0], pinky: [1.4, 1.5, 1.0] },     // finger and thumb on the bolt knob
  press:   { thumb: [0.05, 0.05, 0.0], index: [1.2, 1.3, 0.9], middle: [1.3, 1.4, 1.0], ring: [1.35, 1.45, 1.0], pinky: [1.4, 1.5, 1.0] },  // thumb straight, pushing rounds down
};
export function blendGrip(a, b, t) { const o = {}; for (const k in a) o[k] = a[k].map((v, i) => v + (b[k][i] - v) * t); return o; }
