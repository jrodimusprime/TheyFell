// Battlefield dressing. Everything is instanced: one draw call per prop type, whatever the count.
// - Trench dressing (duckboards, revetted walls, sandbag parapets) is streamed around the camera (rebuilt every ~20 m moved).
// - Barbed wire (pickets + strands) is streamed within 350 m.
// - Ruined houses and woods are static for the whole 6 km map.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, hash2 } from '../core/rng.js';

const worldPattern = (mat, kind) => {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying float vFloor;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vFloor = (modelMatrix * instanceMatrix * vec4(0., -.5, 0., 1.)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; varying float vFloor; float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        ${kind === 'plank' ? `
          // 9-inch boards, 2 inches thick: each its own weathering, dark gaps between them, grain, mud splashed up the base
          float by = vWP.y * 4.4, row = floor(by), along = vWP.x * 0.7 + vWP.z * 0.7;
          float seam = smoothstep(.0, .09, fract(by)) * smoothstep(1., .9, fract(by));
          float t = hh(vec2(row, floor(along / 3.1 + row * .37)));
          float grain = .85 + .15 * sin(along * 38. + t * 20. + sin(along * 3. + row) * 2.);
          vec3 wood = mix(vec3(.42, .31, .2), vec3(.6, .47, .32), t) * grain * mix(.22, 1., seam);
          float base = smoothstep(.0, .9, vWP.y - vFloor);
          wood = mix(vec3(.3, .25, .19), wood, clamp(base + hh(floor(vWP.xz * 6.)) * .3, 0., 1.));
          wood = mix(wood, vec3(.6, .58, .52), smoothstep(.75, 1., hh(floor(vWP.xz * 4. + row))) * .3);   // chalk smears
          diffuseColor.rgb *= wood;` : ''}
        ${kind === 'post' ? `
          // squared timber: lengthwise grain, a split here and there, darker end grain at the foot
          float g = vWP.y * 3. + (vWP.x + vWP.z) * .2;
          float t = hh(floor(vWP.xz * 9.));
          vec3 wood = mix(vec3(.24, .17, .11), vec3(.34, .25, .16), t) * (.8 + .2 * sin(g * 25. + sin(g * 3.) * 3.));
          diffuseColor.rgb *= mix(vec3(.27, .22, .17), wood, smoothstep(.0, .5, vWP.y - vFloor));` : ''}
        ${kind === 'brick' ? `
          vec2 b = vec2(vWP.x + vWP.z, vWP.y) * vec2(4.4, 13.3);
          b.x += step(1., mod(floor(b.y), 2.)) * .5;
          vec2 f = fract(b); float mortar = step(.08, f.x) * step(.1, f.y);
          float t = hh(floor(b));
          vec3 brick = mix(vec3(.55, .3, .22), vec3(.66, .42, .3), t);
          brick = mix(brick, vec3(.78, .75, .68), .35 * hh(floor(b * .25)));   // chalk-and-brick Picardy walls, plaster
          diffuseColor.rgb *= mix(vec3(.62, .6, .55), brick, mortar);` : ''}
        ${kind === 'iron' ? `
          // corrugated iron sheets: vertical corrugations, rust coming through the galvanising
          float along = vWP.x * 0.7 + vWP.z * 0.7, c = .75 + .25 * sin(along * 82.);
          float sheet = step(.03, fract(along / .66)) * step(.03, fract(vWP.y / 1.83));
          float rust = smoothstep(.35, .9, hh(floor(vec2(along * 3., vWP.y * 3.))) * .6 + .5 * (1. - smoothstep(.0, 1.2, vWP.y - vFloor)));
          diffuseColor.rgb *= mix(vec3(.46, .47, .46), vec3(.42, .26, .15), rust) * c * mix(.5, 1., sheet);` : ''}
        ${kind === 'wattle' ? `
          // woven hurdles: horizontal withies weaving over and under the stakes
          float along = vWP.x * 0.7 + vWP.z * 0.7, w = fract(vWP.y * 14.), st = fract(along * 2.5);
          float over = step(.5, fract(floor(vWP.y * 14.) * .5 + floor(along * 2.5) * .5));
          float bump = sin(w * 3.1416) * mix(.7, 1., over) * (.75 + .25 * sin(st * 3.1416));
          diffuseColor.rgb *= mix(vec3(.25, .2, .14), vec3(.5, .41, .28), bump) * (.85 + .3 * hh(floor(vec2(along * 2.5, vWP.y * 14.))));` : ''}
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
    this.duck = this._im(board, new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }), 24000);
    this.floor = this._im(board, new THREE.MeshStandardMaterial({ color: 0x4a4034, roughness: 1 }), 9000);       // trench floor: trodden chalky mud
    this.step = this._im(board, this.plankMat, 6000);                                                              // the timber-faced fire-step
    // revetment, built like the real thing: an earth core, 2-inch boards in front of it, 4x4 posts and a waling beam on top
    this.core = this._im(board, new THREE.MeshStandardMaterial({ color: 0x564b3d, roughness: 1 }), 12000);
    this.boards = this._im(board, this.plankMat, 12000);
    this.posts = this._im(board, worldPattern(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 'post'), 20000);
    this.beams = this._im(board, worldPattern(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 'post'), 16000);
    this.iron = this._im(board, worldPattern(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.35 }), 'iron'), 6000);
    this.wattle = this._im(board, worldPattern(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 'wattle'), 6000);
    const bag = new THREE.SphereGeometry(0.5, 8, 5); bag.scale(1, 0.42, 0.62);
    this.bags = this._im(bag, this.bagMat, 40000);
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
    if (!this.last || Math.hypot(x - this.last[0], z - this.last[1]) > 18) { this.last = [x, z]; this._trenches(x, z, 120); }
    if (!this.lastWire || Math.hypot(x - this.lastWire[0], z - this.lastWire[1]) > 30) { this.lastWire = [x, z]; this._wire(x, z, 260); }
  }
  _trenches(cx, cz, R) {
    const T = this.T, m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
    const lists = [this.duck, this.bags, this.floor, this.step, this.core, this.boards, this.posts, this.beams, this.iron, this.wattle];
    for (const im of lists) im.count = 0;
    const put = (im, x, y, z, yaw, sx, sy, sz, rx = 0) => { if (im.count >= im.instanceMatrix.count) return; e.set(rx, yaw, 0); q.setFromEuler(e); p.set(x, y, z); s.set(sx, sy, sz); im.setMatrixAt(im.count++, m.compose(p, q, s)); };
    const seen = new Set(), C = 8, N = T.tN, STEP = 0.25;
    for (let gz = Math.floor((cz - R) / C); gz <= Math.floor((cz + R) / C); gz++) for (let gx = Math.floor((cx - R) / C); gx <= Math.floor((cx + R) / C); gx++) {
      const l = T.tCells.get(gz * N + gx); if (!l) continue;
      for (const idx of l) {
        if (seen.has(idx)) continue; seen.add(idx);
        const sg = T.segs[idx], L = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az), mx = (sg.ax + sg.bx) / 2, mz = (sg.az + sg.bz) / 2;
        if (Math.hypot(mx - cx, mz - cz) > R || L < 0.1) continue;
        const ux = (sg.bx - sg.ax) / L, uz = (sg.bz - sg.az) / L, yaw = -Math.atan2(uz, ux);
        const at = t => [sg.ax + ux * t, sg.az + uz * t];
        const floorAt = (x, z) => T._preBlast(x, z, T.demAt(x, z)) + T.craterAt(x, z) - sg.depth;
        const fy = floorAt(mx, mz);
        // the floor: trodden chalky mud, and duckboards down the middle
        const fo = sg.kind === 0 ? -0.25 : 0, fw = sg.kind === 0 ? sg.hw * 2 - 0.5 : sg.hw * 2;
        put(this.floor, mx + sg.nx * fo, fy - 0.1, mz + sg.nz * fo, yaw, L + 1.3, 0.2, fw + 0.35);   // overlaps its neighbours at joints, tucks under the walls
        // duckboard stringers: the two rails the slats are nailed to
        for (const o of [-0.26, 0.26]) put(this.duck, mx + sg.nx * (fo + o), fy + 0.02, mz + sg.nz * (fo + o), yaw, L + 0.2, 0.06, 0.06);
        for (let t = 0.2; t < L; t += 0.42) {
          const [x, z] = at(t); if (hash2(x * 3 | 0, z * 3 | 0, 5) < 0.05) continue;   // a missing slat
          put(this.duck, x + sg.nx * fo, floorAt(x, z) + 0.06, z + sg.nz * fo, yaw, 0.13, 0.035, sg.kind === 0 ? 0.8 : 0.72);
        }
        // walls: probe each side every 25 cm; a wall stands only where solid ground meets open trench
        for (const side of [-1, 1]) {
          const nx = sg.nx * side, nz = sg.nz * side, keep = [];
          const T0 = -sg.hw, T1 = L + sg.hw;
          for (let t = T0; t <= T1 + 1e-6; t += STEP) { const [x, z] = at(Math.min(t, T1)); keep.push(T.isTrench(x + nx * (sg.hw - 0.15), z + nz * (sg.hw - 0.15)) && !T.isTrench(x + nx * (sg.hw + 0.14), z + nz * (sg.hw + 0.14))); }
          for (let i = 0; i < keep.length;) {
            if (!keep[i]) { i++; continue; }
            let j = i; while (j + 1 < keep.length && keep[j + 1]) j++;
            // one run of wall from sample i to j (the piece's square-ended extent makes corners meet)
            const t0 = T0 + i * STEP - 0.13, t1 = Math.min(T1 + 0.05, T0 + j * STEP + 0.13), n = Math.max(1, Math.ceil((t1 - t0) / 2));
            // what the wall is made of: British fire bays mostly boards (some sandbag walls), communication trenches corrugated iron
            // or boards, German trenches boards or woven hurdles
            const pick = hash2(idx, side + 3, 11), mat = sg.side === 'GER' ? (pick < 0.45 ? 'wattle' : 'boards') : sg.kind === 1 ? (pick < 0.55 ? 'iron' : 'boards') : (pick < 0.25 ? 'bags' : 'boards');
            // a corner post at each end of the run, where the revetment frame finishes against an opening or the next wall
            if (mat !== 'bags') for (const te of [t0, t1]) { const [px, pz] = at(te), top = this._surf(px + nx * (sg.hw + 0.25), pz + nz * (sg.hw + 0.25)), bot = floorAt(px, pz) - 0.15;
              put(this.posts, px + nx * (sg.hw - 0.02), (top + bot) / 2 + 0.03, pz + nz * (sg.hw - 0.02), yaw, 0.12, top - bot + 0.06, 0.14); }
            for (let k = 0; k < n; k++) {
              const a0 = t0 + (t1 - t0) * k / n, a1 = t0 + (t1 - t0) * (k + 1) / n, len = a1 - a0, [x, z] = at((a0 + a1) / 2);
              let top = -1e9; for (let u = 0; u <= 2; u++) { const [qx, qz] = at(a0 + len * u / 2); top = Math.max(top, this._surf(qx + nx * (sg.hw + 0.25), qz + nz * (sg.hw + 0.25))); }
              const bot = floorAt(x, z) - 0.15, h = top - bot; if (h < 0.3) continue;
              const wx = x + nx * sg.hw, wz = z + nz * sg.hw;
              put(this.core, wx + nx * 0.45, bot + (h - 0.18) / 2, wz + nz * 0.45, yaw, len + 0.02, h - 0.18, 0.9);                // the earth behind the revetment, its top just under the ground so the parapet and sandbags sit on it
              if (mat === 'bags') {
                // a sandbag wall, laid header and stretcher, batter leaning back into the earth
                for (let yy = bot + 0.18, r = 0; yy < top - 0.05; yy += 0.15, r++) for (let tt = a0 + (r % 2) * 0.3; tt < a1 - 0.05; tt += 0.6) {
                  const [bx, bz] = at(tt + 0.3), jj = hash2(bx * 9 | 0, yy * 9 | 0, 4), back = (yy - bot) * 0.08;
                  put(this.bags, bx + nx * (sg.hw - 0.12 + back), yy, bz + nz * (sg.hw - 0.12 + back), yaw + (jj - 0.5) * 0.12, 0.62, 0.36, 0.42, (jj - 0.5) * 0.1);
                }
                continue;
              }
              const face = mat === 'iron' ? this.iron : mat === 'wattle' ? this.wattle : this.boards;
              put(face, wx - nx * 0.025, bot + (h - 0.06) / 2, wz - nz * 0.025, yaw, len, h - 0.06, mat === 'wattle' ? 0.08 : 0.05);   // 2-inch boards / sheet iron / hurdles
              put(this.beams, wx - nx * 0.05, top - 0.07, wz - nz * 0.05, yaw, len + 0.04, 0.15, 0.1);                            // 4x6 waling along the top
              // 4x4 posts every 1.2 m (hurdles: round stakes every 0.8 m), a little proud of the face
              const sp = mat === 'wattle' ? 0.8 : 1.2;
              for (let pt = Math.ceil(a0 / sp) * sp; pt <= a1; pt += sp) { const [px, pz] = at(pt), lean = (hash2(px * 5 | 0, pz * 5 | 0, 9) - 0.5) * 0.04;
                put(this.posts, px + nx * (sg.hw - 0.1), bot + (h + 0.05) / 2, pz + nz * (sg.hw - 0.1), yaw, mat === 'wattle' ? 0.08 : 0.1, h + 0.05, mat === 'wattle' ? 0.08 : 0.1, lean); }
            }
            // the fire-step runs along the enemy-side wall
            if (sg.kind === 0 && side > 0) {
              const len = t1 - t0, [x, z] = at((t0 + t1) / 2), o = sg.hw - 0.28, y = floorAt(x, z);
              if (len > 0.4) { put(this.step, x + nx * o, y + 0.35, z + nz * o, yaw, len, 0.7, 0.46); put(this.beams, x + nx * (sg.hw - 0.5), y + 0.66, z + nz * (sg.hw - 0.5), yaw, len, 0.08, 0.12); }
            }
            i = j + 1;
          }
        }
        // sandbags along the parapet (enemy side) and a row on the parados
        if (sg.kind !== 2) for (let t = 0.25; t < L; t += 0.52) {
          const [x, z] = at(t);
          for (const [o, rows] of [[sg.hw + 0.42, sg.kind === 0 ? 3 : 1], [-(sg.hw + 0.38), 1]]) {
            const bx = x + sg.nx * o, bz = z + sg.nz * o;
            if (T.isTrench(bx, bz) || T.isTrench(x + sg.nx * Math.sign(o) * (sg.hw + 0.14), z + sg.nz * Math.sign(o) * (sg.hw + 0.14))) continue;   // no wall here: an opening
            const by = this._surf(bx, bz);
            for (let r = 0; r < rows; r++) {
              const j = hash2(bx * 7 | 0, bz * 7 | 0, r);
              put(this.bags, bx + sg.nx * r * 0.22 * Math.sign(o), by - (o > 0 ? 0.32 : 0.2) + r * 0.13 - r * r * 0.02, bz + sg.nz * r * 0.22 * Math.sign(o), yaw + (r % 2) * 0.25 + (j - 0.5) * 0.3, 0.62, 0.55, 0.6, (j - 0.5) * 0.15);
            }
          }
        }
      }
    }
    for (const im of lists) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
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
