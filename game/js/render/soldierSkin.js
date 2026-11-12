// Paints the uniform onto the skinned soldier models at load, in 3D, and bakes it into their texture.
// For every texel we find where it lies on the body in the bind pose (which bone it belongs to, and where on that part)
// and paint by side: British 1914 Service Dress with 1908 webbing, puttees and ankle boots; German M1915 field grey
// with 1909 leather equipment and marching boots; faces and hands. Cloth weave, wear and mud are painted per texel.
import * as THREE from 'three';
import { mulberry32, hash2 } from '../core/rng.js';

export let DEBUG_LABELS = false; export const setDebugLabels = v => { DEBUG_LABELS = v; };
const PARTS = [   // [label, from bone, to bone] (to null: a sphere at the bone)
  ['head', 'Head', null], ['neck', 'neck_01', 'Head'], ['torso', 'pelvis', 'spine_03'], ['chest', 'spine_03', 'neck_01'],
  ['uarm', 'upperarm_l', 'lowerarm_l'], ['uarm', 'upperarm_r', 'lowerarm_r'], ['farm', 'lowerarm_l', 'hand_l'], ['farm', 'lowerarm_r', 'hand_r'],
  ['hand', 'hand_l', 'middle_02_l'], ['hand', 'hand_r', 'middle_02_r'], ['thigh', 'thigh_l', 'calf_l'], ['thigh', 'thigh_r', 'calf_r'],
  ['shin', 'calf_l', 'foot_l'], ['shin', 'calf_r', 'foot_r'], ['foot', 'foot_l', 'ball_l'], ['foot', 'foot_r', 'ball_r'],
];
const C = (hex) => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; };
const UNI = {
  // 1914 Service Dress khaki (a warm brown-green) and M1915 feldgrau, lighter than they look in old photographs
  BRI: { tunic: C(0x8f8058), trousers: C(0x887a52), web: C(0xb0a882), webDark: C(0x948c66), brass: C(0xc49a44), puttee: C(0x80724c), boot: C(0x5a3e2a), sole: C(0x2a1e16), helmet: C(0x6e6c4c) },
  GER: { tunic: C(0x7c8272), trousers: C(0x70746a), web: C(0x2e2822), webDark: C(0x201c18), brass: C(0x9a9a94), puttee: C(0x2a2420), boot: C(0x2a2520), sole: C(0x161310), helmet: C(0x6a7068) },
};
const SKIN = C(0xc9a593), SKIN_DARK = C(0x9c7a6a), HAIR = C(0x3e2e22);   // a pale, weathered English complexion

// period portraits (AWM, public domain), cropped to the face; landmark pixels within each crop
export const FACES = [
  { url: 'models/faces/arnold.png', eyeR: [45, 53], eyeL: [85, 57], mouth: [60, 99] },
  { url: 'models/faces/law.png', eyeR: [33, 58], eyeL: [66, 56], mouth: [54, 91] },
  { url: 'models/faces/mark.png', eyeR: [73, 80], eyeL: [175, 78], mouth: [130, 220], side: 'BRI' },
];
export async function loadFaces() {
  // each photo's studio lighting is taken out (a high-pass: the features stay, the light-to-shadow gradient goes),
  // so the face is lit only by the game's own sun
  return Promise.all(FACES.map(f => new Promise(res => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'), w = im.width, h = im.height; c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(w * h), B = new Float32Array(w * h), R = 12;
    for (let i = 0; i < w * h; i++) L[i] = d[i * 4];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s2 = 0, n = 0; for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy += 2) for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx += 2) { s2 += L[yy * w + xx]; n++; } B[y * w + x] = s2 / n; }
    for (let i = 0; i < w * h; i++) d[i * 4] = Math.max(0, Math.min(255, 165 + (L[i] - B[i]) * 1.5));
    res({ ...f, w, h, data: d }); }; im.src = f.url; })));
}
function segInfo(p, a, b) { // closest point param and distance from p to segment ab
  const ab = new THREE.Vector3().subVectors(b, a), t = Math.max(0, Math.min(1, new THREE.Vector3().subVectors(p, a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
  return { t, d: p.distanceTo(a.clone().addScaledVector(ab, t)) };
}

export function bakeSoldier(gltf, side, seed = 1, faces = null) {
  // every skinned mesh shares the one texture (the German helmet is its own mesh): paint them all into it
  const meshes = []; gltf.scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  if (!meshes.length) return;
  const mesh = meshes.reduce((a, b) => (a.geometry.attributes.position.count >= b.geometry.attributes.position.count ? a : b));
  gltf.scene.updateMatrixWorld(true);
  const bone = n => { const b = gltf.scene.getObjectByName(n); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const parts = PARTS.map(([label, a, b]) => ({ label, a: bone(a), b: b ? bone(b) : null, side: a.endsWith('_l') ? 1 : a.endsWith('_r') ? -1 : 0 })).filter(q => q.a);
  const head = bone('Head'), pelvis = bone('pelvis'), chest = bone('spine_03'), neck = bone('neck_01');
  const U = UNI[side], r = mulberry32(seed + (side === 'GER' ? 7 : 3));
  const img = mesh.material.map.image, W = img.width, H = img.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const out = g.createImageData(W, H), px = out.data, painted = new Uint8Array(W * H);
  let helmetPass = false;
  const tmp = new THREE.Vector3(), nrm = new THREE.Vector3();
  const noise = (x, y, z, s) => { const f = hash2(Math.floor(x * s), Math.floor(y * s) * 31 + Math.floor(z * s), 3); return f; };
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const colorAt = (p, n) => {
    if (helmetPass) { const spec = 0.85 + 0.25 * noise(p.x, p.y, p.z, 30) + Math.max(0, n.y) * 0.12; return shade(mix(U.helmet, [60, 52, 40], Math.max(0, 0.06 - (p.y - head.y - 0.05)) * 4), spec); }
    // which part of the body
    let best = null, bd = 1e9, bt = 0;
    for (const q of parts) { const s = q.b ? segInfo(p, q.a, q.b) : { t: 0, d: p.distanceTo(q.a) * 1.15 }; if (s.d < bd) { bd = s.d; best = q; bt = s.t; } }
    const L = best.label, front = n.z, up = p.y, x = p.x;
    if (DEBUG_LABELS) return { head: [255, 0, 0], neck: [255, 160, 0], chest: [0, 0, 255], torso: [0, 160, 255], uarm: [0, 255, 0], farm: [0, 120, 0], hand: [255, 255, 0], thigh: [160, 0, 255], shin: [255, 0, 255], foot: [80, 80, 80] }[L];
    // wool serge: weave and wear
    const weave = 0.92 + 0.08 * ((Math.floor(p.x * 900) + Math.floor(p.y * 900)) % 2) + (noise(p.x, p.y, p.z, 60) - 0.5) * 0.12;
    const wear = 0.85 + 0.25 * noise(p.x, p.y, p.z, 9);
    const dirt = Math.max(0, 1 - up / 0.55) * 0.45;   // mud and chalk up the legs
    let c;
    if (L === 'head' || L === 'neck') {
      // face on the front, hair at the back and top; brows, eyes, nose, mouth; British moustache
      const hp = tmp.copy(p).sub(head); c = SKIN;
      // below the jaw: the tunic's stand collar, closed up to the chin
      if (hp.y < -0.03 || (hp.y < 0.0 && hp.z < 0.06)) return shade(U.tunic, 0.88 * weave);
      if (n.z < -0.2 || hp.y > 0.14) c = mix(SKIN, HAIR, 0.85);
      const face = faces && (faces.find(f => f.side === side) || faces.find(f => f.url.includes('law')) || faces[0]);   // per side where we have one
      if (face && n.z > 0.05) {
        // project the photograph: eyes at 8 cm above the head joint, 6.4 cm apart; mouth at 1.4 cm
        const EYE = 0.1, MOUTH = 0.034;   // the model's eye line and mouth, metres above the head joint
        const ex = (face.eyeL[0] + face.eyeR[0]) / 2, ey = (face.eyeL[1] + face.eyeR[1]) / 2, ax = (face.eyeL[0] - face.eyeR[0]) / 0.064, ay = (face.mouth[1] - ey) / (MOUTH - EYE);
        // low-resolution on purpose: the photo is read in blocks, ~28 across the face, hard-edged (the look of a 2002 skin)
        const BLK = Math.max(2, Math.round((face.eyeL[0] - face.eyeR[0]) / 9));
        const fx = Math.floor((ex + hp.x * ax) / BLK) * BLK + BLK / 2, fy = Math.floor((ey + (hp.y - EYE) * ay) / BLK) * BLK + BLK / 2;
        if (fx >= 1 && fy >= 1 && fx < face.w - 2 && fy < face.h - 2 && hp.y < EYE + 0.03) {   // from the brows down: no cap-brim shadow
          let lum = 0, cnt = 0; for (let yy = Math.floor(fy - BLK / 2); yy < fy + BLK / 2; yy++) for (let xx = Math.floor(fx - BLK / 2); xx < fx + BLK / 2; xx++) { if (xx >= 0 && yy >= 0 && xx < face.w && yy < face.h) { lum += face.data[(yy * face.w + xx) * 4]; cnt++; } }
          lum = lum / Math.max(1, cnt) / 255;
          // the photo's light and shade on a warm skin tone; feathered out to the painted skin at the face's edge
          const t = Math.min(1.08, Math.max(0, 0.1 + lum * 1.12)), photo = [SKIN[0] * t, SKIN[1] * t * 0.97, SKIN[2] * t * 0.95];
          const rx = Math.abs(hp.x) / 0.07, ry = Math.abs(hp.y - (EYE - 0.035)) / 0.075, edge = Math.max(rx, ry);
          const w = Math.min(1, Math.max(0, (1 - edge) / 0.25)) * Math.min(1, n.z / 0.35);
          c = mix(c, photo, w);
          return shade(c, 0.98);
        }
      }
      if (!face && n.z > 0.35) {
        const ey = hp.y - 0.075, ax = Math.abs(hp.x);
        if (Math.abs(ey) < 0.012 && ax > 0.018 && ax < 0.05) c = [40, 30, 26];                         // eyes
        else if (Math.abs(ey - 0.024) < 0.007 && ax > 0.014 && ax < 0.055) c = mix(SKIN, HAIR, 0.8);   // brows
        else if (ax < 0.012 && ey < -0.005 && ey > -0.045) c = shade(SKIN, 1.08);                       // nose ridge
        else if (Math.abs(ey + 0.07) < 0.006 && ax < 0.022) c = [120, 70, 60];                         // mouth
        else if (side === 'BRI' && Math.abs(ey + 0.056) < 0.008 && ax < 0.028) c = mix(SKIN, HAIR, 0.75); // moustache
        else if (ax > 0.045 && ey < 0 && ey > -0.06) c = shade(SKIN, 0.92);                             // cheek shadow
      }
      if ((L === 'neck' && up < neck.y + 0.11) || (L === 'head' && (hp.y < -0.045 || (hp.y < 0.005 && hp.z < 0.065)))) c = shade(U.tunic, 0.88);   // the stand collar closes up under the chin (the throat is behind the chin)
      return shade(c, 0.95 + 0.1 * noise(p.x, p.y, p.z, 40));
    }
    if (L === 'hand') return shade(mix(SKIN, SKIN_DARK, noise(p.x, p.y, p.z, 30) * 0.3), 1 - dirt * 0.2);
    if (L === 'foot') return shade(up < 0.035 ? U.sole : U.boot, 0.85 + 0.25 * noise(p.x, p.y, p.z, 25));
    if (L === 'shin') {
      if (side === 'BRI') {
        // puttees: a strip wound spirally from ankle to knee, the boot below
        if (up < 0.13) return shade(U.boot, 0.9);
        const band = (up * 22 + Math.atan2(p.z, x - best.a.x) * 0.5) % 1;
        return shade(mix(U.puttee, [40, 34, 24], dirt * 0.6), (band < 0.12 ? 0.72 : 1) * weave);
      }
      return shade(U.boot, (0.8 + 0.3 * noise(p.x, p.y, p.z, 20)) * (Math.abs(up - 0.42) < 0.01 ? 0.7 : 1));   // German marching boots to the knee
    }
    if (L === 'thigh') return shade(mix(U.trousers, [70, 60, 46], dirt), weave * wear);
    if (L === 'uarm' || L === 'farm') {
      let cc = U.tunic;
      if (L === 'farm' && bt > 0.82) cc = shade(U.tunic, 0.85);   // cuff
      return shade(cc, weave * wear);
    }
    // torso and chest: tunic, then the equipment over it
    let cc = U.tunic;
    const ax = Math.abs(x), belt = Math.abs(up - (pelvis.y + 0.12)) < 0.035;
    if (side === 'BRI') {
      // 1908 web: belt, cross braces over the shoulders, five-pocket ammunition pouches either side of the chest
      const brace = Math.abs(ax - (0.07 + (up - pelvis.y) * 0.05)) < 0.022 && up > pelvis.y + 0.1;
      const pouch = front > 0.3 && up > pelvis.y + 0.12 && up < pelvis.y + 0.34 && ax > 0.04 && ax < 0.17;
      if (belt) cc = U.web; else if (pouch) cc = shade(U.web, (Math.floor((ax - 0.04) / 0.026) % 2 ? 0.86 : 1));
      else if (brace) cc = U.webDark;
      // brass buttons down the front, breast-pocket flaps
      if (front > 0.6 && ax < 0.01 && up > pelvis.y + 0.38 && ((up - pelvis.y) * 12) % 1 < 0.25) cc = U.brass;
      if (front > 0.5 && Math.abs(up - (chest.y + 0.02)) < 0.012 && ax > 0.05 && ax < 0.13) cc = shade(U.tunic, 0.7);
    } else {
      // 1909 leather: black belt, two sets of three cartridge pouches, Y-straps; front buttons
      const brace = Math.abs(ax - (0.06 + (up - pelvis.y) * 0.02)) < 0.015 && up > pelvis.y + 0.1 && (front > 0 || ax < 0.09);
      const pouch = front > 0.3 && up > pelvis.y + 0.08 && up < pelvis.y + 0.18 && ax > 0.03 && ax < 0.16;
      if (belt) cc = U.web; else if (pouch) cc = shade(U.web, (Math.floor((ax - 0.03) / 0.043) % 2 ? 1.35 : 1)); else if (brace) cc = U.web;
      if (front > 0.6 && ax < 0.01 && up > pelvis.y + 0.2 && ((up - pelvis.y) * 12) % 1 < 0.25) cc = U.brass;
    }
    return shade(mix(cc, [70, 60, 46], dirt), weave * wear);
  };
  // rasterise every triangle in texture space with its bind-pose position and normal
  const pA = new THREE.Vector3(), nA = new THREE.Vector3();
  for (const msh of meshes) {
  helmetPass = /helmet/i.test(msh.name);
  const geo = msh.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, idx = geo.index;
  // bind-pose positions in the scene's frame (feet at y=0, facing +Z, left = +X)
  const m = msh.matrixWorld, P = [], N = [];
  for (let i = 0; i < pos.count; i++) { P.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m)); N.push(new THREE.Vector3().fromBufferAttribute(nor, i).transformDirection(m)); }
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    const ux = [uv.getX(i0) * W, uv.getX(i1) * W, uv.getX(i2) * W], vy = [uv.getY(i0) * H, uv.getY(i1) * H, uv.getY(i2) * H];
    const x0 = Math.max(0, Math.floor(Math.min(...ux)) - 1), x1 = Math.min(W - 1, Math.ceil(Math.max(...ux)) + 1), y0 = Math.max(0, Math.floor(Math.min(...vy)) - 1), y1 = Math.min(H - 1, Math.ceil(Math.max(...vy)) + 1);
    const den = (vy[1] - vy[2]) * (ux[0] - ux[2]) + (ux[2] - ux[1]) * (vy[0] - vy[2]); if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const sx = x + 0.5, sy = y + 0.5;
      let a = ((vy[1] - vy[2]) * (sx - ux[2]) + (ux[2] - ux[1]) * (sy - vy[2])) / den, b = ((vy[2] - vy[0]) * (sx - ux[2]) + (ux[0] - ux[2]) * (sy - vy[2])) / den, c = 1 - a - b;
      if (a < -0.02 || b < -0.02 || c < -0.02) continue;
      a = Math.max(0, a); b = Math.max(0, b); c = Math.max(0, c); const s = a + b + c; a /= s; b /= s; c /= s;
      pA.set(0, 0, 0).addScaledVector(P[i0], a).addScaledVector(P[i1], b).addScaledVector(P[i2], c);
      nA.set(0, 0, 0).addScaledVector(N[i0], a).addScaledVector(N[i1], b).addScaledVector(N[i2], c).normalize();
      const col = colorAt(pA, nA), k = (y * W + x) * 4;
      px[k] = Math.min(255, col[0]); px[k + 1] = Math.min(255, col[1]); px[k + 2] = Math.min(255, col[2]); px[k + 3] = 255; painted[y * W + x] = 1;
    }
  }
  }
  // grow the paint a few texels past every island's edge, so mipmaps don't bleed the background into seams
  for (let it = 0; it < 4; it++) { const add = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (painted[i]) continue;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (painted[j]) { add.push([i, j]); break; } }
    for (const [i, j] of add) { px.set(px.subarray(j * 4, j * 4 + 4), i * 4); painted[i] = 1; } }
  g.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.flipY = mesh.material.map.flipY; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = mesh.material.clone(); mat.map = tex; mat.roughness = 0.9; mat.metalness = 0; mat.color.setScalar(1.2); mat.needsUpdate = true;
  for (const msh of meshes) msh.material = mat;
  return tex;
}

// the Brodie Mk I steel helmet (1916): a shallow dome on a wide brim that droops a little, a rolled edge, oval (30 x 27 cm),
// matt khaki-green with the sand-gritted paint used against glare; a leather chinstrap. Fixed to the head bone.
function brodieTexture() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = mulberry32(19);
  g.fillStyle = '#5c5b40'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) { const v = 70 + r() * 40; g.fillStyle = `rgba(${v + 14},${v + 12},${v - 6},${0.35 + r() * 0.3})`; g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2); }   // sand grit
  for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(66,54,40,${0.08 + r() * 0.1})`; g.beginPath(); g.arc(r() * N, r() * N, 2 + r() * 5, 0, 7); g.fill(); }     // a little mud and wear
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t;
}
export function addBrodie(gltf) {
  const head = gltf.scene.getObjectByName('Head'); if (!head) return;
  gltf.scene.updateMatrixWorld(true);
  // profile (radius, height) from the crown to the rolled edge of the brim, then back under the brim to the dome's rim
  const prof = [[0.0, 0.108], [0.035, 0.107], [0.07, 0.1], [0.095, 0.085], [0.112, 0.062], [0.12, 0.04], [0.123, 0.024], [0.13, 0.018], [0.152, 0.009], [0.172, 0.0], [0.178, -0.004], [0.176, -0.008], [0.168, -0.005], [0.15, 0.003], [0.128, 0.012], [0.12, 0.02]].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(prof, 36); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: brodieTexture(), color: 0xffffff, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide });
  const helm = new THREE.Group(); helm.name = 'Brodie';
  const shell = new THREE.Mesh(geo, mat); shell.castShadow = true; shell.scale.set(0.86, 1, 0.78); helm.add(shell);   // oval, longer front to back
  // chinstrap: a thin leather band from the brim down under the chin
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 4, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3e2c1e, roughness: 0.8 }));
  strap.rotation.set(0, Math.PI / 2, Math.PI); strap.position.set(0, -0.005, 0.01); strap.scale.set(1, 1.35, 1); helm.add(strap);
  const hp = head.getWorldPosition(new THREE.Vector3());
  helm.position.set(hp.x, hp.y + 0.135, hp.z - 0.01); helm.rotation.x = -0.06;   // brim just above the brows, a little back on the head
  gltf.scene.add(helm); helm.updateMatrixWorld(true); head.attach(helm);
}

// ---------- holding the rifle: place the rifle for the stance, then put both hands on it with two-bone IK ----------
// The rifle group's frame: origin at the butt plate, +Z to the muzzle, +Y up. Grips: the wrist of the stock (right hand)
// and under the fore-end (left hand), in metres along the rifle.
const _v = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector3()), _q = [0, 1, 2, 3].map(() => new THREE.Quaternion()), _m = new THREE.Matrix4();
export function makeRifleRig(gunScene, kind) {
  const g = new THREE.Group(), r = gunScene.clone();
  if (kind === 'smle') r.position.set(-0.005, -0.069, 0.565);
  else { r.position.set(-0.042, -0.053, 0.555); for (const n of ['Clip', 'Bullet1', 'Bullet2', 'Bullet3', 'Bullet4', 'Bullet5']) { const b = r.getObjectByName(n); if (b) b.visible = false; } }
  r.traverse(m => { if (m.isMesh) m.castShadow = true; });
  g.add(r); g.userData.grips = kind === 'smle' ? { right: 0.27, left: 0.6, drop: 0.035 } : { right: 0.28, left: 0.62, drop: 0.035 };
  return g;
}
export function aimBone(bone, from, to) {
  // rotate bone (about its world position) so that the world point `from` swings onto the direction of `to`
  const P = bone.getWorldPosition(_v[0]), a = _v[1].subVectors(from, P).normalize(), b = _v[2].subVectors(to, P).normalize();
  const dq = _q[0].setFromUnitVectors(a, b), wq = bone.getWorldQuaternion(_q[1]);
  const nw = _q[2].multiplyQuaternions(dq, wq), pq = bone.parent.getWorldQuaternion(_q[3]).invert();
  bone.quaternion.multiplyQuaternions(pq, nw); bone.updateMatrixWorld(true);
}
export function twoBoneIK(upper, lower, hand, target, pole) {
  const S = upper.getWorldPosition(_v[3]).clone(), E = lower.getWorldPosition(_v[4]).clone(), W = hand.getWorldPosition(_v[5]).clone();
  const a = S.distanceTo(E), b = E.distanceTo(W), toT = _v[6].subVectors(target, S), d = Math.min(Math.max(toT.length(), 0.05), a + b - 1e-3);
  const dir = toT.normalize(), pp = _v[7].copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))), sinA = Math.sqrt(1 - cosA * cosA);
  const Ep = S.clone().addScaledVector(dir, a * cosA).addScaledVector(pp, a * sinA);
  aimBone(upper, E, Ep);
  aimBone(lower, hand.getWorldPosition(new THREE.Vector3()), S.clone().addScaledVector(dir, d));
}
// pose: 'aim' (butt in the shoulder, along the line of fire), 'port' (slanting across the body), 'low' (held low, muzzle forward)
export function holdRifle(root, gun, pose, pitch = 0, bones = null) {
  root.updateMatrixWorld(true);
  const B = n => (bones && bones[n]) || root.getObjectByName(n), sh = B('upperarm_r').getWorldPosition(new THREE.Vector3()), pel = B('pelvis').getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(root.matrixWorld), left = new THREE.Vector3(1, 0, 0).transformDirection(root.matrixWorld), up = new THREE.Vector3(0, 1, 0);
  let butt, dir;
  const headP = B('Head').getWorldPosition(new THREE.Vector3());
  if (pose === 'aim') {
    // butt in the pocket inboard of the shoulder joint, the comb just under the cheek, sights on the eye line
    dir = fwd.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    const pocket = sh.clone().lerp(headP, 0.3);
    butt = pocket.addScaledVector(left, 0.05).addScaledVector(fwd, 0.02); butt.y = headP.y - 0.1;
  } else if (pose === 'port') {
    // at the port: slanting across the body, muzzle up past the left shoulder, butt by the right hip
    dir = up.clone().multiplyScalar(0.62).addScaledVector(left, 0.7).addScaledVector(fwd, 0.3).normalize();
    butt = pel.clone().addScaledVector(left, -0.2).addScaledVector(fwd, 0.18).addScaledVector(up, -0.05);
  } else {
    dir = fwd.clone().multiplyScalar(0.92).addScaledVector(up, -0.3).addScaledVector(left, 0.2).normalize();
    butt = pel.clone().addScaledVector(left, -0.17).addScaledVector(fwd, 0.02).addScaledVector(up, 0.12);
  }
  // the rifle's own up: as near world up as the barrel allows (sights on top)
  const rUp = up.clone().addScaledVector(dir, -up.dot(dir)).normalize(), rX = new THREE.Vector3().crossVectors(rUp, dir);
  _m.makeBasis(rX, rUp, dir).setPosition(butt);
  const local = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(_m);
  local.decompose(gun.position, gun.quaternion, gun.scale); gun.updateMatrixWorld(true);
  const gr = gun.userData.grips, at = (z) => new THREE.Vector3(0, -gr.drop, z).applyMatrix4(gun.matrixWorld);
  // elbows: the right one down and out to the side, the left one down and under the rifle
  twoBoneIK(B('upperarm_r'), B('lowerarm_r'), B('hand_r'), at(gr.right), up.clone().multiplyScalar(-1).addScaledVector(left, -0.8));
  twoBoneIK(B('upperarm_l'), B('lowerarm_l'), B('hand_l'), at(gr.left), up.clone().multiplyScalar(-1).addScaledVector(left, 0.35));
  // aiming: the head comes down onto the stock, eye along the sights
  if (pose === 'aim') { const hb = B('Head'), hp = hb.getWorldPosition(new THREE.Vector3()); const sight = butt.clone().addScaledVector(dir, 0.75).addScaledVector(rUp, 0.06);
    aimBone(hb, hp.clone().add(fwd), hp.clone().add(sight.sub(hp).normalize().multiplyScalar(1)).addScaledVector(up, -0.05).addScaledVector(left, 0.08)); }
  // hands along the rifle: fingers wrapping the stock and the fore-end
  for (const [h, f] of [['hand_r', 'middle_01_r'], ['hand_l', 'middle_01_l']]) {
    const hb = B(h), fb = B(f); if (!hb || !fb) continue;
    aimBone(hb, fb.getWorldPosition(new THREE.Vector3()), hb.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.1).addScaledVector(rUp, -0.05));
  }
}
