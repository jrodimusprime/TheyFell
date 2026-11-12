// GPU particles and flashes. Particles move on the GPU from (start, velocity, gravity, birth time): spawning one is a
// write into a ring buffer, and 12k live particles cost two draw calls. Shell bursts across the whole 6 km front are drawn,
// so the horizon smokes and flickers the way the bombardment did.
import * as THREE from 'three';

const VS = `
  attribute vec3 aP0; attribute vec3 aV; attribute vec4 aC; attribute vec4 aT; // t: birth, life, size0, size1
  uniform float uTime; uniform float uGrav;
  varying vec4 vC; varying vec2 vUv; varying float vFog;
  void main(){
    float age = uTime - aT.x, k = age / aT.y;
    if (age < 0. || k > 1.) { gl_Position = vec4(2., 2., 2., 1.); return; }
    float g = aC.a < 0. ? 0. : 1.;
    vec3 p = aP0 + aV * age + vec3(0., -.5 * uGrav * g * age * age, 0.);
    p.y += aV.y < 0. ? 0. : 0.;
    float size = mix(aT.z, aT.w, sqrt(k));
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    mv.xy += (uv - .5) * size;
    gl_Position = projectionMatrix * mv;
    vC = vec4(aC.rgb, (1. - k) * (k < .08 ? k / .08 : 1.));
    vUv = uv; vFog = length(mv.xyz);
  }`;
const FS = `
  uniform vec3 fogColor; uniform float fogDensity; uniform float uAdd;
  varying vec4 vC; varying vec2 vUv; varying float vFog;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec2 d = vUv - .5; float r = length(d) * 2.;
    float n = h(floor(vUv * 6.) + floor(vC.rgb * 50.).xy);
    float a = smoothstep(1., .35 + .25 * n, r) * vC.a;
    if (a < .01) discard;
    vec3 c = vC.rgb;
    float f = 1. - exp(-fogDensity * fogDensity * vFog * vFog);
    if (uAdd > .5) { gl_FragColor = vec4(c * a * (1. - f), 1.); } else { gl_FragColor = vec4(mix(c, fogColor, f), a); }
  }`;

class Pool {
  constructor(scene, n, additive) {
    const g = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1);
    g.index = q.index; g.attributes.position = q.attributes.position; g.attributes.uv = q.attributes.uv;
    this.p0 = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); this.v = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.c = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); this.t = new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(-1e9), 4);
    for (const a of [this.p0, this.v, this.c, this.t]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP0', this.p0); g.setAttribute('aV', this.v); g.setAttribute('aC', this.c); g.setAttribute('aT', this.t);
    g.instanceCount = n;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTime: { value: 0 }, uGrav: { value: 9.81 }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 }, uAdd: { value: additive ? 1 : 0 } } });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2; scene.add(this.mesh);
    this.n = n; this.i = 0; this.dirty = false;
  }
  add(time, x, y, z, vx, vy, vz, r, g, b, grav, life, s0, s1) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.p0.setXYZ(i, x, y, z); this.v.setXYZ(i, vx, vy, vz); this.c.setXYZW(i, r, g, b, grav ? 1 : -1); this.t.setXYZW(i, time, life, s0, s1);
    this.dirty = true;
  }
  flush(time, fog) {
    this.mat.uniforms.uTime.value = time; this.mat.uniforms.fogColor.value.copy(fog.color); this.mat.uniforms.fogDensity.value = fog.density;
    if (this.dirty) { for (const a of [this.p0, this.v, this.c, this.t]) a.needsUpdate = true; this.dirty = false; }
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene; this.time = 0;
    this.smoke = new Pool(scene, 9000, false); this.glow = new Pool(scene, 2500, true);
    this.lights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffb060, 0, 60, 1.6); scene.add(l); l.userData.t = -1; return l; });
    this.shake = 0;
  }
  _light(x, y, z, power, dist, life) {
    const l = this.lights.reduce((a, b) => (a.userData.t < b.userData.t ? a : b));
    l.position.set(x, y, z); l.distance = dist; l.userData = { t: this.time, life, power }; l.intensity = power;
  }
  explosion(p, kind, camPos) {
    const [x, y, z] = p, t = this.time, S = this.smoke, G = this.glow, d = Math.hypot(x - camPos.x, z - camPos.z);
    if (d > 4500) return;
    const R = Math.random;
    const big = kind === 'heavy' ? 1.8 : kind === 'mine' ? 6 : kind === 'grenade' ? 0.5 : 1;
    if (kind === 'shrapnel') {
      // a shrapnel shell bursting in the air: a white-yellow puff, and the balls kicking up the ground beneath
      G.add(t, x, y, z, 0, 0, 0, 1, 0.85, 0.5, false, 0.15, 3, 6);
      for (let i = 0; i < 6; i++) S.add(t, x + (R() - .5) * 3, y + (R() - .5) * 2, z + (R() - .5) * 3, (R() - .5) * 1.5, 0.3, (R() - .5) * 1.5, 0.82, 0.8, 0.72, false, 9 + R() * 6, 3, 11);
      if (d < 900) for (let i = 0; i < 12; i++) { const a = R() * 6.28, rr = R() * 18; S.add(t + 0.15, x + Math.cos(a) * rr, y - 12, z + Math.sin(a) * rr, 0, 0.6, 0, 0.5, 0.45, 0.38, false, 1.6, 0.4, 1.4); }
      if (d < 600) this._light(x, y, z, 30, 50, 0.1);
      return;
    }
    // flash
    G.add(t, x, y + 0.5 * big, z, 0, 0, 0, 1, 0.65, 0.3, false, 0.12 * big, 2.5 * big, 7 * big);
    if (d < 1000) this._light(x, y + 2, z, kind === 'mine' ? 400 : 60 * big, 40 * big, 0.12 * Math.sqrt(big));
    // earth fountain: dirt and chalk thrown up and falling back
    const nd = d < 250 ? 34 : d < 1200 ? 12 : 4;
    for (let i = 0; i < nd * big; i++) {
      const a = R() * 6.28, sp = (3 + R() * 9) * Math.sqrt(big), up = (9 + R() * 16) * Math.sqrt(big), chalk = R() < 0.35;
      S.add(t, x, y + 0.3, z, Math.cos(a) * sp, up, Math.sin(a) * sp, chalk ? 0.78 : 0.32, chalk ? 0.76 : 0.27, chalk ? 0.7 : 0.21, true, 1.2 + R() * 1.6 * Math.sqrt(big), 0.25 * big + 0.2, 0.6 * big + 0.3);
    }
    // smoke and dust column, drifting east on the light wind
    const ns = d < 1200 ? 9 : 4;
    for (let i = 0; i < ns * Math.sqrt(big); i++) {
      const g = 0.25 + R() * 0.18;
      S.add(t + R() * 0.3, x + (R() - .5) * 2 * big, y + R() * 3 * big, z + (R() - .5) * 2 * big, 0.6 + (R() - .5) * 1.2, 1.2 + R() * 2.5 * big, (R() - .5) * 1.2, g + 0.12, g + 0.1, g + 0.06, false, 7 + R() * 9 * big, 2 * big, (9 + R() * 8) * big);
    }
    if (kind === 'mine') {
      // Lochnagar: a column of earth and chalk thrown over a thousand metres into the air, debris raining for minutes
      for (let i = 0; i < 700; i++) {
        const a = R() * 6.28, sp = R() * 22, up = 25 + R() * 110, chalk = R() < 0.55;
        S.add(t + R() * 0.6, x + (R() - .5) * 40, y, z + (R() - .5) * 40, Math.cos(a) * sp, up, Math.sin(a) * sp, chalk ? 0.85 : 0.35, chalk ? 0.83 : 0.29, chalk ? 0.78 : 0.22, true, 4 + R() * 16, 3 + R() * 6, 5 + R() * 12);
      }
      for (let i = 0; i < 160; i++) {
        const g = 0.45 + R() * 0.3, h = R() * 260;
        S.add(t + R() * 3, x + (R() - .5) * 90, y + h * 1.6, z + (R() - .5) * 90, 1.5 + (R() - .5) * 3, 5 + R() * 12, (R() - .5) * 3, g + 0.1, g + 0.08, g + 0.04, false, 50 + R() * 70, 40, 110 + R() * 90);
      }
      this.shake = Math.max(this.shake, d < 600 ? 2.5 : d < 2000 ? 1.2 : 0.4);
    } else if (d < 120) this.shake = Math.max(this.shake, (kind === 'heavy' ? 0.9 : 0.5) * (1 - d / 120));
  }
  muzzle(o, h, close) {
    const [x, y, z] = o, t = this.time, dx = h[0] - x, dy = h[1] - y, dz = h[2] - z, L = Math.hypot(dx, dy, dz) || 1;
    const fx = x + dx / L * 0.9, fy = y - 0.08 + dy / L * 0.9, fz = z + dz / L * 0.9;
    this.glow.add(t, fx, fy, fz, 0, 0, 0, 1, 0.75, 0.4, false, 0.05, 0.25, 0.6);
    if (close) this.smoke.add(t, fx, fy, fz, dx / L * 1.5, 0.3, dz / L * 1.5, 0.75, 0.74, 0.7, false, 1.4, 0.2, 1.4);
  }
  impact(h, flesh) {
    const [x, y, z] = h, t = this.time, R = Math.random;
    if (flesh) { for (let i = 0; i < 4; i++) this.smoke.add(t, x, y, z, (R() - .5) * 1.5, R() * 1.5, (R() - .5) * 1.5, 0.35, 0.05, 0.04, true, 0.35, 0.06, 0.22); return; }
    for (let i = 0; i < 3; i++) this.smoke.add(t, x, y, z, (R() - .5) * 1.4, 1 + R() * 2.5, (R() - .5) * 1.4, 0.5, 0.45, 0.37, true, 0.7, 0.08, 0.5);
    this.smoke.add(t, x, y + 0.1, z, 0, 0.3, 0, 0.6, 0.57, 0.5, false, 1.6, 0.2, 1.1);
  }
  update(dt, fog) {
    this.time += dt;
    for (const l of this.lights) { const u = l.userData; if (u.t < 0) continue; const k = (this.time - u.t) / u.life; l.intensity = k >= 1 ? 0 : u.power * (1 - k); if (k >= 1) u.t = -1; }
    this.smoke.flush(this.time, fog); this.glow.flush(this.time, fog);
    this.shake = Math.max(0, this.shake - dt * 1.6);
  }
}

export function makeSky(scene, sunDir) {
  const g = new THREE.SphereGeometry(5200, 32, 16);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir.clone().normalize() }, uHaze: { value: new THREE.Color(0xb7b6ab) } },
    vertexShader: `varying vec3 vD0; void main(){ vD0 = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uSun; uniform vec3 uHaze; varying vec3 vD0;
      void main(){
        vec3 vD = normalize(vD0);
        float e = max(vD.y, 0.), s = max(dot(vD, uSun), 0.);
        vec3 zen = vec3(.47, .54, .62), hor = uHaze;   // a smoke-greyed sky
        vec3 c = mix(hor, zen, smoothstep(.0, .55, pow(e, .7)));   // a deep band of haze over the horizon
        c += vec3(1., .82, .58) * pow(s, 8.) * .35 + vec3(1., .9, .7) * pow(s, 1800.) * .55 + vec3(1., .95, .85) * smoothstep(.99985, .9999, s) * .9;   // the sun dimmed by the smoke
        c = mix(c, uHaze * .92, smoothstep(.0, -.08, vD.y));
        gl_FragColor = vec4(c, 1.);
      }` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = -1; scene.add(mesh);
  return mesh;
}
