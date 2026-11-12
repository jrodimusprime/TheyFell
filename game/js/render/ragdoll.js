// Physics ragdolls on death (cannon-es). Cosmetic: they never feed back into the deterministic sim.
// Each part of the soldier rig (soldiers.js RIG) becomes a box body; joints are cone-twist constraints with limits.
// The ground is a heightfield patch sampled from the real terrain under the body (trench walls, crater lips, parapets),
// so men fall into trenches, slump against the parapet and roll down shell holes. Settled bodies freeze and leave the world.
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RIG, PART } from './soldiers.js';

const MASS = { pelvis: 14, chest: 26, head: 5, uarmL: 2.5, farmL: 2, uarmR: 2.5, farmR: 2, thighL: 9, shinL: 5, thighR: 9, shinR: 5 };
// joint: [child, parent, pivot in parent joint frame (= the child's joint offset), twist axis, cone angle, twist angle]
const JOINTS = [
  ['chest', 'pelvis', 0.5, 0.3], ['head', 'chest', 0.6, 0.6],
  ['uarmL', 'chest', 1.4, 0.8], ['farmL', 'uarmL', 1.2, 0.3], ['uarmR', 'chest', 1.4, 0.8], ['farmR', 'uarmR', 1.2, 0.3],
  ['thighL', 'pelvis', 0.9, 0.3], ['shinL', 'thighL', 1.1, 0.15], ['thighR', 'pelvis', 0.9, 0.3], ['shinR', 'thighR', 1.1, 0.15],
];
const G_PARTS = 2, G_GROUND = 1;

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
    // far away: no simulation; tip the whole body over about the pelvis, face down or on his back, onto the ground
    const pel = new THREE.Vector3().setFromMatrixPosition(corpse.mats[PART.pelvis]);
    const axis = new THREE.Vector3(Math.cos(corpse.yaw), 0, -Math.sin(corpse.yaw));      // his right-hand side: fall forward or back about it
    const R = new THREE.Matrix4().makeRotationAxis(axis, Math.random() < 0.5 ? -Math.PI / 2 : Math.PI / 2);
    const g = this.T.height(pel.x, pel.z) + 0.13;
    const M = new THREE.Matrix4().makeTranslation(pel.x, g, pel.z).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-pel.x, -pel.y, -pel.z));
    for (const m of corpse.mats) m.premultiply(M);
    corpse.rifle.premultiply(M);
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
