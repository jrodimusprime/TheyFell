// Textures for everything built on the battlefield, painted at load in the same way as the ground (groundTex.js):
// hessian sandbags, weathered planks, corrugated iron, woven hurdles, the same churned earth, brick.
// Each is a 512 px tile with a normal map. propMaterial() projects them onto any shape at real-world size:
// each face takes the two axes it spans (scaled by the instance's own size), so a 3 m wall and a 0.6 m sandbag
// both show the texture at its true scale, with no stretching.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';
import { earth, normalMap, wrap, noiseLayer } from './groundTex.js';

const N = 512;
export const TILE = { hessian: 0, wood: 1, iron: 2, wattle: 3, earth: 4, brick: 5 };
const COUNT = 6;
const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };

function hessian(r) {
  const c = canvas(), g = c.getContext('2d');
  g.fillStyle = '#9c8a64'; g.fillRect(0, 0, N, N);
  // the weave: warp and weft threads, every 4 px, each thread its own shade, slubs here and there
  for (let y = 0; y < N; y += 4) { const v = 120 + r() * 50; g.fillStyle = `rgba(${v + 20},${v + 4},${v - 30},0.55)`; g.fillRect(0, y, N, 2); }
  for (let x = 0; x < N; x += 4) { const v = 110 + r() * 50; g.fillStyle = `rgba(${v + 18},${v},${v - 34},0.5)`; g.fillRect(x, 0, 2, N); }
  for (let i = 0; i < 2600; i++) { const x = r() * N, y = r() * N; g.fillStyle = r() < 0.5 ? 'rgba(60,48,30,0.35)' : 'rgba(200,180,140,0.3)'; g.fillRect(x, y, 2 + r() * 6, 1.5); }
  // mud soaked into the sacking, chalk dust, a stitched seam
  noiseLayer(g, r, 70, 0.4, ['70,58,42', '96,82,62', '58,48,36']);
  noiseLayer(g, r, 45, 0.25, ['210,204,186']);
  g.strokeStyle = 'rgba(60,48,32,0.6)'; g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(0, N * 0.92); g.lineTo(N, N * 0.92); g.stroke(); g.setLineDash([]);
  return c;
}
function wood(r) {
  // 9-inch boards running along the length (u), dark gaps between, grain, knots, nail heads, weathering
  const c = canvas(), g = c.getContext('2d'), B = 96;
  g.fillStyle = '#5d4a36'; g.fillRect(0, 0, N, N);
  for (let y = 0; y < N; y += B) {
    const base = 128 + r() * 44, tint = r();
    g.fillStyle = `rgb(${base + 26},${base + 8 - tint * 10},${base - 16})`; g.fillRect(0, y + 3, N, B - 6);
    for (let i = 0; i < 70; i++) { const yy = y + 4 + r() * (B - 8), a = 0.12 + r() * 0.2, dark = r() < 0.6;
      g.strokeStyle = dark ? `rgba(40,28,18,${a})` : `rgba(190,160,120,${a})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); g.moveTo(0, yy);
      for (let x = 0; x <= N; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + i) * 2 + (r() - 0.5) * 1.2); g.stroke(); }
    for (let k = 0; k < 1 + r() * 2; k++) { const x = r() * N, yy = y + 15 + r() * (B - 30); wrap((ox, oy) => { g.fillStyle = 'rgba(45,30,18,0.7)'; g.beginPath(); g.ellipse(x + ox, yy + oy, 6 + r() * 6, 4, 0, 0, 7); g.fill(); }); }
    for (const x of [N * 0.12, N * 0.62]) { g.fillStyle = 'rgba(30,26,24,0.9)'; g.fillRect(x, y + 14, 4, 4); g.fillRect(x, y + B - 18, 4, 4); }
    g.fillStyle = 'rgba(20,14,10,0.9)'; g.fillRect(0, y, N, 3); g.fillRect(0, y + B - 3, N, 3);
  }
  noiseLayer(g, r, 150, 0.1, ['170,160,140', '80,66,50']);   // grey weathering and mud, broad and faint
  return c;
}
function iron(r) {
  const c = canvas(), g = c.getContext('2d');
  for (let x = 0; x < N; x++) { const v = 112 + Math.sin(x / N * Math.PI * 2 * 16) * 38; g.fillStyle = `rgb(${v},${v + 2},${v + 4})`; g.fillRect(x, 0, 1, N); }
  noiseLayer(g, r, 60, 0.45, ['120,70,38', '96,52,28', '150,96,56']);                    // rust
  for (let i = 0; i < 60; i++) { const x = r() * N, y = r() * N, l = 40 + r() * 160; g.strokeStyle = 'rgba(110,60,30,0.35)'; g.lineWidth = 2 + r() * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + l); g.stroke(); }
  g.fillStyle = 'rgba(30,26,24,0.8)'; for (let y = 24; y < N; y += 230) for (let x = 0; x < N; x += 64) g.fillRect(x + 14, y, 5, 5);   // bolts
  return c;
}
function wattle(r) {
  // withies woven horizontally over and under upright stakes
  const c = canvas(), g = c.getContext('2d'), W = 22, S = 85;
  g.fillStyle = '#2e2418'; g.fillRect(0, 0, N, N);
  for (let y = 0, row = 0; y < N; y += W, row++) for (let x = 0, col = 0; x < N; x += S, col++) {
    const over = (row + col) % 2 === 0, base = 130 + r() * 50;
    const gr = g.createLinearGradient(0, y, 0, y + W); gr.addColorStop(0, `rgb(${base * 0.55},${base * 0.45},${base * 0.3})`); gr.addColorStop(0.5, `rgb(${base + (over ? 20 : 0)},${base * 0.82},${base * 0.55})`); gr.addColorStop(1, `rgb(${base * 0.5},${base * 0.4},${base * 0.28})`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x + S / 2, y + W / 2, S / 2 + 4, W / 2 - (over ? 0 : 2), 0, 0, 7); g.fill();
  }
  for (let x = 0; x < N; x += S) { g.fillStyle = 'rgba(60,46,30,0.95)'; g.fillRect(x - 6, 0, 12, N); }
  noiseLayer(g, r, 60, 0.25, ['70,58,42']);
  return c;
}
function brick(r) {
  // Picardy brick and chalk walls: courses of red brick, lime mortar, plaster, smoke and chalk
  const c = canvas(), g = c.getContext('2d'), H = 32, L = 112;
  g.fillStyle = '#b7ab92'; g.fillRect(0, 0, N, N);
  for (let y = 0, row = 0; y < N; y += H, row++) for (let x = -(row % 2) * L / 2; x < N; x += L) {
    const v = r(), red = 140 + v * 50; g.fillStyle = `rgb(${red},${80 + v * 30},${60 + v * 18})`; g.fillRect(x + 3, y + 3, L - 6, H - 6);
    g.fillStyle = `rgba(40,20,14,${r() * 0.25})`; g.fillRect(x + 3, y + 3, L - 6, H - 6);
  }
  noiseLayer(g, r, 90, 0.35, ['200,192,170', '60,52,46']);
  return c;
}

export function makePropTextures(renderer) {
  const r = mulberry32(1917);
  const srcs = [hessian(r), wood(r), iron(r), wattle(r), earth(r), brick(r)];
  const atlas = document.createElement('canvas'); atlas.width = N; atlas.height = N * COUNT;
  const ag = atlas.getContext('2d'); srcs.forEach((c, i) => ag.drawImage(c, 0, i * N));
  const nrm = new Uint8Array(N * N * COUNT * 4); [6, 7, 9, 10, 9, 6].forEach((s, i) => nrm.set(normalMap(srcs[i], s), i * N * N * 4));
  const color = new THREE.CanvasTexture(atlas); color.colorSpace = THREE.SRGBColorSpace; color.flipY = false;   // rows top to bottom, like the normal-map data
  const normal = new THREE.DataTexture(nrm, N, N * COUNT, THREE.RGBAFormat); normal.needsUpdate = true;
  for (const t of [color, normal]) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
  return { color, normal };
}

// a material showing one tile of the atlas, projected at `metres` per tile, with relief; tint multiplies the colour
export function propMaterial(tex, tile, metres, { tint = 0xffffff, roughness = 0.95, metalness = 0, relief = 1, bright = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness, metalness });
  m.color.multiplyScalar(bright);   // trench faces stand in shadow under a low sun: lift them
  m.onBeforeCompile = sh => {
    sh.uniforms.uPTex = { value: tex.color }; sh.uniforms.uPNrm = { value: tex.normal };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPObj; varying vec3 vPN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 sc = vec3(1.);
        #ifdef USE_INSTANCING
          sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vPObj = position * sc + instanceMatrix[3].xyz * .37;   // offset per instance so neighbours don't repeat in step
        #else
          vPObj = position;
        #endif
          vPN = normal; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D uPTex; uniform sampler2D uPNrm; varying vec3 vPObj; varying vec3 vPN;
      vec2 pUV() { vec3 a = abs(vPN); vec2 p = a.x > a.y && a.x > a.z ? vPObj.zy : a.y > a.z ? vPObj.xz : vPObj.xy; return p / ${metres.toFixed(3)}; }
      vec4 pTile(sampler2D t, vec2 p) { return textureGrad(t, vec2(fract(p.x), (${tile.toFixed(1)} + clamp(fract(p.y), .002, .998)) / ${COUNT.toFixed(1)}), dFdx(p), dFdy(p) * vec2(1., 1. / ${COUNT.toFixed(1)})); }
      mat3 pTBN(vec3 N, vec3 p, vec2 uv) { vec3 dp1 = dFdx(p), dp2 = dFdy(p); vec2 du1 = dFdx(uv), du2 = dFdy(uv);
        vec3 d2 = cross(dp2, N), d1 = cross(N, dp1), T = d2 * du1.x + d1 * du2.x, B = d2 * du1.y + d1 * du2.y;
        float k = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12)); return mat3(T * k, B * k, N); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= pTile(uPTex, pUV()).rgb;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec2 uv = pUV(); vec3 mn = pTile(uPNrm, uv).xyz * 2. - 1.; mn.xy *= ${relief.toFixed(2)};
        normal = normalize(pTBN(normal, -vViewPosition, uv) * mn); }`);
  };
  return m;
}
