// They Fell: La Boisselle demo. Boot, the fixed-tick loop, input, camera, HUD and the agent API (window.TF).
// URL flags: ?agent (no menu, the sim only advances through TF.step: for headless tests)  ?seed=N  ?god or ?cheat (god mode)  ?rambo
//            ?at=x,z (start position, metres)  ?time=HH:MM:SS (skip ahead)  ?lowres  ?nofx
import * as THREE from 'three';
import { loadTerrain } from './world/terrain.js';
import { Features } from './world/features.js';
import { Sim, HZ, DT, WEAPONS, PRE_ZERO_RATE, ZERO_TIME, MINE_AT } from './sim/sim.js';
import { TerrainView, buildGroundMap, splatGround } from './render/terrainView.js';
import { Props } from './render/props.js';
import { SoldiersView } from './render/soldiers.js';
import { Ragdolls } from './render/ragdoll.js';
import { Blood } from './render/blood.js';
import { loadSkinnedMen } from './render/skinnedMen.js';
import { FirstPerson } from './render/firstPerson.js';
import { climbPose, climbT } from './render/climb.js';
import { FX, makeSky, MistBanks } from './render/fx.js';
import { Audio } from './audio.js';
import { makeGroundTextures } from './render/groundTex.js';
import { makePropTextures } from './render/propTex.js';

// ---------- ground fog: mist lying in the valleys, on top of the distance haze (every material uses these chunks) ----------
const GROUND_FOG_TOP = 106, GROUND_FOG_FALL = 9;   // metres above sea level: Mash and Sausage valleys sit below ~100 m
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogWorld;\n#endif';
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  { vec4 fw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    fw = instanceMatrix * fw;
  #endif
    vFogWorld = (modelMatrix * fw).xyz; }
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  // ground mist: thick in the hollows, thinning with height, building up with distance along the line of sight
  float gm = clamp(exp(-(vFogWorld.y - ${GROUND_FOG_TOP.toFixed(1)}) / ${GROUND_FOG_FALL.toFixed(1)}), 0.0, 3.0);
  float mist = 1.0 - exp(-vFogDepth * 0.0045 * gm);
  fogFactor = max(fogFactor, mist * 0.85);
  // low mist settled on the ground everywhere: thickest at foot level, gone by head height, building up with distance
  float low = clamp(exp(-(vFogWorld.y - (cameraPosition.y - 1.55)) / 1.1), 0.0, 1.0);
  float lowMist = 1.0 - exp(-vFogDepth * 0.014 * low);
  fogFactor = max(fogFactor, lowMist * 0.78);
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const Q = new URLSearchParams(location.search);
const AGENT = Q.has('agent'), CHEAT = Q.has('cheat');
const $ = id => document.getElementById(id);
const setLoad = t => { $('load').textContent = t; };

// ---------- the sun at 07:30 on 1 July 1916 (French summer time, GMT+1): azimuth ~85°, ~24° up, low in the east ----------
const SUN = new THREE.Vector3(0.91, 0.41, -0.08).normalize();
const HAZE = new THREE.Color(0xb7b6ab);

async function boot() {
  setLoad('Reading the ground (IGN lidar, 6 × 6 km)…');
  const T = await loadTerrain('data/');
  setLoad('Placing the wire, the ruins and the woods…');
  const F = new Features(T);
  const seed = +(Q.get('seed') || 1);
  const sim = new Sim(T, F, { seed });
  if (Q.get('at')) { const [x, z] = Q.get('at').split(',').map(Number); Object.assign(sim.player, { x, z, y: T.height(x, z) }); }

  // ---------- renderer ----------
  // rendered at a fraction of screen resolution and scaled up with hard pixels: the slightly pixelated look, and far less work
  const SCALES = [0.3, 0.4, 0.55, 0.75, 1];
  let scaleI = Q.get('scale') ? SCALES.indexOf(+Q.get('scale')) : 1; if (scaleI < 0) scaleI = 1;   // 40% by default: chunkier pixels
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: AGENT });
  renderer.setPixelRatio(SCALES[scaleI]);
  renderer.domElement.style.imageRendering = 'pixelated';
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(HAZE, 0.0042);       // half-hidden at ~200 m, gone by ~520 m: the mist and the smoke of a week's bombardment
  scene.background = HAZE;
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.12, 1600);   // nothing past the fog is drawn; a tight depth range, no z-fighting
  scene.add(camera);
  const sky = makeSky(scene, SUN);
  const hemi = new THREE.HemisphereLight(0xc7d6e8, 0x7a6e58, 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -70; sc.right = sc.top = 70; sc.near = 1; sc.far = 600;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun); scene.add(sun.target);

  setLoad('Mapping the shell holes and the chalk…');
  const groundTex = buildGroundMap(T);
  const terrain = new TerrainView(T, scene, groundTex, makeGroundTextures(renderer));
  const props = new Props(scene, T, F, makePropTextures(renderer));
  const men = new SoldiersView(scene, sim, 1500);   // every body stays where it fell
  const blood = new Blood(scene, T);
  setLoad('Dressing the men (uniforms, faces, rifles)…');
  const skinned = await loadSkinnedMen(scene, renderer);
  const fp = new FirstPerson(skinned, SUN);
  const fpCam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.01, 10);
  const rag = new Ragdolls(T);
  rag.onSettle = (x, z) => blood.pool(x, z);   // a body comes to rest: blood pools under it
  const fx = new FX(scene);
  const mist = new MistBanks(scene, T);
  const audio = new Audio();
  const vm = makeViewModel(camera);

  // ---------- input ----------
  const keys = new Set(); let mouseDown = false, ads = false, yaw = sim.player.yaw, pitch = 0.02, edge = {};
  addEventListener('keydown', e => { if (e.repeat) return; keys.add(e.code); edge[e.code] = true;
    if (e.code === 'F3') { e.preventDefault(); $('debug').style.display = $('debug').style.display === 'block' ? 'none' : 'block'; }
    if (e.code === 'KeyM') $('map').style.display = $('map').style.display === 'block' ? 'none' : 'block', drawMap();
    if (e.code === 'KeyK') audio.setEnabled(!audio.enabled);
    if (e.code === 'KeyP') { scaleI = (scaleI + 1) % SCALES.length; renderer.setPixelRatio(SCALES[scaleI]); renderer.setSize(innerWidth, innerHeight); } });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('mousedown', e => { if (document.pointerLockElement) { if (e.button === 0) mouseDown = true; if (e.button === 2) ads = true; } });
  addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) ads = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => { if (document.pointerLockElement && sim.player.alive) { const k = (ads ? 0.0011 : 0.0022); yaw -= e.movementX * k; pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * k)); } });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && running && sim.player.alive) { $('menu').style.display = 'grid'; $('play').textContent = 'Back to the line'; $('giveup').hidden = false; } });
  function humanInput() {
    const a = { forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), side: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
      run: keys.has('ShiftLeft') || keys.has('ShiftRight'), jump: keys.has('Space'), vault: keys.has('KeyE'), crouch: !!edge.KeyC, prone: !!edge.KeyZ, reload: !!edge.KeyR, grenade: !!edge.KeyG, respawnNow: !!edge.KeyK || giveUp, 
      fire: mouseDown, ads, yaw, pitch };
    edge = {}; giveUp = false;
    return a;
  }

  // ---------- the loop ----------
  let giveUp = false;   // the Esc menu's Respawn now button: drop this man on the next tick
  let running = false, acc = 0, last = performance.now(), frames = 0, fpsT = 0, fps = 0;
  const camPos = new THREE.Vector3();
  let deathCam = 0, hurt = 0, bob = 0, recoil = 0, lastHp = 100, msgT = 0, tallyT = 0;
  const feed = [];
  function message(t, secs = 4) { $('msg').textContent = t; $('msg').style.opacity = 1; msgT = secs; }
  function stepSim(input) {
    sim.step(input);
  }
  function consumeEvents() {
    const p = sim.player, cp = camera.position;
    for (const e of sim.events) {
      if (e.t === 'shot') {
        const s = sim.soldiers[e.id], d = Math.hypot(e.o[0] - cp.x, e.o[2] - cp.z);
        // fired at you (hit you, aimed at you, or the bullet went by within 2.5 m): he goes on the map where he fired from
        if (p.alive && s.side !== p.side && (e.victim === p.id || (s.ai && s.ai.target === p.id) || segDist3(e.o, e.h, [p.x, p.y + 1.2, p.z]) < 2.5))
          shooters.set(e.id, { x: e.o[0], z: e.o[2], fromX: p.x, fromZ: p.z });
        if (d < 1500) fx.muzzle(e.o, e.h, d < 200);
        if (Math.hypot(e.h[0] - cp.x, e.h[2] - cp.z) < 400) fx.impact(e.h, e.victim >= 0);
        audio.shot(e.o, e.w, e.id === p.id);
        if (e.id === p.id) { recoil = 1; if (e.w !== 'mg08') audio.bolt(); }
        else if (e.victim !== p.id) { // a near miss cracks past
          const t = nearestOnSeg(cp, e.o, e.h); if (t < 3 && s.side !== p.side) hurt = Math.max(hurt, 0.12);
        }
      } else if (e.t === 'explosion') { fx.explosion(e.p, e.kind, cp); audio.boom(e.p, e.kind); }
      else if (e.t === 'incoming') audio.incoming(e.p, e.kind);
      else if (e.t === 'crater') terrain.invalidate(e.p[0], e.p[2], e.r * 1.7);
      else if (e.t === 'mine') {
        terrain.invalidate(e.p[0], e.p[2], e.r * 2 + 40, true); props.last = props.lastWire = null;
        // chalk thrown out in a white ring round the lip, the ground beyond churned
        splatGround(groundTex, e.p[0], e.p[2], e.r * 1.7, 0, 0.9); splatGround(groundTex, e.p[0], e.p[2], e.r * 3, 1, 0.6); if (e.name === 'Lochnagar') message('07:28. The Lochnagar mine has gone up under the Schwabenhöhe', 7); else addFeed('The Y Sap mine has gone up'); }
      else if (e.t === 'zero') { audio.zero = true; for (let i = 0; i < 6; i++) audio.whistle([p.x + (i - 3) * 40, p.y, p.z + (i % 2) * 30], i * 0.3); message('Zero hour. The whistles blow: over the top!', 6); }
      else if (e.t === 'hit') { if (e.id === p.id) { hurt = 1; audio.hurt(); } if (e.kind === 'bullet' && e.point && Math.hypot(e.point[0] - cp.x, e.point[2] - cp.z) < 400) blood.hit(e.point, e.dir); }
      else if (e.t === 'death') {
        const s = sim.soldiers[e.id], c = men.addCorpse(s); skinned.toCorpse(s, c);
        rag.add(c, e, Math.hypot(s.x - cp.x, s.z - cp.z));
        if (e.by === p.id) addFeed(`You hit a ${s.side === 'GER' ? 'German' : 'British'} soldier`);
        if (e.id === p.id) { deathCam = 0; $('deadwhy').textContent = deathReason(e); }
      } else if (e.t === 'captured') { addFeed(`${e.name}: taken by the ${e.side === 'BRI' ? 'British' : 'Germans'}`); message(`${e.name} ${e.side === p.side ? 'taken' : 'lost'}`, 4); }
      else if (e.t === 'reload' && e.id === p.id) audio.reload();
      else if (e.t === 'respawn' && e.id === p.id) {
        if (e.into === undefined) p.yaw = p.side === 'BRI' ? -Math.PI / 2 : Math.PI / 2;   // (going in as a man already out there: the sim turns him to the objective)
        yaw = p.yaw; pitch = 0; $('dead').style.display = 'none'; choose = null; pendingRespawn = null; shooters.clear(); if (!AGENT) renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
        if (e.into !== undefined) addFeed('You go on as one of the men in the line');
      }
    }
    sim.events.length = 0;
  }
  function deathReason(e) { return e.kind === 'gaveup' ? 'You chose to go back in as another man' : e.kind === 'bullet' ? (sim.soldiers[e.by]?.role === 'mg' ? 'Cut down by machine-gun fire' : e.zone === 'head' ? 'Shot through the head' : 'Hit by a rifle bullet') : e.kind === 'mine' ? 'Caught in the mine blast' : e.kind === 'shrapnel' ? 'Shrapnel' : e.kind === 'grenade' ? 'A bomb' : e.kind === 'fall' ? 'A bad fall' : 'Killed by shellfire'; }
  function addFeed(t) { feed.unshift([t, 6]); feed.length = Math.min(feed.length, 5); }

  function frame(now) {
    if (window.TF && TF.hold) { last = now; requestAnimationFrame(frame); return; }   // tests: hold the picture (debug cameras)
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
    if (running && !AGENT) {
      acc += dt; let n = 0;
      while (acc >= DT && n < 6) { const a = humanInput(); stepSim(a); acc -= DT; n++; }
      if (n === 6) acc = 0;
    }
    consumeEvents();
    render(dt);
    requestAnimationFrame(frame);
  }
  function render(dt) {
    const p = sim.player, W = WEAPONS[p.weapon];
    // camera: the player's eyes, or a slow orbit over his body when he falls
    if (p.alive) {
      const eye = [1.64, 1.1, 0.35][p.stance];
      const moving = sim.player.intent && (sim.player.intent.f || sim.player.intent.s);
      bob += moving ? dt * (p.intent.run ? 11 : 7.5) : 0;
      const climb = p.climb > 0 ? Math.sin(p.climb * 6) * 0.08 : 0;
      camera.position.set(p.x, p.y + eye + Math.sin(bob) * (moving ? 0.035 : 0) + climb, p.z);
      { const ct = climbT(p); if (ct >= 0) { const cp = climbPose(p, T, ct, 0.95); camera.position.set(cp.hip.x, cp.hip.y + 0.62 - cp.lean * 0.18, cp.hip.z).addScaledVector(p._climbPlan.f, Math.sin(cp.lean) * 0.25); } }   // the eye follows the scramble up the wall
      camera.rotation.set(0, 0, 0); camera.rotation.order = 'YXZ'; camera.rotation.y = AGENT ? p.yaw : yaw; camera.rotation.x = (AGENT ? p.pitch : pitch) + recoil * 0.02;
      if (!AGENT) { p.yaw = yaw; }
      deathCam = 0; vm.visible = true;
    } else {
      deathCam += dt;
      const c = men.corpses.filter(c => c.id === p.id).pop(), cx = c ? c.mats[0].elements[12] : p.x, cy = c ? c.mats[0].elements[13] : p.y, cz = c ? c.mats[0].elements[14] : p.z;
      const a = deathCam * 0.25 + p.yaw, r = 3 + Math.min(deathCam, 4);
      camera.position.set(cx + Math.sin(a) * r, Math.max(T.height(cx + Math.sin(a) * r, cz + Math.cos(a) * r) + 1.2, cy + 1.5 + deathCam * 0.6), cz + Math.cos(a) * r);
      camera.lookAt(cx, cy + 0.3, cz); vm.visible = false;
      if ((deathCam > 1.5 || p.gaveUp) && !AGENT) showRespawn();
      drawSpawnMap(dt);
    }
    if (window.TF && TF.view) { const v = TF.view; camera.position.set(...v.pos); camera.lookAt(...v.look); vm.visible = false; men.hidePlayer = false; }
    // screen shake from big bursts
    if (fx.shake > 0) { camera.rotation.x += (Math.random() - 0.5) * 0.02 * fx.shake; camera.rotation.y += (Math.random() - 0.5) * 0.02 * fx.shake; }
    camera.fov = window.TF && TF.view && TF.view.fov ? TF.view.fov : THREE.MathUtils.lerp(camera.fov, p.ads ? 50 : 72, Math.min(1, dt * 12)); camera.updateProjectionMatrix();   // (a debug view may set its own)
    recoil = Math.max(0, recoil - dt * 6);
    vm.visible = false;   // the old box rifle: replaced by the first-person arms
    const fpMoving = !!(p.intent && (p.intent.f || p.intent.s));
    // shadows follow the player
    { const sx = Math.round(camera.position.x / 0.5) * 0.5, sz = Math.round(camera.position.z / 0.5) * 0.5, sy = Math.round(camera.position.y); sun.target.position.set(sx, sy, sz); sun.position.set(sx, sy, sz).addScaledVector(SUN, 300); sun.target.updateMatrixWorld(); }   // snapped: no shimmering
    sky.position.copy(camera.position);
    audio.listener = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    terrain.update(camera, terrain.stats.built < 200 ? 30 : 6);
    props.update(camera);
    men.hidePlayer = p.alive && !(window.TF && TF.view);
    skinned.update(dt, sim, men, camera, p.id); men.skip = skinned.liveIds;
    men.update(dt, camera.position, p.id, 700);
    rag.step(dt);
    blood.update(dt);
    fx.update(dt, scene.fog);
    mist.update(dt, camera, scene.fog);
    renderer.render(scene, camera);
    if (p.alive && !(window.TF && TF.view)) {   // the player's arms and rifle, in their own pass on top of the world
      camera.updateMatrixWorld(); fp.update(dt, camera, p, W, recoil, bob, fpMoving, rifleBlock());
      // its own camera: same view, but a 1 cm near plane, so hands close to the eye are never sliced off
      fpCam.position.copy(camera.position); fpCam.quaternion.copy(camera.quaternion); fpCam.fov = camera.fov; fpCam.aspect = camera.aspect; fpCam.updateProjectionMatrix(); fpCam.updateMatrixWorld();
      renderer.autoClear = false; renderer.clearDepth(); renderer.render(fp.scene, fpCam); renderer.autoClear = true;
    }
    hud(dt);
  }

  // how far ahead the rifle can reach before it would go into the ground, a trench wall, a ruin or a man
  function rifleBlock() {
    rifleBlock.why = '';
    const c = camera.position, f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), down = new THREE.Vector3(0, -1, 0).applyQuaternion(camera.quaternion);
    let best = Infinity;
    for (const drop of [0, 0.14]) {
      const ox = c.x + down.x * drop, oy = c.y + down.y * drop, oz = c.z + down.z * drop;
      for (let d = 0.15; d < 1.4 && d < best; d += 0.05) if (oy + f.y * d < T.height(ox + f.x * d, oz + f.z * d)) { best = d; rifleBlock.why = 'ground ' + drop; break; }   // fine steps: a trench wall is thin
      for (let d = 0.2; d < 1.4 && d < best; d += 0.1) if (F.wallAt(ox + f.x * d, oz + f.z * d, oy + f.y * d - 1.0, 0.05)) { best = d; rifleBlock.why = 'ruin'; break; }
    }
    for (const o of sim.soldiers) {   // other men in the way
      if (o.isPlayer || !o.alive || Math.abs(o.x - c.x) > 1.6 || Math.abs(o.z - c.z) > 1.6) continue;
      const vx = o.x - c.x, vz = o.z - c.z, along = vx * f.x + vz * f.z, side = Math.abs(vx * f.z - vz * f.x);
      if (along > 0 && side < 0.35 && c.y - o.y < 2.0 && c.y - o.y > 0 && along - 0.25 < best) { best = along - 0.25; rifleBlock.why = 'man ' + o.id; }
    }
    rifleBlock.best = best; return best;
  }
  // ---------- HUD ----------
  const objEl = $('objectives');
  objEl.innerHTML = sim.objectives.map(o => `<div class="obj" title="${o.name}"><i></i><span>${o.id}</span></div>`).join('');
  function hud(dt) {
    const p = sim.player, o = sim.obs ? null : null, W = WEAPONS[p.weapon];
    $('clock').textContent = sim.clock();
    const t = sim.time, mine = MINE_AT, zero = ZERO_TIME;   // before zero the clock runs PRE_ZERO_RATE x fast: count down real seconds
    $('phase').textContent = t < mine ? `Mines in ${Math.ceil((mine - t) / PRE_ZERO_RATE)} s · zero hour 07:30` : t < zero ? `Zero hour in ${Math.ceil((zero - t) / PRE_ZERO_RATE)} s` : 'The attack: take the Schwabenhöhe and La Boisselle';
    $('ammo').textContent = p.reloading > 0 ? 'Reloading…' : `${p.mag} | ${p.reserve}`; $('weapon').textContent = `${W.name} · Mills bombs ${p.grenades ?? 3}`;
    $('hp').textContent = !p.alive ? 'Fallen' : p.hp > 80 ? 'Unwounded' : p.hp > 45 ? 'Wounded' : 'Badly wounded'; $('hpbar').firstChild.style.width = Math.max(0, p.hp) + '%';
    $('stance').textContent = (p.climb > 0 ? 'Climbing' : ['Standing', 'Crouched', 'Prone'][p.stance]) + (T.inTrench(p.x, p.z) ? ' · in the trench' : '') + (F.wireAt(p.x, p.z) > 0 ? ' · caught on wire' : '') + ` · ${Math.round(p.x)} m E, ${Math.round(6000 - p.z)} m N`;
    const deg = ((-((AGENT ? p.yaw : yaw)) * 180 / Math.PI) % 360 + 360) % 360, dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    $('compass').textContent = `${dirs[Math.round(deg / 45) % 8]} ${Math.round(deg)}°`;
    sim.objectives.forEach((ob, i) => { const el = objEl.children[i]; el.className = 'obj ' + ob.owner; el.firstChild.style.height = (Math.max(0, ob.progress) * 100) + '%'; });
    tallyT -= dt; if (tallyT < 0) { tallyT = 0.25; const row = (side, name) => { const t = sim.tally(side); return `<div><b>${name}</b> <span class="gone">${t.fallen.toLocaleString('en-GB')} fallen</span> · ${t.left.toLocaleString('en-GB')} left</div>`; };
      $('tally').innerHTML = row('BRI', 'British') + row('GER', 'German'); }
    $('feed').innerHTML = feed.map(f => `<div>${f[0]}</div>`).join(''); for (const f of feed) f[1] -= dt; while (feed.length && feed[feed.length - 1][1] < 0) feed.pop();
    msgT -= dt; if (msgT < 0) $('msg').style.opacity = 0;
    hurt = Math.max(0, hurt - dt * 1.2); $('hurt').style.opacity = hurt * 0.8 + (p.alive && p.hp < 50 ? (50 - p.hp) / 80 : 0);
    // out of bounds: just tell the player
    $('oob').style.display = p.alive && sim.outOfBounds() ? 'block' : 'none';
    drawMini(dt);
    $('cross').hidden = !p.alive || p.ads;
    if ($('debug').style.display === 'block') {
      const info = renderer.info;
      $('debug').textContent = `fps ${fps.toFixed(0)}  draw calls ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k\n` +
        `terrain tiles ${terrain.stats.tiles} (${(terrain.stats.tris / 1000).toFixed(0)}k tris, ${terrain.cache.size} cached)\n` +
        `soldiers ${sim.soldiers.filter(s => s.alive).length}/${sim.soldiers.length}  corpses ${men.corpses.length}  ragdolls ${rag.stats.active}\n` +
        `tick ${sim.tick}  hash ${sim.hash()}  pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
    }
  }
  // ---------- minimap (bottom left): north up, 400 m across, you and the way you face, pointing the way to the attack ----------
  const mini = $('mini'), mg = mini.getContext('2d'), MR = 200;            // metres from centre to rim
  const lines = T.map.trenches.map(t => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of t.pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); } return { t, box: [x0, z0, x1, z1] }; });
  let miniT = 0;
  // men who have fired at you: until they are dead or you have moved 50 m from where they fired at you
  const shooters = new Map();
  function segDist3(a, b, q) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], aq = [q[0] - a[0], q[1] - a[1], q[2] - a[2]], L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
    const t = Math.max(0, Math.min(1, (aq[0] * ab[0] + aq[1] * ab[1] + aq[2] * ab[2]) / L)); return Math.hypot(aq[0] - ab[0] * t, aq[1] - ab[1] * t, aq[2] - ab[2] * t); }
  function pruneShooters() { const p = sim.player; for (const [id, f] of shooters) if (!sim.soldiers[id].alive || Math.hypot(p.x - f.fromX, p.z - f.fromZ) > 50) shooters.delete(id); }
  function shooterDots(g, S, C, R, size) {   // red dots, those off the map as pips on its rim
    pruneShooters(); const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 160);
    for (const f of shooters.values()) { let [x, y] = S(f.x, f.z); const dx = x - C, dy = y - C, d = Math.hypot(dx, dy), out = R && d > R - size;
      if (out) { x = C + dx / d * (R - size); y = C + dy / d * (R - size); }
      g.fillStyle = `rgba(214,24,18,${pulse})`; g.strokeStyle = '#1d1a14'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, out ? size * 0.7 : size, 0, 7); g.fill(); g.stroke(); }
  }
  function attackGoal(p) {
    const objs = sim.objectives.filter(o => o.owner !== p.side);
    return objs.length ? objs.reduce((b, o) => Math.hypot(o.c[0] - p.x, o.c[1] - p.z) < Math.hypot(b.c[0] - p.x, b.c[1] - p.z) ? o : b) : null;
  }
  function drawMini(dt) {
    miniT -= dt; if (miniT > 0) return; miniT = 1 / 15;
    const p = sim.player, W = mini.width, C = W / 2, k = C / MR, hy = AGENT || !p.alive ? p.yaw : yaw;
    // world (x east, z south) -> screen, north up, you at the centre
    const S = (x, z) => [C + (x - p.x) * k, C + (z - p.z) * k];
    mg.clearRect(0, 0, W, W); mg.save(); mg.beginPath(); mg.arc(C, C, C - 1, 0, 7); mg.clip();
    mg.fillStyle = '#d8cfb5'; mg.fillRect(0, 0, W, W);
    // grid every 100 m, like a trench map's squares
    mg.strokeStyle = 'rgba(80,70,50,.18)'; mg.lineWidth = 1;
    for (let g = Math.floor((p.x - MR * 1.5) / 100) * 100; g < p.x + MR * 1.5; g += 100) { const a = S(g, p.z - MR * 1.5), b = S(g, p.z + MR * 1.5); mg.beginPath(); mg.moveTo(...a); mg.lineTo(...b); mg.stroke(); }
    for (let g = Math.floor((p.z - MR * 1.5) / 100) * 100; g < p.z + MR * 1.5; g += 100) { const a = S(p.x - MR * 1.5, g), b = S(p.x + MR * 1.5, g); mg.beginPath(); mg.moveTo(...a); mg.lineTo(...b); mg.stroke(); }
    // Lochnagar crater once blown
    if (sim.flags.mine) { const [cx, cz] = T.map.mines[0].c, [sx, sy] = S(cx, cz); mg.fillStyle = 'rgba(120,110,90,.5)'; mg.beginPath(); mg.arc(sx, sy, 50 * k, 0, 7); mg.fill(); }
    // wire belts
    mg.strokeStyle = 'rgba(40,35,30,.45)'; mg.lineWidth = 2; mg.setLineDash([2, 2]);
    for (const w of F.wire.items) { if (Math.abs(w.ax - p.x) > MR * 1.5 || Math.abs(w.az - p.z) > MR * 1.5) continue; mg.beginPath(); mg.moveTo(...S(w.ax, w.az)); mg.lineTo(...S(w.bx, w.bz)); mg.stroke(); }
    mg.setLineDash([]);
    // trenches: British red, German blue (the colours of the 1916 maps)
    for (const { t, box } of lines) {
      if (box[2] < p.x - MR * 1.5 || box[0] > p.x + MR * 1.5 || box[3] < p.z - MR * 1.5 || box[1] > p.z + MR * 1.5) continue;
      mg.strokeStyle = t.side === 'BRI' ? '#b3261e' : '#1f3a9e'; mg.lineWidth = t.kind === 'fire' ? 3 : 1.5;
      mg.beginPath(); t.pts.forEach((q, i) => { const [sx, sy] = S(q[0], q[1]); i ? mg.lineTo(sx, sy) : mg.moveTo(sx, sy); }); mg.stroke();
    }
    // friendly men
    mg.fillStyle = 'rgba(120,40,20,.8)';
    for (const o of sim.soldiers) if (o.alive && !o.isPlayer && o.side === p.side && Math.abs(o.x - p.x) < MR && Math.abs(o.z - p.z) < MR) { const [sx, sy] = S(o.x, o.z); mg.fillRect(sx - 1.5, sy - 1.5, 3, 3); }
    // objectives
    mg.font = "bold 18px Caslon, Georgia"; mg.textAlign = 'center'; mg.textBaseline = 'middle';
    for (const o of sim.objectives) { const [sx, sy] = S(o.c[0], o.c[1]); if (Math.hypot(sx - C, sy - C) > C + o.r * k) continue;
      mg.strokeStyle = o.owner === 'BRI' ? '#b3261e' : '#1f3a9e'; mg.lineWidth = 2; mg.beginPath(); mg.arc(sx, sy, o.r * k, 0, 7); mg.stroke(); mg.fillStyle = mg.strokeStyle; mg.fillText(o.id, sx, sy); }
    // the way to the attack: the nearest objective your side doesn't hold
    const goal = attackGoal(p);
    if (goal) {
      let [gx, gy] = S(goal.c[0], goal.c[1]); const dx = gx - C, dy = gy - C, d = Math.hypot(dx, dy), inside = d < C - 18;
      if (!inside) { gx = C + dx / d * (C - 18); gy = C + dy / d * (C - 18); }
      const a = Math.atan2(dy, dx);
      mg.save(); mg.translate(gx, gy); mg.rotate(a); mg.fillStyle = '#b3261e'; mg.strokeStyle = '#fff'; mg.lineWidth = 2;
      mg.beginPath(); mg.moveTo(14, 0); mg.lineTo(-8, -10); mg.lineTo(-3, 0); mg.lineTo(-8, 10); mg.closePath(); mg.stroke(); mg.fill(); mg.restore();
      // dashed line from you towards it
      mg.strokeStyle = 'rgba(179,38,30,.6)'; mg.lineWidth = 2; mg.setLineDash([6, 6]); mg.beginPath(); mg.moveTo(C, C); mg.lineTo(gx, gy); mg.stroke(); mg.setLineDash([]);
      const dist = Math.hypot(goal.c[0] - p.x, goal.c[1] - p.z), brg = ((Math.atan2(goal.c[0] - p.x, -(goal.c[1] - p.z)) * 180 / Math.PI) + 360) % 360;
      $('miniGoal').textContent = `Attack ${goal.id}: ${goal.name.replace(/ \(.*\)/, '')} · ${dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km'} · ${Math.round(brg)}°`;
    } else $('miniGoal').textContent = 'All objectives held';
    // north mark on the rim
    mg.fillStyle = '#1d1a14'; mg.font = "bold 20px Caslon, Georgia"; mg.fillText('N', C, 22);
    // whoever has fired at you
    shooterDots(mg, S, C, C - 2, 9);
    // you: what you can see (a cone the width of the view, 90 m out) and an arrow the way you face
    youMarker(mg, C, C, hy, 90 * k, 2);
    mg.restore();
  }
  // the player on a map: a pale cone the width of the view and a dark arrow pointing the way he faces (yaw 0 = north)
  function youMarker(g, x, y, hy, coneR, s = 1) {
    const half = THREE.MathUtils.degToRad(camera.fov * camera.aspect) / 2;
    g.save(); g.translate(x, y); g.rotate(-hy);
    const cone = g.createRadialGradient(0, 0, 0, 0, 0, coneR); cone.addColorStop(0, 'rgba(29,26,20,.55)'); cone.addColorStop(1, 'rgba(29,26,20,0)');
    g.fillStyle = cone; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, coneR, -Math.PI / 2 - Math.min(half, 1.2), -Math.PI / 2 + Math.min(half, 1.2)); g.closePath(); g.fill();
    g.scale(s, s); g.fillStyle = '#1d1a14'; g.strokeStyle = '#f2d7a6'; g.lineWidth = 2.5 / s;
    g.beginPath(); g.moveTo(0, -14); g.lineTo(-9, 10); g.lineTo(0, 5); g.lineTo(9, 10); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  // ---------- you fell: ten seconds to choose a man of your side on the map to go back in as, or one at random near the objective ----------
  const spawnCv = $('spawnmap'), sg = spawnCv.getContext('2d');
  let choose = null;   // { left (s), view { cx, cz, span }, hover id, picked id }
  function showRespawn() {
    if (choose) return;
    if (document.pointerLockElement) document.exitPointerLock();
    $('dead').style.display = 'grid';
    const p = sim.player, goal = sim.target(p.side, p.x, p.z), gx = goal ? goal.c[0] : p.x, gz = goal ? goal.c[1] : p.z;
    // framed on where you fell and the objective, with room round them for the men coming up
    const span = Math.min(1400, Math.max(450, Math.hypot(gx - p.x, gz - p.z) * 1.6 + 200));
    choose = { left: 10, view: { cx: (p.x + gx) / 2, cz: (p.z + gz) / 2, span }, hover: -1, picked: -1 };
    const t = sim.tally(p.side);
    $('spawns').innerHTML = t.left <= 0 ? '<p>No one is left to send. <button onclick="location.reload()">Begin again</button></p>' : '';
    $('spawnRandom').disabled = t.left <= 0;
  }
  function goIn(id) { if (!choose) return; choose.picked = id; pendingRespawn = { into: id }; }
  $('spawnRandom').onclick = () => goIn('random');
  const toMap = (x, z) => { const v = choose.view, k = spawnCv.width / v.span; return [(x - v.cx) * k + spawnCv.width / 2, (z - v.cz) * k + spawnCv.height / 2]; };
  function manAt(ev) {   // the man of your side under the pointer (within 14 px on the map)
    const r = spawnCv.getBoundingClientRect(), mx = (ev.clientX - r.left) * spawnCv.width / r.width, my = (ev.clientY - r.top) * spawnCv.height / r.height;
    let best = -1, bd = 14 * spawnCv.width / r.width;
    for (const o of sim.soldiers) { if (!o.alive || o.isPlayer || o.side !== sim.player.side || o.climb > 0) continue; const [x, y] = toMap(o.x, o.z), d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; best = o.id; } }
    return best;
  }
  spawnCv.addEventListener('pointermove', ev => { if (choose) choose.hover = manAt(ev); });
  spawnCv.addEventListener('pointerleave', () => { if (choose) choose.hover = -1; });
  spawnCv.addEventListener('click', ev => { if (!choose) return; const id = manAt(ev); if (id >= 0) goIn(id); });
  function drawSpawnMap(dt) {
    if (!choose) return;
    const p = sim.player, g = sg, W = spawnCv.width, k = W / choose.view.span;
    if (choose.picked < 0 && sim.tally(p.side).left > 0) { choose.left -= dt; if (choose.left <= 0) goIn('random'); }
    $('spawnCount').textContent = choose.picked >= 0 ? 'Going in…' : `random in ${Math.max(0, Math.ceil(choose.left))} s`;
    g.fillStyle = '#d8cfb5'; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(80,70,50,.18)'; g.lineWidth = 1;   // 100 m squares
    const v = choose.view, x0 = v.cx - v.span / 2, z0 = v.cz - v.span / 2;
    for (let q = Math.ceil(x0 / 100) * 100; q < x0 + v.span; q += 100) { const [x] = toMap(q, 0); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, W); g.stroke(); }
    for (let q = Math.ceil(z0 / 100) * 100; q < z0 + v.span; q += 100) { const [, y] = toMap(0, q); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    if (sim.flags.mine) { const [mx, my] = toMap(...T.map.mines[0].c); g.fillStyle = 'rgba(120,110,90,.5)'; g.beginPath(); g.arc(mx, my, 50 * k, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(40,35,30,.45)'; g.lineWidth = 2; g.setLineDash([3, 3]);
    for (const w of F.wire.items) { if (Math.abs(w.ax - v.cx) > v.span || Math.abs(w.az - v.cz) > v.span) continue; g.beginPath(); g.moveTo(...toMap(w.ax, w.az)); g.lineTo(...toMap(w.bx, w.bz)); g.stroke(); }
    g.setLineDash([]);
    for (const t of T.map.trenches) { g.strokeStyle = t.side === 'BRI' ? '#b3261e' : '#1f3a9e'; g.lineWidth = t.kind === 'fire' ? 4 : 2; g.beginPath(); t.pts.forEach((q, i) => { const [x, y] = toMap(q[0], q[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
    g.font = "bold 30px Caslon, Georgia"; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const o of sim.objectives) { const [x, y] = toMap(o.c[0], o.c[1]); g.strokeStyle = g.fillStyle = o.owner === 'BRI' ? '#b3261e' : '#1f3a9e'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, Math.max(o.r * k, 14), 0, 7); g.stroke(); g.fillText(o.id, x, y); }
    // your side's men (the enemy you can't see); the ones a random pick would go in as ringed
    const near = new Set(sim.takeoverChoices(p.side).map(o => o.id)), side = p.side === 'BRI' ? '#7a2414' : '#24305a';
    for (const o of sim.soldiers) { if (!o.alive || o.isPlayer || o.side !== p.side || o.climb > 0) continue; const [x, y] = toMap(o.x, o.z); if (x < -10 || y < -10 || x > W + 10 || y > W + 10) continue;
      g.fillStyle = side; g.fillRect(x - 3.5, y - 3.5, 7, 7); if (near.has(o.id)) { g.strokeStyle = '#1d1a14'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 8, 0, 7); g.stroke(); } }
    for (const [id, col, r] of [[choose.hover, '#f2d7a6', 14], [choose.picked, '#fff', 17]]) { const o = sim.soldiers[id]; if (!o || !o.alive) continue; const [x, y] = toMap(o.x, o.z); g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.strokeStyle = '#1d1a14'; g.lineWidth = 1.5; g.stroke(); }
    // where you fell
    const [fx, fy] = toMap(p.x, p.z); g.strokeStyle = '#1d1a14'; g.lineWidth = 3; g.beginPath(); g.moveTo(fx - 9, fy - 9); g.lineTo(fx + 9, fy + 9); g.moveTo(fx + 9, fy - 9); g.lineTo(fx - 9, fy + 9); g.stroke();
    g.fillStyle = '#1d1a14'; g.font = "italic 22px Caslon, Georgia"; g.textAlign = 'left'; g.fillText('you fell here', fx + 14, fy);
    g.font = "bold 26px Caslon, Georgia"; g.textAlign = 'center'; g.fillText('N', W / 2, 22);
    g.fillRect(20, W - 22, 100 * k, 4); g.font = "20px Caslon, Georgia"; g.textAlign = 'left'; g.fillText('100 m', 20, W - 38);
  }
  let pendingRespawn = null;   // the respawn choice goes in with the next tick's input, so recorded runs replay it

  // ---------- trench-map overlay (M): the whole map at true scale ----------
  function drawMap() {
    const cv = $('map').firstChild, g = cv.getContext('2d'), S = cv.width / T.size;
    g.fillStyle = '#d8cfb5'; g.fillRect(0, 0, cv.width, cv.height);
    g.lineWidth = 1;
    for (const t of T.map.trenches) { g.strokeStyle = t.side === 'BRI' ? '#b3261e' : '#1f3a9e'; g.lineWidth = t.kind === 'fire' ? 2 : 1; g.beginPath(); t.pts.forEach((q, i) => i ? g.lineTo(q[0] * S, q[1] * S) : g.moveTo(q[0] * S, q[1] * S)); g.stroke(); }
    g.strokeStyle = '#8a7a5a'; g.lineWidth = 3; for (const r of T.map.roads) { g.beginPath(); r.pts.forEach((q, i) => i ? g.lineTo(q[0] * S, q[1] * S) : g.moveTo(q[0] * S, q[1] * S)); g.stroke(); }
    g.fillStyle = '#222'; g.font = "13px Caslon, Georgia"; for (const v of T.map.villages) g.fillText(v.name, v.c[0] * S + 4, v.c[1] * S);
    for (const o of sim.objectives) { g.strokeStyle = o.owner === 'BRI' ? '#b3261e' : '#1f3a9e'; g.beginPath(); g.arc(o.c[0] * S, o.c[1] * S, o.r * S, 0, 7); g.stroke(); g.fillText(o.id, o.c[0] * S - 4, o.c[1] * S + 4); }
    const w = T.map.world; g.strokeStyle = '#000'; g.setLineDash([6, 4]); g.strokeRect(w.playMin * S, w.playMin * S, (w.playMax - w.playMin) * S, (w.playMax - w.playMin) * S); g.setLineDash([]);
    shooterDots(g, (x, z) => [x * S, z * S], 0, 0, 5);
    const p = sim.player; youMarker(g, p.x * S, p.z * S, AGENT || !p.alive ? p.yaw : yaw, 60, 1.1);
    g.fillText('1 km', 20, cv.height - 20); g.fillRect(20, cv.height - 15, 1000 * S, 3);
  }

  // ---------- agent API (Cimmerian §11): same inputs a human has, held for n ticks ----------
  window.TF = {
    sim, T, F, scene, camera, renderer, terrain, men, rag, props, blood, skinned, fp, rifleBlock, HZ,
    get state() { return sim; }, get shooters() { return shooters; },
    step(a = {}, n = 1) {
      for (let i = 0; i < n; i++) { const input = { ...a }; if (i > 0) { input.crouch = input.prone = input.reload = input.grenade = input.respawnNow = false; } stepSim(input); }
      return sim.obs();
    },
    obs: () => sim.obs(), hash: () => sim.hash(), rambo: on => { sim.rambo = !!on; return sim.rambo; }, god: on => { sim.god = !!on; return sim.god; },
    render(dt = 1 / 60) { consumeEvents(); render(dt); },
    settle() { render(0.016); for (let i = 0; i < 60; i++) { terrain.update(camera, 200); if (!terrain.pending && i > 1) break; } props.last = props.lastWire = null; props.update(camera); },
    perf: () => ({ fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tiles: terrain.stats.tiles, terrainTris: terrain.stats.tris, corpses: men.corpses.length, ragdolls: rag.stats.active }),
  };
  function startGame() {
    $('menu').style.display = 'none'; $('giveup').hidden = true; $('hud').hidden = false; running = true; audio.start();
    renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
    if (!started) { started = true; message('Stand to. The bombardment is in its last minutes.', 4); }
  }
  let started = false;
  $('play').onclick = startGame;
  $('giveup').onclick = () => { giveUp = true; $('giveup').hidden = true; $('menu').style.display = 'none'; $('hud').hidden = false; running = true; };
  const setRambo = on => { sim.rambo = on; $('rambo').textContent = `Rambo mode: ${on ? 'on (survive 10 bullets)' : 'off'}`; $('rambo').setAttribute('aria-pressed', on); };
  $('rambo').onclick = () => setRambo(!sim.rambo);
  if (Q.has('rambo')) setRambo(true);
  const setGod = on => { sim.god = on; $('god').textContent = `God mode: ${on ? 'on' : 'off'}`; $('god').setAttribute('aria-pressed', on); };
  $('god').onclick = () => setGod(!sim.god);
  if (Q.has('god') || CHEAT) setGod(true);
  // first frames: build the near ground before the player sees it
  terrain.update(camera, 400);
  if (AGENT) { $('menu').style.display = 'none'; $('hud').hidden = false; running = true; }
  else { $('play').disabled = false; $('play').textContent = 'Go to the line'; setLoad(''); }
  // respawn from the card: inject into the next tick
  const realStep = sim.step.bind(sim);
  // (sent with every tick until the sim takes it: it may only go in three seconds after the fall)
  sim.step = input => { if (pendingRespawn !== null && !sim.player.alive) input = { ...input, respawn: true, respawnInto: pendingRespawn.into }; return realStep(input); };
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
}

function nearestOnSeg(p, a, b) {
  const ax = a[0], ay = a[1], az = a[2], vx = b[0] - ax, vy = b[1] - ay, vz = b[2] - az, L2 = vx * vx + vy * vy + vz * vz || 1;
  let t = ((p.x - ax) * vx + (p.y - ay) * vy + (p.z - az) * vz) / L2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + vx * t - p.x, ay + vy * t - p.y, az + vz * t - p.z);
}

// ---------- first-person SMLE: stock, magazine, bolt, nose cap, sights ----------
function makeViewModel(camera) {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x6b4529, roughness: 0.6 }), steel = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.4, metalness: 0.7 });
  const box = (w, h, d, m, x, y, z, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; };
  box(0.045, 0.11, 0.34, wood, 0, -0.05, 0.22, -0.12);          // butt
  box(0.04, 0.05, 0.62, wood, 0, -0.005, -0.25);               // fore-end
  box(0.03, 0.02, 0.58, wood, 0, 0.022, -0.28);                // handguard
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.25, 8), steel); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.012, -0.66); g.add(barrel);
  box(0.035, 0.04, 0.05, steel, 0, 0.005, -0.57);              // nose cap
  box(0.004, 0.022, 0.006, steel, 0, 0.042, -0.58);            // foresight blade
  box(0.03, 0.035, 0.16, steel, 0, 0.02, -0.02);               // receiver
  box(0.035, 0.07, 0.07, steel, 0, -0.05, 0.0);                // magazine
  box(0.02, 0.012, 0.02, steel, 0, 0.044, -0.07);              // rear sight
  const bolt = new THREE.Group(); const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), steel); handle.rotation.z = Math.PI / 2; handle.position.set(0.035, 0.02, 0.06); bolt.add(handle);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), steel); knob.position.set(0.07, 0.02, 0.06); bolt.add(knob); g.add(bolt); g.userData.bolt = bolt;
  // the right hand on the wrist of the stock, the left under the fore-end
  const skin = new THREE.MeshStandardMaterial({ color: 0xc19072, roughness: 0.7 }), sleeve = new THREE.MeshStandardMaterial({ color: 0x7b6c46, roughness: 0.95 });
  const hand = (x, y, z) => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin); h.scale.set(0.9, 0.8, 1.3); h.position.set(x, y, z); g.add(h); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.3, 8), sleeve); s.rotation.x = Math.PI / 2.4; s.position.set(x + 0.02, y - 0.09, z + 0.16); g.add(s); };
  hand(0.01, -0.06, 0.08); hand(-0.005, -0.045, -0.33);
  g.traverse(o => { if (o.isMesh) { o.renderOrder = 10; o.material.depthTest = true; } });
  camera.add(g); g.userData.t = 0;
  // the real model (models/weapons/lee_enfield.glb, CC0, Lucian Pavel) replaces the built-in rifle once it has loaded;
  // the hands and sleeves stay, and the built-in bolt handle keeps cycling
  const built = g.children.filter(o => o.isMesh && (o.material === wood || o.material === steel));
  new GLTFLoader().load('models/weapons/lee_enfield.glb', gl => {
    const r = gl.scene; r.rotation.y = Math.PI; r.position.set(0, -0.052, -0.3);
    r.traverse(o => { if (o.isMesh) { o.renderOrder = 10; o.castShadow = false; } });
    g.add(r); for (const o of built) o.visible = false; g.userData.bolt.visible = false; g.userData.model = r;
  }, undefined, e => console.warn('lee_enfield.glb not loaded; using the built-in rifle', e));
  return g;
}
function updateViewModel(g, p, W, dt, recoil, bob) {
  const ads = p.ads, cyc = p.cool > 0 ? 1 - p.cool / W.cycle : 1, rel = p.reloading > 0;
  g.userData.a = THREE.MathUtils.lerp(g.userData.a ?? 0, ads ? 1 : 0, Math.min(1, dt * 10));
  const a = g.userData.a, sway = Math.sin(bob) * 0.01 * (1 - a);
  // hip: low and right; aim: the sights on the eye line
  g.position.set(THREE.MathUtils.lerp(0.17, 0, a) + sway, THREE.MathUtils.lerp(-0.2, -0.043, a) - recoil * 0.015 + Math.abs(Math.cos(bob)) * 0.006 * (1 - a), THREE.MathUtils.lerp(-0.38, -0.2, a) + recoil * 0.06);
  g.rotation.set(recoil * 0.06 + (rel ? 0.5 : 0), THREE.MathUtils.lerp(0.05, 0, a), rel ? 0.4 : 0);
  // bolt: up, back, forward, down after each shot
  const b = g.userData.bolt, k = cyc < 1 ? Math.sin(Math.min(1, cyc * 1.2) * Math.PI) : 0;
  b.position.z = k * 0.08; b.rotation.z = k * 0.9;
}

boot().catch(e => { console.error(e); setLoad('Failed to load: ' + e.message); });
