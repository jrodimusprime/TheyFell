// Bombs you can see: the Mills bomb and the German stick grenade in a man's hand as he throws, tumbling through the air
// and lying where they come to rest until they go off; and, for the player, the aiming arc (the path the sim will
// follow, from the same physics) with a ring where it first lands.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THROW_TICKS, THROW_RELEASE, nadePath } from '../sim/sim.js';

// a model scaled to its real length (Mills 9.5 cm, stick grenade 36 cm), centred, its long axis along local +Y
function fit(scene, length) {
  const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const inner = new THREE.Group(); inner.add(scene); scene.position.sub(c);
  const long = size.x > size.y && size.x > size.z ? 'x' : size.z > size.y ? 'z' : 'y';
  if (long === 'x') inner.rotation.z = Math.PI / 2; else if (long === 'z') inner.rotation.x = Math.PI / 2;
  inner.scale.setScalar(length / size[long]);
  const g = new THREE.Group(); g.add(inner);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material) { o.material = o.material.clone(); o.material.metalness = Math.min(o.material.metalness ?? 0, 0.3); } } });
  return g;
}

export async function loadGrenades(scene) {
  const L = new GLTFLoader(), load = u => new Promise((res, rej) => L.load(u, res, undefined, rej));
  const [m, s] = await Promise.all([load('models/weapons/grenade_mills.glb'), load('models/weapons/stielhandgranate.glb')]);
  // the stand-in pineapple model is olive; a Mills bomb was cast iron, painted dark
  m.scene.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color?.multiplyScalar(0.55); } });
  return new Grenades(scene, { mills: fit(m.scene, 0.095), stick: fit(s.scene, 0.36) });
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
class Grenades {
  constructor(scene, protos) {
    this.scene = scene; this.protos = protos; this.pool = { mills: [], stick: [] }; this.used = { mills: 0, stick: 0 };
    // the arc: a dashed line along the path, a ring where it first lands
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 300), 3));
    this.arc = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xf2e6c8, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.85, depthTest: false }));
    this.arc.frustumCulled = false; this.arc.renderOrder = 10; this.arc.visible = false; scene.add(this.arc);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), new THREE.MeshBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 11; this.ring.visible = false; scene.add(this.ring);
  }
  _get(kind) {
    const p = this.pool[kind]; let m = p[this.used[kind]];
    if (!m) { m = this.protos[kind].clone(); this.scene.add(m); p.push(m); }
    this.used[kind]++; m.visible = true; return m;
  }
  update(sim, skinned, cam, hidePlayerId) {
    this.used.mills = this.used.stick = 0;
    const cx = cam.position.x, cz = cam.position.z;
    for (const g of sim.grenades) {
      if (Math.abs(g.x - cx) + Math.abs(g.z - cz) > 250) continue;
      const m = this._get(g.kind); m.position.set(g.x, g.y + (g.kind === 'stick' ? 0.03 : 0.0), g.z);
      if (g.rest) {   // lying on the ground: a stick grenade on its side, a Mills bomb on its side too, at a turn of its own
        if (!m.userData.restAt || m.userData.restId !== g.id) { m.userData.restAt = 1; m.userData.restId = g.id; m.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, (g.id * 2.39) % (Math.PI * 2), 0, 'YXZ')); }
      } else {        // tumbling end over end about the axis across its flight
        m.userData.restAt = 0;
        _v.set(g.vx, 0, g.vz); if (_v.lengthSq() < 1e-4) _v.set(1, 0, 0); _ax.set(-_v.z, 0, _v.x).normalize();
        m.quaternion.setFromAxisAngle(_ax, g.age * (g.kind === 'stick' ? 0.32 : 0.22) + g.id);
      }
    }
    // in the hand of a man throwing (drawn skinned), until it leaves it
    for (const s of sim.soldiers) {
      if (!(s.throw > THROW_RELEASE) || !s.alive || s.id === hidePlayerId || s.throw > THROW_TICKS - 8) continue;
      const e = skinned.byId.get(s.id); if (!e) continue;
      const h = e.bones.hand_r, f = e.bones.middle_01_r; if (!h || !f) continue;
      const m = this._get(s.side === 'GER' ? 'stick' : 'mills');
      h.getWorldPosition(_v); f.getWorldPosition(_w); m.position.copy(_v).lerp(_w, 0.75);
      h.getWorldQuaternion(_q); m.quaternion.copy(_q);
      if (s.side === 'GER') m.position.addScaledVector(_w.sub(_v).normalize().applyAxisAngle(_ax.set(0, 1, 0), 0), 0);
    }
    for (const k of ['mills', 'stick']) for (let i = this.used[k]; i < this.pool[k].length; i++) this.pool[k][i].visible = false;
  }
  // the aiming arc from a launch (nadeLaunch), or hide it
  showArc(L, T) {
    if (!L) { this.arc.visible = this.ring.visible = false; return null; }
    const P = nadePath(L, T, 5.5), pos = this.arc.geometry.attributes.position, n = Math.min(300, P.pts.length);
    for (let i = 0; i < n; i++) pos.setXYZ(i, ...P.pts[i]);
    pos.needsUpdate = true; this.arc.geometry.setDrawRange(0, n); this.arc.computeLineDistances(); this.arc.geometry.computeBoundingSphere();
    this.arc.visible = true; this.ring.visible = true; this.ring.position.set(P.land[0], P.land[1] + 0.06, P.land[2]);
    return P;
  }
}
