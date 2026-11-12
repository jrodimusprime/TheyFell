// Open-world terrain renderer for a 6 km x 6 km true-scale map.
// Quadtree LOD (CDLOD-style chunk selection): 36 root tiles of 1000 m, split down to 15.6 m tiles (0.49 m vertex spacing)
// around the camera. Distant tiles are coarse and fade into fog; tiles outside the view frustum are culled by three.js.
// Crack-hiding skirts, a build budget per frame, and an LRU cache of built tiles keep it smooth while you move.
import * as THREE from 'three';

const S = 32;               // quads per tile side
const ROOT = 1000, MAX_LEVEL = 6;
const SPLIT = 1.6;          // split a tile when the camera is closer than SPLIT x its size

export class TerrainView {
  constructor(T, scene, groundTex, tex) {
    this.T = T; this.scene = scene; this.cache = new Map(); this.queue = []; this.frame = 0; this.split = new Set();
    this.material = makeGroundMaterial(T, groundTex, tex);
    this.group = new THREE.Group(); scene.add(this.group);
    this.stats = { tiles: 0, tris: 0, built: 0 };
    this.version = 0;       // bumped when the ground changes (a mine goes up): stale tiles rebuild
    for (let z = 0; z < 6; z++) for (let x = 0; x < 6; x++) this._build(0, x * ROOT, z * ROOT, ROOT);
    this._outer();
  }
  key(l, x, z) { return l + ':' + x + ':' + z; }
  invalidate(x, z, r) {      // ground changed inside a circle: rebuild those tiles
    // only tiles fine enough to show a shell hole (coarser ones never sample craters); the old tile keeps drawing until
    // its replacement is built, so a shell landing never makes the ground pop to a coarser tile and back
    for (const [k, m] of this.cache) { const u = m.userData; if (u.level < 2) continue; if (x + r < u.x0 || x - r > u.x0 + u.size || z + r < u.z0 || z - r > u.z0 + u.size) continue; u.stale = true; }
  }
  _sampleH(level, x, z) {
    const T = this.T, spacing = ROOT / (1 << level) / S;
    let h = T._preBlast(x, z, T.demAt(x, z));
    this._cut = 0;
    if (spacing < 9) h += T.craterAt(x, z);
    if (spacing < 1.1) { const t = T.trenchAt(x, z, this._tmp || (this._tmp = {}), Math.min(0.55, spacing * 0.55 + 0.05)); h += t.carve < -0.01 ? t.carve : t.bank; /* cut wider than the walls, so the mesh hides behind them */ this._cut = Math.min(1, -Math.min(0, t.carve) / 1.2); }
    else if (spacing < 4.5) { const t = T.trenchAt(x, z, this._tmp || (this._tmp = {})); h += t.bank * 0.8 + Math.max(t.carve, -0.6); this._cut = Math.min(1, -Math.min(0, t.carve) / 1.2) * 0.7; }
    return h;
  }
  _build(level, x0, z0, size) {
    const k = this.key(level, x0, z0), N = S + 1, step = size / S;
    // heights with a 1-sample border for normals
    const H = new Float32Array((N + 2) * (N + 2)), CUT = new Float32Array((N + 2) * (N + 2));
    for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) { const k = (j + 1) * (N + 2) + i + 1; H[k] = this._sampleH(level, x0 + i * step, z0 + j * step); CUT[k] = this._cut; }
    const vCount = N * N + 4 * N, pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), cut = new Float32Array(vCount);
    let p = 0;
    const hAt = (i, j) => H[(j + 1) * (N + 2) + i + 1];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++, p++) {
      pos[p * 3] = i * step; pos[p * 3 + 1] = hAt(i, j); pos[p * 3 + 2] = j * step; cut[p] = CUT[(j + 1) * (N + 2) + i + 1];
      const nx = hAt(i - 1, j) - hAt(i + 1, j), nz = hAt(i, j - 1) - hAt(i, j + 1), ny = 2 * step, l = Math.hypot(nx, ny, nz);
      nor[p * 3] = nx / l; nor[p * 3 + 1] = ny / l; nor[p * 3 + 2] = nz / l;
    }
    // skirts: a curtain hanging under each edge hides cracks between tiles of different detail
    const drop = Math.max(3.5, step * 1.5), edges = [];   // deeper than any trench, so a cut crossing a tile edge never opens a hole
    const edgeIdx = [[...Array(N).keys()].map(i => i), [...Array(N).keys()].map(i => (N - 1) * N + i), [...Array(N).keys()].map(j => j * N), [...Array(N).keys()].map(j => j * N + N - 1)];
    for (const e of edgeIdx) { const start = p; for (const vi of e) { pos[p * 3] = pos[vi * 3]; pos[p * 3 + 1] = pos[vi * 3 + 1] - drop; pos[p * 3 + 2] = pos[vi * 3 + 2]; nor.set(nor.subarray(vi * 3, vi * 3 + 3), p * 3); cut[p] = cut[vi]; p++; } edges.push([e, start]); }
    const idx = [];
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d); }
    for (const [e, s] of edges) for (let i = 0; i < S; i++) { const a = e[i], b = e[i + 1], c = s + i, d = s + i + 1; idx.push(a, b, c, b, d, c, a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aCut', new THREE.BufferAttribute(cut, 1));
    g.setIndex(idx);
    let mn = Infinity, mx = -Infinity; for (let i = 0; i < N * N; i++) { mn = Math.min(mn, pos[i * 3 + 1]); mx = Math.max(mx, pos[i * 3 + 1]); }
    g.boundingBox = new THREE.Box3(new THREE.Vector3(0, mn - drop, 0), new THREE.Vector3(size, mx, size));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const old = this.cache.get(k); if (old) { old.geometry.dispose(); this.group.remove(old); }
    const m = new THREE.Mesh(g, this.material);
    m.position.set(x0, 0, z0); m.receiveShadow = true; m.castShadow = level >= 4; m.matrixAutoUpdate = false; m.updateMatrix();
    m.userData = { level, x0, z0, size, mn, mx, used: this.frame, version: this.version };
    m.visible = !!(old && old.visible); this.group.add(m); this.cache.set(k, m); this.stats.built++;
    return m;
  }
  // a low-detail ring of land beyond the surveyed square, so the horizon is not a cliff (out of bounds, never walkable)
  _outer() {
    const T = this.T, R = 9000, n = 90, g = new THREE.PlaneGeometry(R * 2 + 6000, R * 2 + 6000, n, n); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + 3000, z = p.getZ(i) + 3000, cx = Math.min(5999, Math.max(1, x)), cz = Math.min(5999, Math.max(1, z));
      const out = Math.max(0, Math.hypot(Math.max(0, Math.abs(x - 3000) - 3000), Math.max(0, Math.abs(z - 3000) - 3000)));
      const inside = x > 0 && x < 6000 && z > 0 && z < 6000;
      p.setXYZ(i, x, (inside ? T.demAt(cx, cz) - 6 : T.demAt(cx, cz)) + Math.sin(x * 0.0013) * Math.cos(z * 0.0011) * Math.min(25, out * 0.02) - (inside ? 0 : 0.5), z);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.material); m.receiveShadow = false; this.scene.add(m); this.outer = m;
  }
  update(cam, budgetMs = 5) {
    this.frame++;
    const want = [];
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    const visit = (l, x0, z0, size) => {
      const dx = Math.max(x0 - cx, 0, cx - (x0 + size)), dz = Math.max(z0 - cz, 0, cz - (z0 + size));
      const m = this.cache.get(this.key(l, x0, z0));
      const dy = m ? Math.max(m.userData.mn - cy, 0, cy - m.userData.mx) : 0;
      const d = Math.hypot(dx, dy * 0.7, dz);
      if (l > 0 && d > 1700) return;   // past the fog and the far plane: not drawn at all
      // hysteresis: a split tile stays split until 15% further out, so head-bob at the boundary can't make it pop
      const key = this.key(l, x0, z0), wasSplit = this.split.has(key);
      if (l < MAX_LEVEL && d < size * SPLIT * (wasSplit ? 1.15 : 1)) {
        this.split.add(key);
        const h = size / 2, kids = [[x0, z0], [x0 + h, z0], [x0, z0 + h], [x0 + h, z0 + h]];
        // children that exist (even if stale, being rebuilt) are drawn: no falling back to the coarse parent and back again
        const ready = kids.every(([kx, kz]) => this.cache.has(this.key(l + 1, kx, kz)));
        if (ready || !m) { for (const [kx, kz] of kids) visit(l + 1, kx, kz, h); return; }
        for (const [kx, kz] of kids) if (!this.cache.has(this.key(l + 1, kx, kz))) this.queue.push([l + 1, kx, kz, h, d]);
      }
      else this.split.delete(key);
      if (!m || m.userData.stale) { this.queue.push([l, x0, z0, size, d]); if (!m) return; }
      want.push(m);
    };
    for (let z = 0; z < 6; z++) for (let x = 0; x < 6; x++) visit(0, x * ROOT, z * ROOT, ROOT);
    // build the nearest missing tiles first, within the frame budget
    const t0 = performance.now(), seen = new Set();
    this.queue.sort((a, b) => a[4] - b[4]);
    let built = 0; const uniq = new Set(this.queue.map(q => this.key(q[0], q[1], q[2]))).size;
    for (const q of this.queue) { const k = this.key(q[0], q[1], q[2]); if (seen.has(k)) continue; seen.add(k); this._build(q[0], q[1], q[2], q[3]); built++; if (performance.now() - t0 > budgetMs) break; }
    this.pending = uniq - built;
    this.queue.length = 0;
    for (const m of this.group.children) m.visible = false;
    // draw the current mesh for each wanted tile: a stale tile rebuilt this frame has replaced its old mesh (which drawing
    // the old one would leave a one-frame hole in the ground)
    let tris = 0; for (const w of want) { const u = w.userData, m = this.cache.get(this.key(u.level, u.x0, u.z0)) || w; m.visible = true; m.userData.used = this.frame; tris += m.geometry.index.count / 3; }
    this.stats.tiles = want.length; this.stats.tris = tris;
    // evict least-recently-used fine tiles
    if (this.cache.size > 900) {
      const list = [...this.cache.values()].filter(m => m.userData.level > 0 && m.userData.used < this.frame - 120).sort((a, b) => a.userData.used - b.userData.used);   // never a tile drawn in the last 2 s
      for (const m of list.slice(0, Math.max(0, this.cache.size - 700))) { m.geometry.dispose(); this.group.remove(m); this.cache.delete(this.key(m.userData.level, m.userData.x0, m.userData.z0)); }
    }
    return want.length;
  }
}

// ---------- ground map: what the surface is made of, at 4 m per texel over the whole map ----------
// R = chalk spoil (trench banks, crater ejecta), G = churned / shelled earth, B = road, A = woodland floor
export function buildGroundMap(T, res = 4) {
  const N = Math.ceil(T.size / res), d = new Float32Array(N * N * 4);
  const splat = (x, z, r, ch, v) => {
    const i0 = Math.max(0, Math.floor((x - r) / res)), i1 = Math.min(N - 1, Math.ceil((x + r) / res)), j0 = Math.max(0, Math.floor((z - r) / res)), j1 = Math.min(N - 1, Math.ceil((z + r) / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const dd = Math.hypot(i * res - x, j * res - z) / r; if (dd < 1) { const k = (j * N + i) * 4 + ch; d[k] = Math.min(1, d[k] + v * (1 - dd * dd)); } }
  };
  for (const c of T.craters) { splat(c.x, c.z, c.r * 2.2, 1, 0.55); splat(c.x, c.z, c.r * 1.7, 0, c.r > 3 ? 0.45 : 0.18); }
  for (const s of T.segs) {
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.ceil(L / 2);
    for (let k = 0; k <= n; k++) { const x = s.ax + (s.bx - s.ax) * k / n, z = s.az + (s.bz - s.az) * k / n; splat(x, z, s.kind === 0 ? 5 : 4, 0, s.side === 'GER' ? 0.3 : 0.2); splat(x, z, 8, 1, 0.3); }
  }
  // the week's bombardment: the German front system and no man's land churned to brown earth and chalk
  for (const t of T.map.trenches) if (t.kind === 'fire') {
    const R = t.side === 'GER' ? 150 : 60, v = t.side === 'GER' ? 0.07 : 0.05;
    for (let i = 1; i < t.pts.length; i++) { const [ax, az] = t.pts[i - 1], [bx, bz] = t.pts[i], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 12);
      for (let k = 0; k <= n; k++) splat(ax + (bx - ax) * k / n + (t.side === 'GER' ? -60 : 30), az + (bz - az) * k / n, R, 1, v); }
  }
  for (const s of T.roadSegs) {
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.ceil(L / 2);
    for (let k = 0; k <= n; k++) splat(s.ax + (s.bx - s.ax) * k / n, s.az + (s.bz - s.az) * k / n, s.w * 0.7, 2, 0.6);
  }
  for (const w of T.map.woods) splat(w.c[0], w.c[1], w.r, 3, 1.4);
  for (const v of T.map.villages) splat(v.c[0], v.c[1], v.r * 1.1, 1, 0.5 * v.ruin);
  const u8 = new Uint8Array(N * N * 4); for (let i = 0; i < u8.length; i++) u8[i] = Math.round(d[i] * 255);
  const tex = new THREE.DataTexture(u8, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  tex.userData = { N, res, data: u8 };
  return tex;
}

function makeGroundMaterial(T, groundTex, tex) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uGround = { value: groundTex };
    sh.uniforms.uSize = { value: T.size };
    sh.uniforms.uTex = { value: tex.color };
    sh.uniforms.uNrm = { value: tex.normal };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCut; varying float vCut; varying vec3 vWPos; varying vec3 vWNorm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNorm = normalize(mat3(modelMatrix) * objectNormal); vCut = aCut;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWPos; varying vec3 vWNorm; varying float vCut; uniform sampler2D uGround; uniform float uSize;
      uniform sampler2D uTex; uniform sampler2D uNrm;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= .5; } return s; }
      // one of the three 512px ground tiles (0 grass, 1 earth, 2 chalk), seamless, with correct mip selection across the wrap
      vec4 tile(sampler2D t, float i, vec2 p) { vec2 dx = dFdx(p), dy = dFdy(p);
        return textureGrad(t, vec2(fract(p.x), (i + clamp(fract(p.y), .002, .998)) / 3.), dx, dy * vec2(1., 1. / 3.)); }
      // two scales and a rotation, blended, so the repeat never shows
      const mat2 R1 = mat2(.8, .6, -.6, .8);
      vec4 groundTile(sampler2D t, float i, vec2 w) { return mix(tile(t, i, w / 2.2), tile(t, i, R1 * w / 7.3 + .37), .38); }
      vec3 gN; float gCut;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 uv = vWPos.xz / uSize; vec4 g = texture2D(uGround, uv);
        float camD = length(vWPos - cameraPosition);
        float n1 = fbm(vWPos.xz * 0.012), n2 = fbm(vWPos.xz * 0.09);
        vec3 tg = groundTile(uTex, 0., vWPos.xz).rgb, te = groundTile(uTex, 1., vWPos.xz).rgb, tc = groundTile(uTex, 2., vWPos.xz).rgb;
        // July 1916: summer grass, dried here and there; crop fields behind the lines
        vec3 grass = tg * mix(vec3(.95, 1.02, .9), vec3(1.12, 1.05, .82), n1);
        vec2 fp = mat2(.83, .55, -.55, .83) * vWPos.xz; vec2 fc = floor(fp / vec2(210., 95.));
        float fh = h21(fc), edge = smoothstep(0., 3., min(min(mod(fp.x, 210.), 210. - mod(fp.x, 210.)), min(mod(fp.y, 95.), 95. - mod(fp.y, 95.))));
        vec3 tint = fh < .3 ? vec3(.92, 1.0, .88) : fh < .55 ? vec3(1.32, 1.12, .78) : fh < .75 ? vec3(1.08, 1.06, .86) : vec3(1.15, .98, .85);
        grass *= mix(vec3(1.), tint, (1. - smoothstep(.05, .3, g.g)) * edge * .8);
        vec3 mud = te * (.85 + .3 * n2);
        vec3 chalk = tc * (.9 + .15 * n2);
        vec3 road = mix(te, tc, .45) * vec3(1.05, 1.02, .95);
        vec3 wood = tg * vec3(.62, .58, .55);
        vec3 c = grass; float w;
        c = mix(c, wood, clamp(g.a * 1.2, 0., 1.) * .8);
        w = smoothstep(.12, .55, g.g + (n2 - .5) * .45); c = mix(c, mud, w);
        // shell-torn ground breaks up: grass survives in tufts between the craters
        c = mix(c, grass, w * smoothstep(.62, .78, vn(vWPos.xz * .8)) * (1. - smoothstep(.5, .9, g.g)) * .7);
        c = mix(c, chalk, smoothstep(.55, .9, g.g) * smoothstep(.55, .8, vn(vWPos.xz * 1.3)) * .5);   // chalk thrown up by the shells
        c = mix(c, chalk, smoothstep(.3, .85, g.r + (vn(vWPos.xz * 1.7) - .5) * .45) * .85 * (1. - smoothstep(120., 450., camD) * .7));   // spoil lines fade into the haze
        c = mix(c, road, smoothstep(.25, .5, g.b));
        // steep cuts (crater sides, sunken lanes) show the chalk under the topsoil
        float steep = 1. - clamp(vWNorm.y, 0., 1.);
        c = mix(c, mix(chalk, mud, .4), smoothstep(.45, .8, steep) * .85);
        // under the duckboards: wet trodden mud
        c = mix(c, te * vec3(.45, .42, .4), smoothstep(.3, .9, vCut));
        diffuseColor.rgb *= c;
        // which tile's surface relief to use, by the same weights
        float wg = (1. - w) * (1. - smoothstep(.3, .85, g.r)), wc = smoothstep(.3, .85, g.r) + smoothstep(.45, .8, steep) * .6;
        gN = groundTile(uNrm, 0., vWPos.xz).xyz * wg + groundTile(uNrm, 1., vWPos.xz).xyz * w + groundTile(uNrm, 2., vWPos.xz).xyz * wc;
        gN = gN / max(wg + w + wc, .001) * 2. - 1.;
        gCut = 1. - smoothstep(25., 90., camD);
      }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // surface relief from the ground tiles (in world XZ, carried into view space), fading out with distance
      { vec3 wn = normalize(vWNorm + vec3(gN.x, 0., gN.y) * .9 * gCut); normal = normalize((viewMatrix * vec4(wn, 0.)).xyz); }`);
  };
  return m;
}
