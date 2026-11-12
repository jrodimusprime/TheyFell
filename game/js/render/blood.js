// Blood on the ground: a splash where a man is hit, and a dark pool that spreads under him once his body settles.
// Instanced flat decals laid along the ground's slope; they stay for the whole battle.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

function splatTexture() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = mulberry32(31);
  // an irregular pool: overlapping blobs, a darker centre, droplets round the edge
  for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = r() * 26, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, rad = 10 + r() * 22;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(70,6,6,0.95)'); gr.addColorStop(0.7, 'rgba(80,8,6,0.8)'); gr.addColorStop(1, 'rgba(90,10,8,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = 34 + r() * 26; g.fillStyle = `rgba(80,8,6,${0.5 + r() * 0.4})`; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1 + r() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Blood {
  constructor(scene, T, max = 4000) {
    this.T = T; this.max = max; this.grow = [];
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({ map: splatTexture(), transparent: true, depthWrite: false, roughness: 0.35, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.InstancedMesh(g, m, max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.mesh.receiveShadow = true;
    scene.add(this.mesh); this.i = 0; this.dummy = new THREE.Object3D();
  }
  _place(i, x, z, size, rot) {
    const T = this.T, y = T.height(x, z), n = T.normal(x, z, 0.4), d = this.dummy;
    d.position.set(x, y + 0.025, z); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...n)); d.rotateY(rot); d.scale.set(size, 1, size); d.updateMatrix();
    this.mesh.setMatrixAt(i, d.matrix); this.mesh.instanceMatrix.needsUpdate = true;
  }
  add(x, z, size, rot = Math.random() * 6.28, growTo = 0, over = 0) {
    const i = this.i; this.i = (this.i + 1) % this.max; this.mesh.count = Math.max(this.mesh.count, i + 1);
    this._place(i, x, z, size, rot);
    if (growTo > size) this.grow.push({ i, x, z, size, to: growTo, rate: (growTo - size) / over, rot });
    return i;
  }
  // a man hit: a splash on the ground just past him, along the shot
  hit(point, dir) { const x = point[0] + dir[0] * (0.5 + Math.random()), z = point[2] + dir[2] * (0.5 + Math.random()); this.add(x, z, 0.25 + Math.random() * 0.25); }
  // a body settled: a pool spreading under the chest over ~25 s
  pool(x, z) { this.add(x, z, 0.3, Math.random() * 6.28, 0.9 + Math.random() * 0.5, 25); }
  update(dt) {
    for (let k = this.grow.length - 1; k >= 0; k--) { const g = this.grow[k]; g.size = Math.min(g.to, g.size + g.rate * dt); this._place(g.i, g.x, g.z, g.size, g.rot); if (g.size >= g.to) this.grow.splice(k, 1); }
  }
}
