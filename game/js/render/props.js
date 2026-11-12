// Battlefield dressing. Everything is instanced: one draw call per prop type, whatever the count.
// - Trench dressing (duckboards, revetted walls, sandbag parapets) is streamed around the camera (rebuilt every ~20 m moved).
// - Barbed wire (pickets + strands) is streamed within 350 m.
// - Ruined houses and woods are static for the whole 6 km map.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, hash2 } from '../core/rng.js';

const worldPattern = (mat, kind) => {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        ${kind === 'plank' ? `
          float row = floor(vWP.y * 5.0), along = vWP.x * 0.7 + vWP.z * 0.7;
          float seam = smoothstep(.0, .06, fract(vWP.y * 5.0)) * smoothstep(1., .94, fract(vWP.y * 5.0));
          float post = step(.465, abs(fract(along / 1.6) - .5));
          float t = hh(vec2(row, floor(along / 1.6)));
          vec3 wood = mix(vec3(.52, .42, .3), vec3(.68, .56, .4), t) * (.7 + .3 * seam);
          // chalk-mud splashes low on the walls
          wood = mix(wood, vec3(.62, .6, .55), smoothstep(.6, 1., hh(floor(vWP.xz * 3.)) ) * .25);
          diffuseColor.rgb *= mix(wood, vec3(.3, .22, .14), post);` : ''}
        ${kind === 'brick' ? `
          vec2 b = vec2(vWP.x + vWP.z, vWP.y) * vec2(4.4, 13.3);
          b.x += step(1., mod(floor(b.y), 2.)) * .5;
          vec2 f = fract(b); float mortar = step(.08, f.x) * step(.1, f.y);
          float t = hh(floor(b));
          vec3 brick = mix(vec3(.55, .3, .22), vec3(.66, .42, .3), t);
          brick = mix(brick, vec3(.78, .75, .68), .35 * hh(floor(b * .25)));   // chalk-and-brick Picardy walls, plaster
          diffuseColor.rgb *= mix(vec3(.62, .6, .55), brick, mortar);` : ''}
        ${kind === 'bag' ? `
          float t = hh(floor(vWP.xz * 2.3 + vWP.y * 3.));
          diffuseColor.rgb *= mix(vec3(.62, .57, .44), vec3(.74, .7, .58), t) * (.85 + .15 * hh(vWP.xz * 40.));` : ''}
      }`);
  };
  return mat;
};

export class Props {
  constructor(scene, T, F) {
    this.T = T; this.F = F; this.scene = scene; this.last = null; this.lastWire = null;
    const dummy = new THREE.Object3D();
    // ---------- streamed trench dressing ----------
    this.plankMat = worldPattern(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), 'plank');
    this.bagMat = worldPattern(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 'bag');
    const board = new THREE.BoxGeometry(1, 1, 1);
    this.duck = this._im(board, new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }), 9000);
    this.floor = this._im(board, new THREE.MeshStandardMaterial({ color: 0x4a4034, roughness: 1 }), 3000);       // trench floor: trodden chalky mud
    this.step = this._im(board, this.plankMat, 2000);                                                              // the timber-faced fire-step
    this.walls = this._im(new THREE.PlaneGeometry(1, 1), this.plankMat, 5000, true);
    const bag = new THREE.SphereGeometry(0.5, 8, 5); bag.scale(1, 0.42, 0.62);
    this.bags = this._im(bag, this.bagMat, 16000);
    // ---------- wire ----------
    const picket = new THREE.CylinderGeometry(0.03, 0.04, 1, 5); picket.translate(0, 0.5, 0);
    this.pickets = this._im(picket, new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 }), 6000);
    this.wireGeo = new THREE.BufferGeometry(); this.wirePos = new Float32Array(6000 * 12 * 3);
    this.wireGeo.setAttribute('position', new THREE.BufferAttribute(this.wirePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.wire = new THREE.LineSegments(this.wireGeo, new THREE.LineBasicMaterial({ color: 0x2a2622, transparent: true, opacity: 0.85 }));
    this.wire.frustumCulled = false; scene.add(this.wire);
    // ---------- ruined villages ----------
    const brickMat = worldPattern(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), 'brick');
    const nWalls = F.houses.reduce((s, h) => s + h.walls.length, 0);
    const walls = this._im(new THREE.BoxGeometry(1, 1, 1), brickMat, nWalls + 10); walls.count = 0;
    for (const h of F.houses) for (const w of h.walls) {
      const L = Math.hypot(w.bx - w.ax, w.bz - w.az), y = Math.min(T.height(w.ax, w.az), T.height(w.bx, w.bz)) - 0.3;
      dummy.position.set((w.ax + w.bx) / 2, y + (w.h + 0.3) / 2, (w.az + w.bz) / 2); dummy.rotation.set(0, -Math.atan2(w.bz - w.az, w.bx - w.ax), 0); dummy.scale.set(L + 0.2, w.h + 0.3, 0.45);
      dummy.updateMatrix(); walls.setMatrixAt(walls.count++, dummy.matrix);
    }
    walls.castShadow = true;
    const rubble = new THREE.DodecahedronGeometry(1, 0); rubble.scale(1, 0.35, 1);
    const rub = this._im(rubble, brickMat, F.houses.length * 3); rub.count = 0;
    const r = mulberry32(99);
    for (const h of F.houses) for (let k = 0; k < 3; k++) {
      const x = h.x + r.range(-h.w / 2, h.w / 2), z = h.z + r.range(-h.l / 2, h.l / 2), s = r.range(1.2, 3) * h.ruin;
      dummy.position.set(x, T.height(x, z) - 0.2, z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(s, s * r.range(0.6, 1.3), s * r.range(0.8, 1.4)); dummy.updateMatrix(); rub.setMatrixAt(rub.count++, dummy.matrix);
    }
    // ---------- woods: trunks, shattered stumps, crowns ----------
    const trunk = new THREE.CylinderGeometry(0.6, 1, 1, 7, 1); trunk.translate(0, 0.5, 0);
    const trunks = this._im(trunk, new THREE.MeshStandardMaterial({ color: 0x4b3f33, roughness: 1 }), F.trees.length); trunks.count = 0;
    const crownG = mergeGeometries([new THREE.IcosahedronGeometry(1, 1), new THREE.IcosahedronGeometry(0.7, 1).translate(0.6, 0.3, 0.2), new THREE.IcosahedronGeometry(0.75, 1).translate(-0.5, 0.2, -0.3)]);
    const crowns = this._im(crownG, new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 1, flatShading: true }), F.trees.length); crowns.count = 0;
    for (const t of F.trees) {
      dummy.position.set(t.x, t.y - 0.3, t.z); dummy.rotation.set(t.lean, t.rot, t.lean * 0.5); dummy.scale.set(t.r, t.h + 0.3, t.r); dummy.updateMatrix(); trunks.setMatrixAt(trunks.count++, dummy.matrix);
      if (!t.shattered) { const s = t.h * 0.3; dummy.position.set(t.x, t.y + t.h * 0.78, t.z); dummy.rotation.set(0, t.rot, 0); dummy.scale.set(s, s * 0.8, s); dummy.updateMatrix(); crowns.setMatrixAt(crowns.count++, dummy.matrix); }
    }
    trunks.castShadow = crowns.castShadow = true;
  }
  _im(g, m, n, double) { const im = new THREE.InstancedMesh(g, m, n); im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.castShadow = !double; if (double) m.side = THREE.DoubleSide; this.scene.add(im); return im; }
  update(cam) {
    const x = cam.position.x, z = cam.position.z;
    if (!this.last || Math.hypot(x - this.last[0], z - this.last[1]) > 18) { this.last = [x, z]; this._trenches(x, z, 150); }
    if (!this.lastWire || Math.hypot(x - this.lastWire[0], z - this.lastWire[1]) > 30) { this.lastWire = [x, z]; this._wire(x, z, 350); }
  }
  _trenches(cx, cz, R) {
    const T = this.T, m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
    this.duck.count = this.walls.count = this.bags.count = this.floor.count = this.step.count = 0;
    const seen = new Set(), C = 8, N = T.tN;
    for (let gz = Math.floor((cz - R) / C); gz <= Math.floor((cz + R) / C); gz++) for (let gx = Math.floor((cx - R) / C); gx <= Math.floor((cx + R) / C); gx++) {
      const l = T.tCells.get(gz * N + gx); if (!l) continue;
      for (const idx of l) {
        if (seen.has(idx)) continue; seen.add(idx);
        const sg = T.segs[idx], L = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az), mx = (sg.ax + sg.bx) / 2, mz = (sg.az + sg.bz) / 2;
        if (Math.hypot(mx - cx, mz - cz) > R || L < 0.2) continue;
        const ux = (sg.bx - sg.ax) / L, uz = (sg.bz - sg.az) / L, yaw = -Math.atan2(uz, ux);
        const floorY = (T.height(mx, mz)), surfL = this._surf(mx - sg.nx * (sg.hw + 0.5), mz - sg.nz * (sg.hw + 0.5)), surfE = this._surf(mx + sg.nx * (sg.hw + 0.5), mz + sg.nz * (sg.hw + 0.5));
        const fy = floorY - (sg.kind === 0 && T.trenchAt(mx, mz, {}).step ? 0.6 : 0);
        // floor strip and fire-step block, sitting over the terrain's own (coarser) cut
        if (this.floor.count < 3000) { e.set(0, yaw, 0); q.setFromEuler(e); const fw = sg.kind === 0 ? sg.hw * 2 - 0.5 : sg.hw * 2; p.set(mx - sg.nx * (sg.kind === 0 ? 0.25 : 0), fy - 0.1, mz - sg.nz * (sg.kind === 0 ? 0.25 : 0)); s.set(L + 0.6, 0.22, fw + 0.1); this.floor.setMatrixAt(this.floor.count++, m.compose(p, q, s)); }
        if (sg.kind === 0 && this.step.count < 2000 && L > 1.5) { e.set(0, yaw, 0); q.setFromEuler(e); p.set(mx + sg.nx * (sg.hw - 0.25), fy + 0.3, mz + sg.nz * (sg.hw - 0.25)); s.set(L, 0.6, 0.5); this.step.setMatrixAt(this.step.count++, m.compose(p, q, s)); }
        // duckboards: slats across the trench floor
        for (let t = 0.2; t < L && this.duck.count < 9000; t += 0.45) {
          const x = sg.ax + ux * t, z = sg.az + uz * t, y = fy + 0.05;
          if (hash2(x * 3 | 0, z * 3 | 0, 5) < 0.05) continue;     // a missing slat
          e.set(0, yaw, 0); q.setFromEuler(e); p.set(x - sg.nx * (sg.kind === 0 ? 0.25 : 0), y, z - sg.nz * (sg.kind === 0 ? 0.25 : 0)); s.set(0.12, 0.04, sg.kind === 0 ? 0.85 : 0.75);
          this.duck.setMatrixAt(this.duck.count++, m.compose(p, q, s));
        }
        // revetted walls each side (wood boards on posts), from the floor to the lip
        for (const side of [-1, 1]) {
          if (this.walls.count >= 5000) break;
          const off = sg.hw * side, top = side > 0 ? surfE : surfL, bot = fy - 0.05, h = top - bot;
          if (h < 0.4) continue;
          e.set(0, yaw + (side > 0 ? Math.PI : 0), 0); q.setFromEuler(e);
          p.set(mx + sg.nx * off, bot + h / 2, mz + sg.nz * off); s.set(L + 0.05, h, 1);
          this.walls.setMatrixAt(this.walls.count++, m.compose(p, q, s));
        }
        // sandbags along the parapet (enemy side) and a row on the parados
        if (sg.kind !== 2) for (let t = 0.25; t < L && this.bags.count < 15800; t += 0.52) {
          const x = sg.ax + ux * t, z = sg.az + uz * t;
          for (const [o, rows] of [[sg.hw + 0.35, sg.kind === 0 ? 3 : 1], [-(sg.hw + 0.3), 1]]) {
            const bx = x + sg.nx * o, bz = z + sg.nz * o, by = this._surf(bx, bz);
            if (this.T.trenchAt(bx, bz, this._t2 || (this._t2 = {})).carve < -0.3) continue;   // corner of a traverse: that spot is trench, not parapet
            for (let r = 0; r < rows; r++) {
              const j = hash2(bx * 7 | 0, bz * 7 | 0, r);
              e.set((j - 0.5) * 0.15, yaw + (r % 2) * 0.25 + (j - 0.5) * 0.3, 0); q.setFromEuler(e);
              p.set(bx + sg.nx * r * 0.22 * Math.sign(o), by - (o > 0 ? 0.36 : 0.2) + r * 0.13 - r * r * 0.02, bz + sg.nz * r * 0.22 * Math.sign(o)); s.set(0.62, 0.55, 0.6);
              this.bags.setMatrixAt(this.bags.count++, m.compose(p, q, s));
            }
          }
        }
      }
    }
    for (const im of [this.duck, this.walls, this.bags, this.floor, this.step]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  }
  _surf(x, z) { const t = this.T.trenchAt(x, z, this._t || (this._t = {})); return this.T.height(x, z) - (t.carve < -0.01 ? t.carve : 0); }
  _wire(cx, cz, R) {
    const F = this.F, m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
    this.pickets.count = 0; let w = 0; const W = this.wirePos;
    const line = (a, b) => { if (w + 6 > W.length) return; W[w++] = a[0]; W[w++] = a[1]; W[w++] = a[2]; W[w++] = b[0]; W[w++] = b[1]; W[w++] = b[2]; };
    for (const sg of F.wire.items) {
      const mx = (sg.ax + sg.bx) / 2, mz = (sg.az + sg.bz) / 2; if (Math.hypot(mx - cx, mz - cz) > R) continue;
      const L = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az), ux = (sg.bx - sg.ax) / L, uz = (sg.bz - sg.az) / L, nx = -uz, nz = ux;
      const rowsN = sg.side === 'GER' ? 3 : 2, prev = [];
      for (let t = 0; t <= L + 0.01 && this.pickets.count < 6000; t += 3) {
        const row = [];
        for (let k = 0; k < rowsN; k++) {
          const o = (k - (rowsN - 1) / 2) * sg.r * 0.7, j = hash2(sg.ax * 10 + t | 0, k, 3);
          const x = sg.ax + ux * t + nx * o + (j - 0.5) * 0.6, z = sg.az + uz * t + nz * o, y = this.T.height(x, z), h = sg.kind === 'apron' && k !== 1 ? 0.7 : 1.15 + j * 0.2;
          e.set((j - 0.5) * 0.2, 0, (j - 0.5) * 0.25); q.setFromEuler(e); p.set(x, y - 0.1, z); s.set(1, h + 0.1, 1);
          this.pickets.setMatrixAt(this.pickets.count++, m.compose(p, q, s));
          row.push([x, y, z, h]);
        }
        if (prev.length) for (let k = 0; k < rowsN; k++) {
          const a = prev[k], b = row[k];
          for (const f of [0.2, 0.55, 0.92]) line([a[0], a[1] + a[3] * f, a[2]], [b[0], b[1] + b[3] * f - 0.08, b[2]]);
          line([a[0], a[1] + a[3], a[2]], [b[0], b[1] + 0.15, b[2]]);   // the diagonal "apron" strands
          if (k + 1 < rowsN) { line([a[0], a[1] + a[3] * 0.9, a[2]], [row[k + 1][0], row[k + 1][1] + 0.2, row[k + 1][2]]); line([b[0], b[1] + b[3] * 0.5, b[2]], [prev[k + 1][0], prev[k + 1][1] + prev[k + 1][3] * 0.6, prev[k + 1][2]]); }
        }
        prev.length = 0; prev.push(...row);
      }
    }
    this.wireGeo.setDrawRange(0, w / 3); this.wireGeo.attributes.position.needsUpdate = true;
    this.pickets.instanceMatrix.needsUpdate = true;
  }
}
