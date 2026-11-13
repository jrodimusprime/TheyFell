// Physics ragdolls on death (cannon-es). Cosmetic: they never feed back into the deterministic sim.
// Each part of the soldier rig (soldiers.js RIG) becomes a box body; joints are cone-twist constraints with limits.
// The ground is a heightfield patch sampled from the real terrain under the body (trench walls, crater lips, parapets),
// so men fall into trenches, slump against the parapet and roll down shell holes. Settled bodies freeze and leave the world.
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RIG, PART, fk } from './soldiers.js';

const MASS = { pelvis: 14, chest: 26, head: 5, uarmL: 2.5, farmL: 2, uarmR: 2.5, farmR: 2, thighL: 9, shinL: 5, thighR: 9, shinR: 5 };
// joint: [child, parent, pivot in parent joint frame (= the child's joint offset), twist axis, cone angle, twist angle]
const JOINTS = [
  ['chest', 'pelvis', 0.5, 0.3], ['head', 'chest', 0.6, 0.6],
  ['uarmL', 'chest', 1.4, 0.8], ['farmL', 'uarmL', 1.2, 0.3], ['uarmR', 'chest', 1.4, 0.8], ['farmR', 'uarmR', 1.2, 0.3],
  ['thighL', 'pelvis', 0.9, 0.3], ['shinL', 'thighL', 1.1, 0.15], ['thighR', 'pelvis', 0.9, 0.3], ['shinR', 'thighR', 1.1, 0.15],
];
const G_PARTS = 2, G_GROUND = 1;
// how the dead lie when no ragdoll is run for them (too far off, or too many falling at once): ten poses, joint rotations
// (Euler XYZ in each joint's frame, as pose() in soldiers.js) on the standing rig; the body is then laid on the ground,
// tilted to its slope. 'face' poses are for a man knocked forward, 'back' for one knocked back, 'side' either way.
// (signs: a thigh's +x swings the leg forward, a shin's -x bends the knee, an arm's +x raises it forward, its z out to the
// side (+ for the right, - for the left), a forearm's +x bends the elbow, the chest's -x bends forward, the head's +x lifts
// the chin; the pelvis: -x pitches him onto his face, +x onto his back, z rolls him onto a side)
export const DEAD_POSES = [
  { name: 'face down, arms flung forward', fall: 'face', r: { pelvis: [-1.57, 0, 0], uarmL: [2.5, 0, -0.45], farmL: [0.35, 0, 0], uarmR: [2.1, 0, 0.55], farmR: [0.5, 0, 0], head: [0.15, 1.25, 0], thighL: [0, 0, -0.14], thighR: [0, 0, 0.16], shinL: [-0.35, 0, 0] } },
  { name: 'face down, arms at his sides, a knee drawn up', fall: 'face', r: { pelvis: [-1.57, 0.15, 0], uarmL: [0.15, 0, -0.12], uarmR: [0.25, 0, 0.1], farmR: [0.3, 0, 0], head: [0.1, -1.3, 0], thighR: [0.95, 0, 0.35], shinR: [-1.4, 0, 0], thighL: [0, 0, -0.05] } },
  { name: 'on his back, arms out', fall: 'back', r: { pelvis: [1.57, 0, 0], uarmL: [0, 0, -1.3], farmL: [0.35, 0, 0], uarmR: [0.2, 0, 1.2], farmR: [0.2, 0, 0], head: [0, 0.65, 0], thighL: [0, 0, -0.25], thighR: [0, 0, 0.22], shinR: [-0.2, 0, 0] } },
  { name: 'on his back, an arm across his chest, a knee up', fall: 'back', r: { pelvis: [1.57, 0, 0], uarmR: [0.8, 0, -0.6], farmR: [1.9, 0, 0], uarmL: [0.1, 0, -0.45], head: [-0.3, 0.4, 0], thighL: [0.85, 0, -0.15], shinL: [-1.45, 0, 0], thighR: [0, 0, 0.1] } },
  { name: 'curled on his side', fall: 'side', r: { pelvis: [0, 0, 1.57], chest: [-0.5, 0, 0], head: [-0.35, 0, 0], thighL: [1.3, 0, 0], shinL: [-1.6, 0, 0], thighR: [1.05, 0, 0], shinR: [-1.5, 0, 0], uarmL: [1.0, 0, 0], farmL: [1.5, 0, 0], uarmR: [1.2, 0, 0], farmR: [1.6, 0, 0] } },
  { name: 'three-quarters over, one leg forward', fall: 'side', r: { pelvis: [-0.5, 0, -1.2], thighL: [0.9, 0, 0], shinL: [-1.2, 0, 0], thighR: [-0.1, 0, 0], uarmR: [1.6, 0, 0.2], farmR: [0.4, 0, 0], uarmL: [0.5, 0, -0.35], farmL: [0.8, 0, 0], head: [0.2, -0.6, 0] } },
  { name: 'slumped forward on his knees', fall: 'face', r: { pelvis: [-0.75, 0, 0], thighL: [1.75, 0, -0.08], shinL: [-2.5, 0, 0], thighR: [1.7, 0, 0.1], shinR: [-2.45, 0, 0], chest: [-1.0, 0.15, 0], head: [-0.6, 0.6, 0], uarmL: [1.5, 0, -0.25], farmL: [0.3, 0, 0], uarmR: [0.9, 0, 0.35], farmR: [0.6, 0, 0] } },
  { name: 'fallen back from sitting', fall: 'back', r: { pelvis: [0.5, 0, 0], thighL: [1.35, 0, -0.12], shinL: [-0.45, 0, 0], thighR: [1.2, 0, 0.15], shinR: [-0.7, 0, 0], chest: [0.95, 0, 0], head: [-0.2, 0.75, 0], uarmL: [-0.2, 0, -0.75], farmL: [0.15, 0, 0], uarmR: [-0.15, 0, 0.65], farmR: [0.1, 0, 0] } },
  { name: 'face down, twisted, a hand reaching out', fall: 'face', r: { pelvis: [-1.57, 0.4, 0], thighL: [0, 0, -0.28], thighR: [0.15, 0, 0.3], shinL: [-0.25, 0, 0], uarmR: [2.9, 0, 0.1], farmR: [0.1, 0, 0], uarmL: [0.4, 0, -0.5], farmL: [1.2, 0, 0], head: [0.05, -1.15, 0], chest: [0, -0.25, 0] } },
  { name: 'on his back, arms over his head, knees fallen aside', fall: 'back', r: { pelvis: [1.57, -0.3, 0], chest: [0, 0.4, 0], uarmL: [2.8, 0, -0.2], uarmR: [2.75, 0, 0.25], farmL: [0.4, 0, 0], farmR: [0.3, 0, 0], thighL: [0.8, 0, 0.5], thighR: [0.85, 0, 0.45], shinL: [-1.2, 0, 0], shinR: [-1.3, 0, 0], head: [0, 0.5, 0] } },
];
const _dm = new THREE.Matrix4(), _dv = new THREE.Vector3(), _dq = new THREE.Quaternion();
// lay a corpse in one of the poses at (x, z), his head towards `yaw`'s forward (as he stood), on the ground's slope
export function layDead(corpse, T, k, yaw) {
  const P = DEAD_POSES[k], rot = RIG.map(([n]) => (P.r[n] || [0, 0, 0]).slice()); rot.root = { y: 0, pitch: 0 };
  fk(corpse.mats, { x: 0, y: 0, z: 0 }, yaw, rot, rot.root);
  // the ground's slope where he lies: tilt the body onto it (about the pelvis)
  const x = corpse.x, z = corpse.z, e = 0.6, hx = (T.height(x + e, z) - T.height(x - e, z)) / (2 * e), hz = (T.height(x, z + e) - T.height(x, z - e)) / (2 * e);
  const n = _dv.set(-hx, 1, -hz).normalize(), tilt = _dq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  _dm.makeRotationFromQuaternion(tilt).setPosition(x, 0, z); for (const m of corpse.mats) m.premultiply(_dm);
  // then down onto the ground: each part's lowest point against the ground under it; most parts resting on it, none sunk in
  const d = [];
  for (let i = 0; i < RIG.length; i++) { const [, , , he, co] = RIG[i], c = new THREE.Vector3(...co).applyMatrix4(corpse.mats[i]); d.push(c.y - Math.min(he[0], he[1], he[2]) - T.height(c.x, c.z)); }
  const sorted = [...d].sort((a, b) => a - b), shift = Math.max(-sorted[Math.floor(d.length * 0.3)], -sorted[0] - 0.03);
  _dm.makeTranslation(0, shift, 0); for (const m of corpse.mats) m.premultiply(_dm);
  corpse.pose = P.name;
}

export class Ragdolls {
  constructor(T) {
    this.T = T;
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0), allowSleep: true });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 12;
    this.world.defaultContactMaterial.friction = 0.7; this.world.defaultContactMaterial.restitution = 0.05;
    this.active = []; this.maxActive = 40;
    this.stats = { active: 0, bodies: 0 };
  }
  _ground(x, z) {
    // a 14 m heightfield patch at 0.35 m under the fall
    const es = 0.35, n = 41, half = es * (n - 1) / 2, x0 = x - half, zTop = z + half, data = [];
    for (let i = 0; i < n; i++) { const col = []; for (let j = 0; j < n; j++) col.push(this.T.height(x0 + i * es, zTop - j * es)); data.push(col); }
    const shape = new CANNON.Heightfield(data, { elementSize: es });
    const body = new CANNON.Body({ mass: 0, collisionFilterGroup: G_GROUND, collisionFilterMask: G_PARTS });
    body.addShape(shape); body.position.set(x0, 0, zTop); body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(body);
    return body;
  }
  // corpse: from SoldiersView.addCorpse (mats = world matrices per part at the moment of death); hit: sim death event
  add(corpse, hit, camDist) {
    // far away, or the physics budget is full (a mine or a machine-gun burst kills dozens at once): lay him down on the
    // ground directly. Never freeze a ragdoll mid-fall, or the dead are left standing.
    if (camDist > 260 || this.active.length >= this.maxActive) return this._settleStatic(corpse, hit);
    const bodies = [], m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < RIG.length; i++) {
      const [name, , , he, co] = RIG[i];
      m.copy(corpse.mats[i]); m.decompose(p, q, s);
      const c = new THREE.Vector3(...co).applyQuaternion(q).add(p);     // body centre = joint + rotated centre offset
      const b = new CANNON.Body({ mass: MASS[name], collisionFilterGroup: G_PARTS, collisionFilterMask: G_GROUND, linearDamping: 0.08, angularDamping: 0.35, allowSleep: true, sleepSpeedLimit: 0.12, sleepTimeLimit: 0.6 });
      b.addShape(new CANNON.Box(new CANNON.Vec3(he[0], he[1], he[2])));
      b.position.set(c.x, c.y, c.z); b.quaternion.set(q.x, q.y, q.z, q.w);
      this.world.addBody(b); bodies.push(b);
    }
    const T_ = (typeof window !== "undefined" && window.__ragTest) || {};   // test switches (noGround, noJoints, p2p), used by the ragdoll diagnostics
    if (!T_.noJoints) for (const [child, parent, cone, twist] of JOINTS) {
      const ci = PART[child], pi = PART[parent], [, , off] = RIG[ci], pco = RIG[pi][4], cco = RIG[ci][4];
      // pivot = the child's joint: in the parent body frame it is (joint offset - parent centre offset); in the child frame, -child centre offset
      const pivA = new CANNON.Vec3(off[0] - pco[0], off[1] - pco[1], off[2] - pco[2]), pivB = new CANNON.Vec3(-cco[0], -cco[1], -cco[2]);
      const c = !T_.p2p ? new CANNON.ConeTwistConstraint(bodies[pi], bodies[ci], { pivotA: pivA, pivotB: pivB, axisA: new CANNON.Vec3(0, child === 'chest' || child === 'head' ? 1 : -1, 0), axisB: new CANNON.Vec3(0, child === 'chest' || child === 'head' ? 1 : -1, 0), angle: cone, twistAngle: twist, collideConnected: false })
        : new CANNON.PointToPointConstraint(bodies[pi], pivA, bodies[ci], pivB);
      this.world.addConstraint(c); c._rd = true;
      bodies[ci]._c = (bodies[ci]._c || []).concat(c);
    }
    // the blow: a bullet's push at the wound, a shell's blast lifting the whole body
    const dir = hit && hit.dir ? hit.dir : [0, 0, 0];
    if (hit && hit.kind === 'bullet') {
      const target = bodies[hit.zone === 'head' ? PART.head : hit.zone === 'legs' ? PART.thighL : PART.chest];
      // (cannon-es takes the point relative to the body's centre: a little above it, so the hit also turns him)
      target.applyImpulse(new CANNON.Vec3(dir[0] * 55, dir[1] * 20 + 6, dir[2] * 55), new CANNON.Vec3(0, 0.08, 0));
      bodies[PART.pelvis].applyImpulse(new CANNON.Vec3(dir[0] * 20, 0, dir[2] * 20), new CANNON.Vec3(0, 0, 0));
    } else if (hit) {
      const k = (hit.blast || 0.6) * (hit.kind === 'mine' ? 9 : 4);
      for (const b of bodies) { b.velocity.set(dir[0] * k * 2.2 + (Math.random() - 0.5) * k, 2 + k * 1.6 * Math.random(), dir[2] * k * 2.2 + (Math.random() - 0.5) * k); b.angularVelocity.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }
    } else { bodies[PART.chest].applyImpulse(new CANNON.Vec3(Math.random() - 0.5, 0, Math.random() - 0.5), new CANNON.Vec3(0, 0, 0)); }
    // knees buckle: a little forward drift so men crumple instead of falling like planks
    bodies[PART.shinL].velocity.x += (Math.random() - 0.5) * 0.6; bodies[PART.shinR].velocity.z += (Math.random() - 0.5) * 0.6;
    const ground = T_.noGround ? null : this._ground(corpse.x, corpse.z);
    const rd = { corpse, bodies, ground, t: 0 };
    this.active.push(rd);
    return rd;
  }
  _settleStatic(corpse, hit) {
    // no simulation (far off, or too many at once): one of the ten lying poses, chosen by which way the blow knocked him
    // (forward onto his face, back onto his back, or either onto a side), turned a little at random, laid on the ground
    const fwd = [-Math.sin(corpse.yaw), -Math.cos(corpse.yaw)], dir = hit && hit.dir ? hit.dir : [0, 0, 0];
    const along = dir[0] * fwd[0] + dir[2] * fwd[1], R = Math.random;
    const want = Math.abs(along) < 0.25 ? (R() < 0.5 ? 'face' : 'back') : along > 0 ? 'face' : 'back';
    const pool = DEAD_POSES.map((p, i) => [p, i]).filter(([p]) => p.fall === want || p.fall === 'side');
    const k = pool[Math.floor(R() * pool.length)][1];
    corpse.x = corpse.mats[PART.pelvis].elements[12]; corpse.z = corpse.mats[PART.pelvis].elements[14];
    layDead(corpse, this.T, k, corpse.yaw + (R() - 0.5) * 0.9);
    // his rifle on the ground beside him
    const hand = new THREE.Vector3(0.25, 0, 0).applyMatrix4(corpse.mats[PART.farmR]), y = this.T.height(hand.x, hand.z) + 0.04;
    corpse.rifle.compose(new THREE.Vector3(hand.x, y, hand.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6.28, Math.PI / 2, 'YXZ')), new THREE.Vector3(1, 1, 1));
    if (this.onSettle) { const e = corpse.mats[PART.chest].elements; this.onSettle(e[12], e[14]); }
    return null;
  }
  _freeze(rd) {
    if (this.onSettle && !rd.corpse.removed) { const c = rd.bodies[PART.chest].position; this.onSettle(c.x, c.z); }
    for (const b of rd.bodies) { for (const c of b._c || []) this.world.removeConstraint(c); this.world.removeBody(b); }
    if (rd.ground) this.world.removeBody(rd.ground);
    this.active.splice(this.active.indexOf(rd), 1);
  }
  step(dt) {
    if (!this.active.length) { this.stats.active = 0; return; }
    this.world.step(1 / 60, Math.min(dt, 0.1), 3);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    for (const rd of [...this.active]) {
      rd.t += dt;
      const { corpse, bodies } = rd;
      if (corpse.removed) { this._freeze(rd); continue; }
      for (let i = 0; i < RIG.length; i++) {
        const b = bodies[i], co = RIG[i][4];
        q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        p.set(-co[0], -co[1], -co[2]).applyQuaternion(q).add(new THREE.Vector3(b.position.x, b.position.y, b.position.z));   // back from body centre to the joint
        corpse.mats[i].compose(p, q, one);
      }
      // the rifle falls from the hand and lies beside him
      const hand = new THREE.Vector3(0, -0.3, 0).applyMatrix4(corpse.mats[PART.farmR]);
      if (rd.t < 0.25) corpse.rifle.setPosition(hand);
      else if (!rd.rifleDown) { rd.rifleDown = true; const y = this.T.height(hand.x, hand.z) + 0.04; corpse.rifle.compose(new THREE.Vector3(hand.x, y, hand.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6.28, Math.PI / 2, 'YXZ')), one); }
      const asleep = bodies.every(b => b.sleepState === CANNON.Body.SLEEPING);
      // never let a body sink through the ground (safety net under the solver)
      if (!(typeof window !== 'undefined' && window.__ragTest && window.__ragTest.noNet)) for (const b of bodies) { const gh = this.T.height(b.position.x, b.position.z); if (b.position.y < gh - 0.05) { b.position.y = gh + 0.05; b.velocity.y = Math.max(0, b.velocity.y); } }
      if (asleep) this._freeze(rd);
      else if (rd.t > 9) { this._freeze(rd); if (rd.corpse.mats[PART.pelvis].elements[13] - this.T.height(rd.corpse.x, rd.corpse.z) > 0.6) this._settleStatic(rd.corpse, null); }   // never left upright
    }
    this.stats.active = this.active.length; this.stats.bodies = this.world.bodies.length;
  }
}
