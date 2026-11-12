// Soldiers drawn as instanced rigid-part humanoids: every soldier of one side shares one InstancedMesh per body part,
// so 300 men cost ~24 draw calls. The same parts are the ragdoll bodies when a man falls (ragdoll.js).
// Facing: a soldier looks down -Z in his own frame; yaw rotates about +Y (yaw 0 = north = -Z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- the rig: joints in the parent's frame (metres, standing), and the part's box/centre in the joint frame ----------
export const RIG = [
  // name,       parent,      joint offset,            half extents (ragdoll box),  centre offset
  ['pelvis',    -1,          [0, 0.95, 0],            [0.17, 0.11, 0.11],          [0, 0, 0]],
  ['chest',      0,          [0, 0.08, 0],            [0.2, 0.27, 0.13],           [0, 0.27, 0]],
  ['head',       1,          [0, 0.56, 0],            [0.11, 0.13, 0.11],          [0, 0.13, 0]],
  ['uarmL',      1,          [-0.235, 0.47, 0],       [0.055, 0.16, 0.055],        [0, -0.15, 0]],
  ['farmL',      3,          [0, -0.3, 0],            [0.05, 0.16, 0.05],          [0, -0.15, 0]],
  ['uarmR',      1,          [0.235, 0.47, 0],        [0.055, 0.16, 0.055],        [0, -0.15, 0]],
  ['farmR',      5,          [0, -0.3, 0],            [0.05, 0.16, 0.05],          [0, -0.15, 0]],
  ['thighL',     0,          [-0.1, -0.05, 0],        [0.08, 0.23, 0.08],          [0, -0.22, 0]],
  ['shinL',      7,          [0, -0.45, 0],           [0.065, 0.23, 0.07],         [0, -0.22, 0]],
  ['thighR',     0,          [0.1, -0.05, 0],         [0.08, 0.23, 0.08],          [0, -0.22, 0]],
  ['shinR',      9,          [0, -0.45, 0],           [0.065, 0.23, 0.07],         [0, -0.22, 0]],
];
export const PART = Object.fromEntries(RIG.map((r, i) => [r[0], i]));

const UNIFORM = {
  BRI: { cloth: 0x7b6c46, cloth2: 0x6a5c3a, web: 0x8f8461, helmet: 0x5a5c42, leather: 0x4a3524, puttee: 0x6e6040 },
  GER: { cloth: 0x6c6f62, cloth2: 0x5d6055, web: 0x2c2620, helmet: 0x60645c, leather: 0x2a221b, puttee: 0x5d6055 },
};
const SKIN = 0xc99a7c, WOOD = 0x5a3b22, STEEL = 0x2b2d2f;

function colored(g, hex) { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function at(g, x, y, z, rx = 0, ry = 0, rz = 0) { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; }
function merge(list) { return mergeGeometries(list.map(g => { const ng = g.index ? g.toNonIndexed() : g; ng.deleteAttribute('uv'); return ng; })); }
function capsule(r, len, hex, y) { return colored(at(new THREE.CapsuleGeometry(r, len, 3, 8), 0, y, 0), hex); }

// part geometry in the joint frame
function buildParts(side) {
  const U = UNIFORM[side], P = {};
  P.pelvis = merge([colored(new THREE.BoxGeometry(0.33, 0.22, 0.22, 1, 1, 1), U.cloth), colored(at(new THREE.BoxGeometry(0.35, 0.05, 0.24), 0, 0.08, 0), U.web)]);
  const chest = [colored(at(new THREE.CapsuleGeometry(0.17, 0.26, 3, 10), 0, 0.27, 0, 0, 0, 0).scale(1.15, 1, 0.75), U.cloth)];
  chest.push(colored(at(new THREE.CylinderGeometry(0.075, 0.08, 0.1, 8), 0, 0.56, 0), U.cloth2));   // collar / neck
  if (side === 'BRI') {
    // 1908 web equipment: cross-braces, ammunition pouches, the pack and the haversack ("fighting order", ~30 kg on 1 July)
    chest.push(colored(at(new THREE.BoxGeometry(0.05, 0.56, 0.3), 0.1, 0.28, 0, 0, 0, 0.35), U.web), colored(at(new THREE.BoxGeometry(0.05, 0.56, 0.3), -0.1, 0.28, 0, 0, 0, -0.35), U.web));
    chest.push(colored(at(new THREE.BoxGeometry(0.13, 0.15, 0.08), -0.11, 0.12, -0.15), U.web), colored(at(new THREE.BoxGeometry(0.13, 0.15, 0.08), 0.11, 0.12, -0.15), U.web));
    chest.push(colored(at(new THREE.BoxGeometry(0.34, 0.3, 0.16), 0, 0.33, 0.2), U.web), colored(at(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 8), 0, 0.52, 0.2, 0, 0, Math.PI / 2), U.cloth2));
    chest.push(colored(at(new THREE.BoxGeometry(0.18, 0.12, 0.1), 0.0, 0.02, 0.18), U.web));      // entrenching tool
  } else {
    // 1909 leather equipment: braces, three-pocket cartridge pouches either side, bread bag, mess tin, gas-mask tin
    chest.push(colored(at(new THREE.BoxGeometry(0.035, 0.56, 0.3), 0.09, 0.28, 0, 0, 0, 0.12), U.web), colored(at(new THREE.BoxGeometry(0.035, 0.56, 0.3), -0.09, 0.28, 0, 0, 0, -0.12), U.web));
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) chest.push(colored(at(new THREE.BoxGeometry(0.06, 0.09, 0.07), sx * (0.06 + k * 0.055), 0.07, -0.15), U.leather));
    chest.push(colored(at(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), 0.17, 0.08, 0.1), 0x4d5048), colored(at(new THREE.BoxGeometry(0.16, 0.2, 0.1), -0.06, 0.1, 0.17), 0x6b6650));
  }
  P.chest = merge(chest);
  // head with a face, ears and the helmet: Brodie Mk I (shallow bowl, wide brim) / Stahlhelm M1916 (deep, flared skirt, lugs)
  const head = [colored(at(new THREE.SphereGeometry(0.1, 12, 10).scale(0.95, 1.12, 1.02), 0, 0.12, 0), SKIN),
    colored(at(new THREE.BoxGeometry(0.035, 0.06, 0.04), 0, 0.1, -0.1), SKIN), colored(at(new THREE.BoxGeometry(0.11, 0.03, 0.02), 0, 0.15, -0.095), 0x3a2a20)];
  if (side === 'BRI') {
    const prof = [[0.0, 0.25], [0.07, 0.245], [0.11, 0.225], [0.125, 0.19], [0.13, 0.175], [0.19, 0.168], [0.195, 0.162], [0.13, 0.166], [0.12, 0.18], [0.0, 0.2]].map(([r, y]) => new THREE.Vector2(r, y));
    head.push(colored(new THREE.LatheGeometry(prof, 16), U.helmet), colored(at(new THREE.TorusGeometry(0.1, 0.008, 4, 12), 0, 0.08, -0.01, Math.PI / 2.4), U.leather));
  } else {
    const prof = [[0.0, 0.265], [0.07, 0.26], [0.11, 0.235], [0.128, 0.19], [0.13, 0.15], [0.135, 0.11], [0.16, 0.07], [0.165, 0.06], [0.125, 0.1], [0.0, 0.21]].map(([r, y]) => new THREE.Vector2(r, y));
    const helm = new THREE.LatheGeometry(prof, 18);
    // the visor at the front is shorter than the neck-guard skirt at the back
    const p = helm.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i); if (z < 0 && y < 0.12) p.setY(i, y + (0.12 - y) * 0.45 * (-z / 0.16)); }
    head.push(colored(helm, U.helmet), colored(at(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8), 0.13, 0.17, 0, 0, 0, Math.PI / 2), U.helmet), colored(at(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8), -0.13, 0.17, 0, 0, 0, Math.PI / 2), U.helmet));
  }
  P.head = merge(head);
  P.uarm = merge([capsule(0.055, 0.2, U.cloth, -0.15)]);
  P.farm = merge([capsule(0.048, 0.18, U.cloth, -0.12), colored(at(new THREE.SphereGeometry(0.045, 8, 6), 0, -0.29, -0.01), SKIN)]);
  P.thigh = merge([capsule(0.075, 0.3, U.cloth, -0.22)]);
  // puttees (British) or marching boots (German), and the boot
  P.shin = merge([capsule(0.06, 0.26, side === 'BRI' ? U.puttee : U.leather, -0.2), colored(at(new THREE.BoxGeometry(0.1, 0.09, 0.25), 0, -0.42, -0.05), U.leather)]);
  // rifle: SMLE (shorter, snub nose cap) / Gewehr 98 (long), stock + barrel + bolt + bayonet-less; held in its own frame (-Z = muzzle)
  const L = side === 'BRI' ? 1.13 : 1.25;
  P.rifle = merge([
    colored(at(new THREE.BoxGeometry(0.045, 0.1, 0.36), 0, -0.04, 0.2), WOOD), colored(at(new THREE.BoxGeometry(0.04, 0.05, L * 0.62), 0, 0.0, -L * 0.24), WOOD),
    colored(at(new THREE.CylinderGeometry(0.011, 0.011, L * 0.5, 6), 0, 0.03, -L * 0.42, Math.PI / 2), STEEL), colored(at(new THREE.BoxGeometry(0.04, 0.04, 0.16), 0, 0.035, -0.05), STEEL),
    colored(at(new THREE.BoxGeometry(0.02, 0.06, 0.06), 0, -0.04, -0.07), STEEL)]);
  return P;
}

// ---------- pose: joint rotations (Euler XYZ in the joint frame) for a soldier's current action ----------
const tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
export function pose(out, s, phase, aim, t) {
  // out: array of [rx, ry, rz] per part, plus out.root = { y, pitch }
  for (const r of out) { r[0] = r[1] = r[2] = 0; }
  const walk = Math.sin(phase), walk2 = Math.sin(phase + Math.PI), moving = s.moving;
  const sw = moving ? (s.run ? 0.75 : 0.45) : 0;
  out.root.y = 0; out.root.pitch = 0;
  if (s.stance === 2) {                                     // prone: lying face down, rifle forward
    out.root.y = -0.83; out.root.pitch = -1.45;
    out[PART.head][0] = 1.15; out[PART.uarmR][0] = 2.7; out[PART.farmR][0] = 0.4; out[PART.uarmL][0] = 2.9; out[PART.farmL][0] = 0.2;
    out[PART.thighL][2] = 0.12 + (moving ? walk * 0.2 : 0); out[PART.thighR][2] = -0.12 - (moving ? walk2 * 0.2 : 0);
    out[PART.shinL][0] = 0.1; out[PART.shinR][0] = 0.1;
    return;
  }
  if (s.stance === 1) {                                     // crouched / kneeling on one knee when still
    out.root.y = moving ? -0.32 : -0.42;
    out[PART.chest][0] = -0.35;
    if (moving) { out[PART.thighL][0] = 1.0 + walk * 0.35; out[PART.thighR][0] = 1.0 + walk2 * 0.35; out[PART.shinL][0] = -1.6; out[PART.shinR][0] = -1.6; out[PART.pelvis][0] = -0.25; }
    else { out[PART.thighL][0] = 1.55; out[PART.shinL][0] = -1.55; out[PART.thighR][0] = -0.15; out[PART.shinR][0] = -1.5; out[PART.pelvis][0] = 0; }
  } else {
    out[PART.thighL][0] = walk * sw; out[PART.thighR][0] = walk2 * sw;
    out[PART.shinL][0] = -Math.max(0, -Math.cos(phase)) * sw * 1.4 - 0.05; out[PART.shinR][0] = -Math.max(0, Math.cos(phase)) * sw * 1.4 - 0.05;
    out[PART.chest][0] = moving ? -0.12 - (s.run ? 0.15 : 0) : -0.02;
    out.root.y = moving ? -Math.abs(Math.cos(phase)) * 0.03 : 0;
  }
  if (s.climbing) { out[PART.uarmL][0] = 2.6; out[PART.uarmR][0] = 2.6; out[PART.farmL][0] = 0.3; out[PART.farmR][0] = 0.3; out[PART.thighL][0] = 1.2; out[PART.shinL][0] = -1.4; out[PART.chest][0] = -0.5; return; }
  if (aim) {                                                // rifle to the shoulder
    out[PART.uarmR][0] = 1.25; out[PART.uarmR][2] = 0.35; out[PART.farmR][0] = 0.55; out[PART.farmR][1] = 0.3;
    out[PART.uarmL][0] = 1.35; out[PART.uarmL][2] = -0.15; out[PART.farmL][0] = 0.25;
    out[PART.chest][1] = 0.25; out[PART.head][1] = -0.25; out[PART.head][0] = -s.pitch * 0.5;
    out[PART.chest][0] += -s.pitch * 0.5;
  } else {                                                  // at the port: rifle slanting across the chest
    out[PART.uarmR][0] = 0.55; out[PART.farmR][0] = 1.25; out[PART.farmR][1] = -0.3; out[PART.uarmR][2] = 0.1;
    out[PART.uarmL][0] = 0.75; out[PART.farmL][0] = 1.35; out[PART.farmL][1] = 0.5; out[PART.uarmL][2] = -0.15;
  }
}

// forward kinematics: world matrices per part
export function fk(mats, rootPos, yaw, rot, root) {
  const base = tmpM.makeRotationY(yaw).setPosition(rootPos.x, rootPos.y, rootPos.z);
  for (let i = 0; i < RIG.length; i++) {
    const [, parent, off] = RIG[i], r = rot[i];
    const parentM = parent < 0 ? base : mats[parent];
    let ex = r[0], ey = r[1], ez = r[2];
    const local = mats[i];
    if (parent < 0) {
      tmpE.set(root.pitch + ex, ey, ez); tmpQ.setFromEuler(tmpE);
      local.compose(tmpV.set(off[0], off[1] + root.y, off[2]), tmpQ, ONE);
    } else { tmpE.set(ex, ey, ez); tmpQ.setFromEuler(tmpE); local.compose(tmpV.set(off[0], off[1], off[2]), tmpQ, ONE); }
    local.premultiply(parentM);
  }
  return mats;
}

export class SoldiersView {
  constructor(scene, sim, maxCorpses = 260) {
    this.scene = scene; this.sim = sim;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 });
    const n = sim.soldiers.length + maxCorpses;
    this.cap = n; this.meshes = {};
    for (const side of ['BRI', 'GER']) {
      const P = buildParts(side), m = {};
      const partGeo = { pelvis: P.pelvis, chest: P.chest, head: P.head, uarmL: P.uarm, farmL: P.farm, uarmR: P.uarm, farmR: P.farm, thighL: P.thigh, shinL: P.shin, thighR: P.thigh, shinR: P.shin, rifle: P.rifle };
      for (const [k, g] of Object.entries(partGeo)) {
        const im = new THREE.InstancedMesh(g, this.mat, n); im.count = 0; im.castShadow = ['chest', 'head', 'pelvis', 'thighL', 'thighR', 'shinL', 'shinR'].includes(k); im.receiveShadow = true; im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); m[k] = im;
      }
      this.meshes[side] = m;
    }
    this.rot = RIG.map(() => [0, 0, 0]); this.rot.root = { y: 0, pitch: 0 };
    this.mats = RIG.map(() => new THREE.Matrix4());
    this.state = sim.soldiers.map(() => ({ phase: 0, px: 0, pz: 0, moving: false, run: false, aimT: 0 }));
    this.corpses = [];
    this.hidePlayer = true;
  }
  _write(side, mats, rifleM) {
    const m = this.meshes[side], i = m.pelvis.count;
    for (let k = 0; k < RIG.length; k++) m[RIG[k][0]].setMatrixAt(i, mats[k]);
    m.rifle.setMatrixAt(i, rifleM);
    for (const k in m) m[k].count = i + 1;
  }
  rifleMatrix(mats, aim, pitch, out = new THREE.Matrix4()) {
    // the rifle sits in the right hand: muzzle forward when aiming, slanting up-left at the port
    const hand = mats[PART.farmR];
    tmpV.set(0, -0.3, 0).applyMatrix4(hand);
    const chestQ = new THREE.Quaternion().setFromRotationMatrix(mats[PART.chest]);
    const q = aim ? new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * 0.5, -0.25, 0)) : new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, 0.0, 0.75));
    q.premultiply(chestQ);
    return out.compose(tmpV.clone().add(new THREE.Vector3(0, 0, aim ? -0.05 : -0.1).applyQuaternion(q)), q, ONE);
  }
  update(dt, camPos, playerId, cull = 1400) {
    for (const side of ['BRI', 'GER']) for (const k in this.meshes[side]) this.meshes[side][k].count = 0;
    const rm = new THREE.Matrix4();
    for (const s of this.sim.soldiers) {
      const st = this.state[s.id];
      const dx = s.x - st.px, dz = s.z - st.pz, d = Math.hypot(dx, dz); st.px = s.x; st.pz = s.z;
      // speed smoothed over ~0.2 s: render frames outnumber sim ticks, so a raw per-frame speed flickers between walking and standing
      const sp = Math.min(20, d / Math.max(dt, 1e-3)); st.speed = (st.speed ?? 0) + (sp - (st.speed ?? 0)) * Math.min(1, dt * 6); st.moving = st.speed > 0.35; st.run = st.speed > 3.2;
      st.phase += d * (s.stance === 2 ? 3.5 : 2.9);
      if (!s.alive) continue;
      if (s.id === playerId && this.hidePlayer) continue;
      if (Math.abs(s.x - camPos.x) > cull || Math.abs(s.z - camPos.z) > cull) continue;
      const aim = s.ai ? s.ai.target >= 0 && !st.moving : s.ads;
      pose(this.rot, { stance: s.stance, moving: st.moving, run: st.run, pitch: s.pitch, climbing: s.climb > 0 }, st.phase, aim, 0);
      fk(this.mats, { x: s.x, y: s.y, z: s.z }, s.yaw, this.rot, this.rot.root);
      this._write(s.side, this.mats, this.rifleMatrix(this.mats, aim, s.pitch, rm));
    }
    for (const c of this.corpses) this._write(c.side, c.mats, c.rifle);
    for (const side of ['BRI', 'GER']) for (const k in this.meshes[side]) this.meshes[side][k].instanceMatrix.needsUpdate = true;
  }
  // a fresh corpse at the soldier's last pose; ragdoll.js then takes over its matrices
  addCorpse(s) {
    const st = this.state[s.id];
    pose(this.rot, { stance: s.stance, moving: false, pitch: s.pitch }, st.phase, false, 0);
    fk(this.mats, { x: s.x, y: s.y, z: s.z }, s.yaw, this.rot, this.rot.root);
    const c = { side: s.side, id: s.id, mats: this.mats.map(m => m.clone()), rifle: this.rifleMatrix(this.mats, false, 0), yaw: s.yaw, x: s.x, z: s.z };
    this.corpses.push(c);
    const max = this.cap - this.sim.soldiers.length - 2;
    while (this.corpses.length > max) { const old = this.corpses.shift(); old.removed = true; }
    return c;
  }
}
