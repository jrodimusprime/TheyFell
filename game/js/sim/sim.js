// The simulation: deterministic, fixed 60 Hz tick, seeded RNG, no wall-clock time (Cimmerian README §11).
// seed + per-tick inputs -> identical state on every run, so an AI agent can play it and recorded runs replay as tests.
// Rendering, ragdolls, particles and sound are cosmetic: they read `events` and never feed back in.
import { mulberry32, FNV } from '../core/rng.js';
import { segDist } from '../world/terrain.js';

export const HZ = 60, DT = 1 / HZ;
const G = 9.81;
export const WEAPONS = {
  smle:  { name: 'SMLE Mk III*', mag: 10, reserve: 60, cycle: 0.95, reload: 0.42, clip: 5, dmg: 100, spread: 0.0035, hip: 0.03, range: 700, auto: false },
  g98:   { name: 'Gewehr 98', mag: 5, reserve: 60, cycle: 1.0, reload: 0.5, clip: 5, dmg: 100, spread: 0.0035, hip: 0.03, range: 700, auto: false },
  mg08:  { name: 'MG 08', mag: 250, reserve: 2000, cycle: 0.133, reload: 6, clip: 250, dmg: 80, spread: 0.010, hip: 0.010, range: 1100, auto: true },
};
const SPEED = { walk: 1.7, run: 4.6, crouch: 1.1, prone: 0.45, advance: 1.7 };
const EYE = [1.62, 1.1, 0.35], HEIGHT = [1.78, 1.25, 0.45];
const START_TIME = 7 * 3600 + 26 * 60 + 30, MINE_TIME = 7 * 3600 + 28 * 60, ZERO = 7 * 3600 + 30 * 60;

export class Sim {
  constructor(T, F, { seed = 1, playerSide = 'BRI', bri = 150, ger = 84 } = {}) {
    this.T = T; this.F = F; this.seed = seed; this.rng = mulberry32(seed); this.tick = 0;
    this.map = T.map; this.events = []; this.soldiers = []; this.shells = []; this.grenades = [];
    this.flags = { mine: false, zero: false };
    this.objectives = this.map.objectives.map(o => ({ ...o, owner: 'GER', progress: 0 }));
    this.score = { BRI: { kills: 0, deaths: 0 }, GER: { kills: 0, deaths: 0 } };
    this.waveT = { BRI: 0, GER: 0 };
    this.trenchPts = { BRI: this._trenchPoints('BRI'), GER: this._trenchPoints('GER') };
    // the player first, then the AI, in a fixed order (Cimmerian §11: stable entity order)
    const ps = this.map.playerStart.pos, p0 = this._snapToTrench(ps[0], ps[1], playerSide, 30, true) || ps;   // on the fire-step, looking over the parapet
    this.player = this._spawn(playerSide, p0[0], p0[1], 'rifle', true);
    { const o = this.map.objectives[0].c; this.player.yaw = Math.atan2(-(o[0] - p0[0]), -(o[1] - p0[1])); }
    this._populate(bri, ger);
  }
  get time() { return START_TIME + this.tick / HZ; }
  clock() { const t = Math.floor(this.time); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }

  // ---------- setup ----------
  _trenchPoints(side) {   // fire-trench floor points of one side, used for spawning and posting men
    const out = [];
    // [floor x, floor z, segment, fire-step x, fire-step z]
    this.T.segs.forEach((s, i) => { if (s.side === side && (s.kind === 0 || (side === 'GER' && s.kind === 2)) && Math.hypot(s.bx - s.ax, s.bz - s.az) > 4) { const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2, o = s.kind === 0 ? s.hw - 0.33 : 0; out.push([mx, mz, i, mx + s.nx * o, mz + s.nz * o]); } });
    return out;
  }
  _snapToTrench(x, z, side, maxD = 60, step = false) {
    let best = null, bd = maxD;
    for (const p of this.trenchPts[side]) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = p; } }
    return best ? (step ? [best[3], best[4]] : [best[0], best[1]]) : null;
  }
  _spawn(side, x, z, role = 'rifle', isPlayer = false) {
    const id = this.soldiers.length, w = role === 'mg' ? 'mg08' : side === 'BRI' ? 'smle' : 'g98';
    const s = { id, side, role, isPlayer, x, z, y: this.T.height(x, z), vy: 0, yaw: side === 'BRI' ? -Math.PI / 2 : Math.PI / 2, pitch: 0,
      stance: 0, hp: 100, alive: true, deadAt: 0, onGround: true, climb: 0, climbTo: null, stamina: 1, kills: 0, deaths: 0,
      weapon: w, mag: WEAPONS[w].mag, reserve: WEAPONS[w].reserve, cool: 0, reloading: 0, ads: false,
      ai: isPlayer ? null : { mode: 'hold', think: this.rng.int(30), target: -1, post: [x, z], goal: null, wave: 0, fireUntil: 0, seen: 0, skill: this.rng.range(0.6, 1.2) },
      lastHit: null, rng: mulberry32((this.seed * 7919 + id * 104729) >>> 0) };
    s.yaw = side === 'BRI' ? -Math.PI / 2 * 1 : Math.PI / 2;   // face the enemy: BRI east, GER west
    this.soldiers.push(s);
    return s;
  }
  _populate(nb, ng) {
    const r = this.rng, near = (side, cx, cz, R) => this.trenchPts[side].filter(p => Math.hypot(p[0] - cx, p[1] - cz) < R);
    // the 34th Division's frontage, astride La Boisselle from Mash Valley to Sausage Valley, around the player;
    // the British in their front and support lines, the Germans in the Schwabenhöhe and La Boisselle salient opposite
    const ps = this.player, [lx, lz] = this.map.objectives[0].c;
    const bri = near('BRI', ps.x, ps.z, 700), ger = near('GER', lx, lz - 120, 650);
    // each man his own place on a fire-trench floor (a shuffled draw, no two on one spot)
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const briPts = shuffle(bri), gerPts = shuffle(ger);
    for (let i = 0; i < nb; i++) { const p = briPts[i % briPts.length]; const s = this._spawn('BRI', p[0], p[1]); s.ai.wave = i % 4; s.stance = 1; }
    for (const m of this.map.mgs) { const p = this._snapToTrench(m[0], m[1], 'GER', 80, true); if (p) { const s = this._spawn('GER', p[0], p[1], 'mg'); s.ai.post = p; } }
    for (let i = this.soldiers.filter(s => s.side === 'GER').length, k = 0; i < ng; i++, k++) { const p = gerPts[k % gerPts.length]; const s = this._spawn('GER', p[0], p[1]); s.stance = 1; s.ai.mode = 'shelter'; s.ai.post = [p[3], p[4]]; }
    for (const s of this.soldiers) if (s.role === 'mg') s.ai.mode = 'shelter';
  }

  // ---------- the tick ----------
  step(input = {}) {
    const p = this.player;
    this._player(p, input);
    for (const s of this.soldiers) if (!s.isPlayer && s.alive) this._think(s);
    for (const s of this.soldiers) if (s.alive) this._move(s);
    this._director();
    this._objectives();
    this._respawns(input);
    this.tick++;
  }

  // ---------- player input -> intent ----------
  _player(p, a) {
    if (!p.alive) { p.intent = null; if (a.respawn && this.tick - p.deadAt > HZ * 3) this._respawn(p, a.respawnAt); return; }
    if (a.yaw !== undefined) p.yaw = a.yaw; if (a.pitch !== undefined) p.pitch = Math.max(-1.45, Math.min(1.45, a.pitch));
    if (a.crouch) p.stance = p.stance === 1 ? 0 : 1; if (a.prone) p.stance = p.stance === 2 ? 0 : 2;
    p.ads = !!a.ads;
    p.intent = { f: a.forward || 0, s: a.side || 0, run: !!a.run && p.stance === 0, jump: !!a.jump };
    if (a.reload) this._startReload(p);
    if (a.fire) this._fire(p, p.yaw, p.pitch);
    if (a.grenade) this._throwGrenade(p);
    this._weaponTick(p);
  }

  // ---------- AI ----------
  _think(s) {
    this._weaponTick(s);
    const ai = s.ai, t = this.time;
    if (--ai.think > 0) { this._aimAndFire(s); return; }
    ai.think = 20 + s.rng.int(20);
    // before the barrage lifts, the Germans shelter in their deep dugouts (they come up when it lifts: the race for the parapet)
    if (ai.mode === 'shelter') { s.stance = 1; s.intent = null; if (t >= ZERO - 4 + s.rng.range(0, 25)) ai.mode = s.role === 'mg' ? 'mg' : 'hold'; return; }
    // British: wait in the trench for zero hour and their wave, then go over the top and walk forward
    if (s.side === 'BRI' && ai.mode === 'hold' && !ai.goal) {
      if (t >= ZERO + ai.wave * 25 + s.rng.range(0, 6)) { ai.mode = 'advance'; ai.goal = this._goalFor(s); s.stance = 0; }
      else { s.intent = null; s.stance = 1; return; }
    }
    // look for an enemy: nearest visible within range
    const W = WEAPONS[s.weapon], range = s.role === 'mg' ? 900 : s.side === 'GER' ? 450 : 300;
    let best = -1, bd = range;
    const cand = [];
    for (const o of this.soldiers) {
      if (!o.alive || o.side === s.side) continue;
      const d = Math.abs(o.x - s.x) + Math.abs(o.z - s.z); if (d < range * 1.3) cand.push([d, o]);
    }
    cand.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
    for (let i = 0; i < Math.min(4, cand.length); i++) {   // line-of-sight checks are the expensive part: nearest few only
      const o = cand[i][1], d = Math.hypot(o.x - s.x, o.z - s.z); if (d > range) continue;
      if (this._canSee(s, o, d)) { best = o.id; bd = d; break; }
    }
    ai.target = best;
    if (best >= 0) { ai.seen = this.tick; if (s.side === 'BRI' && ai.mode === 'advance' && bd > 40 && s.rng() < 0.45) { ai.fireUntil = this.tick + 60 + s.rng.int(120); } }
    if (s.mag === 0 && !s.reloading) this._startReload(s);
    // movement intent
    if (ai.mode === 'advance' && ai.goal) {
      const dx = ai.goal[0] - s.x, dz = ai.goal[1] - s.z, d = Math.hypot(dx, dz);
      if (d < 6) { ai.goal = this._goalFor(s, true); }
      const firing = this.tick < ai.fireUntil;
      s.stance = firing ? 1 : 0;
      s.intent = firing ? null : { f: 1, s: 0, run: best >= 0 && bd < 120, jump: true, yaw: Math.atan2(-dx, -dz) + s.rng.range(-0.15, 0.15) };
    } else if (ai.mode === 'hold' || ai.mode === 'mg') {
      // German defenders man the fire-step: stand to fire, duck to reload
      s.stance = s.reloading ? 1 : 0;
      const dx = ai.post[0] - s.x, dz = ai.post[1] - s.z, d = Math.hypot(dx, dz);
      s.intent = d > 3 ? { f: 1, s: 0, run: false, jump: false, yaw: Math.atan2(-dx, -dz) } : null;
      if (s.side === 'GER' && s.role !== 'mg' && this._enemyNear(s, 25) && s.rng() < 0.05) ai.mode = 'hold';
    }
  }
  _goalFor(s, next = false) {
    // the nearest objective the British don't hold yet, approached with some spread so they don't all walk one file
    const objs = this.objectives.filter(o => o.owner !== s.side);
    if (!objs.length) return null;
    const o = objs.reduce((b, o) => Math.hypot(o.c[0] - s.x, o.c[1] - s.z) < Math.hypot(b.c[0] - s.x, b.c[1] - s.z) ? o : b);
    return [o.c[0] + s.rng.range(-o.r, o.r) * 0.6, o.c[1] + s.rng.range(-o.r, o.r) * 0.6];
  }
  _enemyNear(s, r) { for (const o of this.soldiers) if (o.alive && o.side !== s.side && Math.abs(o.x - s.x) < r && Math.abs(o.z - s.z) < r) return true; return false; }
  _eye(s) { return s.y + EYE[s.stance]; }
  _canSee(s, o, d) {
    const ox = s.x, oy = this._eye(s) + 0.12, oz = s.z, tx = o.x, ty = o.y + HEIGHT[o.stance] * 0.85, tz = o.z;   // +0.12: leaning into the parapet
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, L = Math.hypot(dx, dy, dz);
    // a man in the open is easy to see; one in a trench or prone in long grass far less so
    if (o.stance === 2 && d > 120) return false;
    return this.T.raycast(ox, oy, oz, dx / L, dy / L, dz / L, L - 0.5) < 0;
  }
  _aimAndFire(s) {
    const ai = s.ai; if (ai.target < 0 || ai.mode === 'shelter') return;
    if (s.side === 'BRI' && ai.mode === 'advance' && this.tick >= ai.fireUntil && s.rng() > 0.004) return;   // walking forward, rifle at the port
    const o = this.soldiers[ai.target]; if (!o.alive) { ai.target = -1; return; }
    const dx = o.x - s.x, dz = o.z - s.z, d = Math.hypot(dx, dz), ty = o.y + HEIGHT[o.stance] * 0.7, dy = ty - this._eye(s);
    s.yaw = Math.atan2(-dx, -dz); s.pitch = Math.atan2(dy, d);
    if (s.cool > 0 || s.reloading) return;
    const W = WEAPONS[s.weapon];
    if (!W.auto && s.rng() > 0.05) return;   // riflemen take their time over a shot
    const err = (0.006 + d * 0.00003) / ai.skill;
    this._fire(s, s.yaw + s.rng.gauss() * err, s.pitch + s.rng.gauss() * err * 0.7);
  }

  // ---------- weapons ----------
  _weaponTick(s) {
    if (s.cool > 0) s.cool -= DT;
    if (s.reloading > 0) {
      s.reloading -= DT;
      if (s.reloading <= 0) {
        const W = WEAPONS[s.weapon], n = Math.min(W.clip, W.mag - s.mag, s.reserve);
        s.mag += n; s.reserve -= n; s.reloading = 0;
        if (s.mag < W.mag && s.reserve > 0 && W.clip < W.mag && s.reloadMore) this._startReload(s);
        this.events.push({ t: 'reload_done', id: s.id });
      }
    }
  }
  _startReload(s) {
    const W = WEAPONS[s.weapon];
    if (s.reloading > 0 || s.mag >= W.mag || s.reserve <= 0) return;
    s.reloading = W.clip >= W.mag ? W.reload : W.reload * 4.2 * (W.clip / 5); s.reloadMore = true;
    this.events.push({ t: 'reload', id: s.id });
  }
  _fire(s, yaw, pitch) {
    const W = WEAPONS[s.weapon];
    if (s.cool > 0 || s.reloading > 0 || s.climb > 0) return false;
    if (s.mag <= 0) { this._startReload(s); return false; }
    s.mag--; s.cool = W.cycle;
    const moving = s.intent && (s.intent.f || s.intent.s);
    const spread = (s.isPlayer ? (s.ads ? W.spread : W.hip) : 0) + (moving ? 0.012 : 0) + (s.stance === 2 ? -0.001 : 0);
    const r = s.rng; yaw += r.gauss() * spread; pitch += r.gauss() * spread;
    const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
    const ox = s.x, oy = this._eye(s), oz = s.z;
    let tHit = this.T.raycast(ox, oy, oz, dx, dy, dz, W.range); if (tHit < 0) tHit = W.range;
    let victim = null, zone = 'body';
    for (const o of this.soldiers) {
      if (o === s || !o.alive) continue;
      const t = rayCapsule(ox, oy, oz, dx, dy, dz, o, tHit); if (t < 0) continue;
      tHit = t; victim = o;
      const hy = oy + dy * t - o.y; zone = hy > HEIGHT[o.stance] * 0.84 ? 'head' : hy < HEIGHT[o.stance] * 0.45 ? 'legs' : 'body';
    }
    const hx = ox + dx * tHit, hy = oy + dy * tHit, hz = oz + dz * tHit;
    this.events.push({ t: 'shot', id: s.id, w: s.weapon, o: [ox, oy, oz], h: [hx, hy, hz], victim: victim ? victim.id : -1 });
    if (victim) this._damage(victim, zone === 'head' ? 200 : zone === 'legs' ? W.dmg * 0.55 : W.dmg, s, { dir: [dx, dy, dz], zone, point: [hx, hy, hz], kind: 'bullet' });
    return true;
  }
  _throwGrenade(s) {
    if (s.grenades === undefined) s.grenades = 3;
    if (s.grenades <= 0 || s.cool > 0) return;
    s.grenades--; s.cool = 1.2;
    const cp = Math.cos(s.pitch + 0.35), v = 16;
    this.grenades.push({ x: s.x, y: this._eye(s), z: s.z, vx: -Math.sin(s.yaw) * cp * v, vy: Math.sin(s.pitch + 0.35) * v, vz: -Math.cos(s.yaw) * cp * v, fuse: 4 * HZ, owner: s.id });
    this.events.push({ t: 'throw', id: s.id });
  }
  _damage(v, dmg, src, info) {
    if (!v.alive) return;
    v.hp -= dmg; v.lastHit = info;
    this.events.push({ t: 'hit', id: v.id, dmg, ...info });
    if (v.hp > 0) return;
    v.alive = false; v.hp = 0; v.deadAt = this.tick; v.deaths++; this.score[v.side].deaths++;
    if (src && src.side !== v.side) { src.kills++; this.score[src.side].kills++; }
    this.events.push({ t: 'death', id: v.id, by: src ? src.id : -1, ...info });
  }
  _explode(x, y, z, r, kill, src, kind = 'shell') {
    this.events.push({ t: 'explosion', p: [x, y, z], r, kind });
    for (const o of this.soldiers) {
      if (!o.alive) continue;
      const d = Math.hypot(o.x - x, o.y + 0.9 - y, o.z - z); if (d > r) continue;
      // a man in a trench is sheltered from a burst outside it
      const sheltered = this.T.inTrench(o.x, o.z) && !(Math.hypot(o.x - x, o.z - z) < 3);
      const dmg = d < kill ? 250 : 120 * (1 - d / r) * (sheltered ? 0.25 : 1);
      if (dmg < 5) continue;
      const L = Math.max(0.5, Math.hypot(o.x - x, o.z - z));
      this._damage(o, dmg, src, { dir: [(o.x - x) / L, 0.8, (o.z - z) / L], zone: 'body', point: [o.x, o.y + 1, o.z], kind, blast: Math.min(1, (r - d) / r + 0.3) });
    }
  }

  // ---------- movement (player and AI share it) ----------
  _move(s) {
    const T = this.T, I = s.intent;
    if (s.climb > 0) {          // scrambling up a trench wall or over the parapet
      s.climb -= DT;
      if (s.climb <= 0) { s.x = s.climbTo[0]; s.z = s.climbTo[1]; s.y = T.height(s.x, s.z); s.climbTo = null; }
      return;
    }
    if (I && I.yaw !== undefined) s.yaw = I.yaw;
    let sp = 0, mx = 0, mz = 0;
    if (I && (I.f || I.s)) {
      const run = I.run && s.stamina > 0.05;
      sp = s.stance === 2 ? SPEED.prone : s.stance === 1 ? SPEED.crouch : run ? SPEED.run : s.isPlayer ? SPEED.walk : SPEED.advance;
      if (run) s.stamina = Math.max(0, s.stamina - DT / 14); else s.stamina = Math.min(1, s.stamina + DT / 9);
      const f = I.f, sd = I.s, L = Math.hypot(f, sd) || 1, sy = Math.sin(s.yaw), cy = Math.cos(s.yaw);
      mx = (-sy * f + cy * sd) / L; mz = (-cy * f - sy * sd) / L;
      const wire = this.F.wireAt(s.x, s.z); if (wire > 0) sp *= 1 - wire * 0.78;
      // walking up a steep crater side is slow
      const ahead = T.height(s.x + mx * 0.6, s.z + mz * 0.6) - T.height(s.x, s.z); if (ahead > 0.15) sp *= Math.max(0.45, 1 - ahead * 0.8);
    } else s.stamina = Math.min(1, s.stamina + DT / 7);
    const nx = s.x + mx * sp * DT, nz = s.z + mz * sp * DT, x0 = s.x, z0 = s.z;
    const lim = [5, this.T.size - 5], R = 0.3;
    // a man is a 0.3 m circle: he can't move into ground that rises more than a step anywhere ahead of him on that circle
    // (only the leading side blocks, so a man pressed against a wall can always step away from it)
    const ok = (x, z, dx, dz) => {
      if (x < lim[0] || z < lim[0] || x > lim[1] || z > lim[1]) return false;
      const L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
      // the player is probed on 16 rays at two radii, so a sharp wall corner can't slip between probes; AI on 8
      const n = s.isPlayer ? 16 : 8, lim2 = s.onGround ? 0.75 : 0.02;   // in the air he can't pass into anything above his feet
      for (let k = 0; k < n; k++) {
        const a = k * Math.PI * 2 / n, cx = Math.cos(a), cz = Math.sin(a);
        if (cx * ux + cz * uz < 0.1) continue;
        if (T.height(x + cx * R, z + cz * R) - s.y > lim2) return false;
        if (s.isPlayer && T.height(x + cx * R * 0.6, z + cz * R * 0.6) - s.y > lim2) return false;
      }
      return !this.F.wallAt(x, z, s.y);
    };
    if (sp > 0) {
      const dx = mx * sp * DT, dz = mz * sp * DT;
      if (ok(nx, nz, dx, dz)) { s.x = nx; s.z = nz; }
      else if (Math.abs(dx) > 1e-5 && ok(nx, s.z, dx, 0)) s.x = nx;
      else if (Math.abs(dz) > 1e-5 && ok(s.x, nz, 0, dz)) s.z = nz;
      else if (I.jump && s.onGround) this._tryClimb(s, mx, mz);
    }
    if (s.x !== x0 || s.z !== z0 || !s.onGround) this._depenetrate(s);
    // vertical: follow the ground, fall into trenches and shell holes
    const gh = T.height(s.x, s.z);
    if (I && I.jump && s.onGround && s.isPlayer && sp === 0) { s.vy = 3.6; s.onGround = false; }
    if (I && I.jump && s.onGround && s.isPlayer && sp > 0 && gh - s.y < 0.1) { /* jumping while walking: a hop */ s.vy = 3.6; s.onGround = false; }
    s.vy -= G * DT; s.y += s.vy * DT;
    if (s.y <= gh) { if (!s.onGround && s.vy < -9) this._damage(s, (-s.vy - 9) * 18, null, { dir: [0, -1, 0], zone: 'legs', point: [s.x, s.y, s.z], kind: 'fall' }); s.y = gh; s.vy = 0; s.onGround = true; }
    else if (s.y - gh > 0.3) s.onGround = false; else { s.y = gh; s.vy = 0; s.onGround = true; }
  }
  // push a man out of any wall his 0.3 m body overlaps (dropping in beside a wall, a crater opening up under him)
  _depenetrate(s) {
    const T = this.T, n = s.isPlayer ? 16 : 8, R = 0.3;
    const t = T.trenchAt(s.x, s.z, this._dp || (this._dp = {}));
    if (t.seg < 0 || t.d > T.segs[t.seg].hw + 0.5) { if (!T.craterAt(s.x, s.z)) return; }   // walls only exist at trench edges (and steep crater sides)
    for (let it = 0; it < 6; it++) {
      let px = 0, pz = 0, hit = 0;
      for (let k = 0; k < n; k++) {
        const a = k * Math.PI * 2 / n, cx = Math.cos(a), cz = Math.sin(a);
        for (const r of [R, R * 0.6]) if (T.height(s.x + cx * r, s.z + cz * r) - s.y > 0.75) { px -= cx * (R - r + 0.05); pz -= cz * (R - r + 0.05); hit++; break; }
      }
      if (!hit) return;
      const L = Math.hypot(px, pz); if (L < 1e-6) return;
      const step = Math.min(0.06, L / hit + 0.01), nx = s.x + px / L * step, nz = s.z + pz / L * step;
      if (T.height(nx, nz) - s.y > 0.75) return;   // nowhere better to go
      s.x = nx; s.z = nz;
    }
  }
  _tryClimb(s, mx, mz) {
    // find the top of the wall ahead: up to 2.7 m (a trench wall with a parapet), with somewhere to stand beyond it
    const T = this.T;
    for (let d = 0.5; d <= 3.3; d += 0.35) {
      const x = s.x + mx * d, z = s.z + mz * d, h = T.height(x, z);
      if (h - s.y > 3.6) return;
      if (h - s.y < 0.75) continue;
      const fx = x + mx * 0.9, fz = z + mz * 0.9, fh = T.height(fx, fz);
      if (Math.abs(fh - h) < 1.0 && !this.F.wallAt(fx, fz, fh)) { s.climb = 0.5 + (h - s.y) * 0.35; s.climbTo = [fx, fz]; this.events.push({ t: 'climb', id: s.id, h: h - s.y }); return; }
    }
  }

  // ---------- the battle's own clock: barrage, mines, zero hour, enemy shellfire ----------
  _director() {
    const t = this.time, r = this.rng;
    if (!this.flags.mine && t >= MINE_TIME) {
      this.flags.mine = true;
      for (const m of this.map.mines) {
        this.T.mineBlown[m.name] = true;
        this.events.push({ t: 'mine', name: m.name, p: [m.c[0], this.T.height(m.c[0], m.c[1]), m.c[1]], r: m.craterR });
        this._explode(m.c[0], this.T.height(m.c[0], m.c[1]) + 2, m.c[1], m.craterR * 2.2, m.craterR * 1.25, null, 'mine');
      }
    }
    if (!this.flags.zero && t >= ZERO) { this.flags.zero = true; this.events.push({ t: 'zero' }); }
    // British barrage: on the German front line until zero, then lifting onto the German rear
    const lift = t >= ZERO;
    const rate = lift ? 0.06 : 0.22;
    if (r() < rate) {
      const ger = this.trenchPts.GER, p = r.pick(ger);
      let x = p[0] + r.gauss() * 18, z = p[1] + r.gauss() * 18;
      if (lift) { x += 250 + r() * 500; }
      this.shells.push({ x, z, at: this.tick + 40 + r.int(60), kind: r() < 0.35 ? 'shrapnel' : 'he', cal: r() < 0.15 ? 'heavy' : 'field', side: 'BRI' });
    }
    // German defensive fire from zero hour: on the British front line and no man's land, where men are
    if (lift && r() < 0.05) {
      const bri = this.soldiers.filter(s => s.side === 'BRI' && s.alive);
      if (bri.length) { const s = r.pick(bri); this.shells.push({ x: s.x + r.gauss() * 35, z: s.z + r.gauss() * 35, at: this.tick + 50 + r.int(80), kind: r() < 0.5 ? 'shrapnel' : 'he', cal: 'field', side: 'GER' }); }
    }
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      if (sh.at - this.tick === 45) this.events.push({ t: 'incoming', p: [sh.x, 0, sh.z], kind: sh.kind, cal: sh.cal });
      if (this.tick < sh.at) continue;
      this.shells.splice(i, 1);
      if (sh.x < 0 || sh.z < 0 || sh.x > this.T.size || sh.z > this.T.size) continue;
      const y = this.T.height(sh.x, sh.z);
      if (sh.kind === 'shrapnel') this._explode(sh.x, y + 12, sh.z, 22, 0, null, 'shrapnel');
      else {
        const heavy = sh.cal === 'heavy';
        this._explode(sh.x, y + 0.5, sh.z, heavy ? 18 : 10, heavy ? 6 : 3, null, heavy ? 'heavy' : 'he');
        const c = this.T.addCrater(sh.x, sh.z, heavy ? 4 : 2, heavy ? 1.6 : 0.8);
        this.events.push({ t: 'crater', p: [c.x, y, c.z], r: c.r });
      }
    }
    // grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vy -= G * DT; g.x += g.vx * DT; g.y += g.vy * DT; g.z += g.vz * DT;
      const gh = this.T.height(g.x, g.z);
      if (g.y < gh + 0.05) { g.y = gh + 0.05; g.vy = -g.vy * 0.3; g.vx *= 0.5; g.vz *= 0.5; }
      if (--g.fuse <= 0) { this.grenades.splice(i, 1); this._explode(g.x, g.y + 0.2, g.z, 9, 2.5, this.soldiers[g.owner], 'grenade'); }
    }
  }
  _objectives() {
    if (this.tick % 30) return;
    for (const o of this.objectives) {
      let b = 0, g = 0;
      for (const s of this.soldiers) if (s.alive && Math.hypot(s.x - o.c[0], s.z - o.c[1]) < o.r) s.side === 'BRI' ? b++ : g++;
      const push = b > g ? 1 : g > b ? -1 : 0;
      if (!push) continue;
      o.progress = Math.max(-1, Math.min(1, o.progress + push * 0.04 * Math.min(4, Math.abs(b - g))));
      const owner = o.progress >= 1 ? 'BRI' : o.progress <= -1 ? 'GER' : o.owner;
      if (owner !== o.owner) { o.owner = owner; this.events.push({ t: 'captured', id: o.id, name: o.name, side: owner }); }
    }
  }
  // ---------- respawn: death is common and the line is always fed with fresh men ----------
  spawnPoints(side) {
    const pts = this.map.spawns[side].map(p => ({ p, name: 'Trench' }));
    for (const o of this.objectives) if (o.owner === side) pts.push({ p: o.c, name: o.name });
    return pts;
  }
  _respawn(s, at) {
    const pts = this.spawnPoints(s.side), r = s.rng;
    let pick = at ? pts.find(q => q.name === at) : null;
    if (!pick) { // nearest to where the fight is, for the player; spread for AI
      pick = s.isPlayer ? pts.reduce((b, q) => Math.hypot(q.p[0] - s.x, q.p[1] - s.z) < Math.hypot(b.p[0] - s.x, b.p[1] - s.z) ? q : b) : r.pick(pts);
    }
    let [x, z] = pick.p; const snap = this._snapToTrench(x + r.range(-25, 25), z + r.range(-25, 25), s.side, 60, s.isPlayer || s.side === 'GER'); if (snap) [x, z] = snap;
    Object.assign(s, { x, z, y: this.T.height(x, z), vy: 0, hp: 100, alive: true, climb: 0, climbTo: null, stance: 1, stamina: 1,
      mag: WEAPONS[s.weapon].mag, reserve: WEAPONS[s.weapon].reserve, reloading: 0, cool: 0, grenades: 3, lastHit: null });
    if (s.ai) Object.assign(s.ai, { mode: s.side === 'BRI' ? 'advance' : s.role === 'mg' ? 'mg' : 'hold', target: -1, goal: null, post: [x, z], think: 30 + r.int(60) });
    if (s.ai && s.side === 'BRI') { s.ai.goal = this._goalFor(s); if (this.time < ZERO) s.ai.mode = 'hold'; }
    this.events.push({ t: 'respawn', id: s.id, p: [x, s.y, z] });
  }
  _respawns() {
    // AI reinforcements come up in waves, as fresh platoons did
    for (const side of ['BRI', 'GER']) {
      if (this.tick < this.waveT[side]) continue;
      this.waveT[side] = this.tick + HZ * (side === 'BRI' ? 20 : 28);
      for (const s of this.soldiers) if (!s.isPlayer && s.side === side && !s.alive && this.tick - s.deadAt > HZ * 8) this._respawn(s);
    }
  }

  // ---------- agent interface ----------
  hash() {
    const h = new FNV().u32(this.tick).u32(this.rng.state());
    for (const s of this.soldiers) h.f(s.x).f(s.y).f(s.z).f(s.hp).u32(s.alive ? 1 : 0).u32(s.mag);
    for (const o of this.objectives) h.f(o.progress);
    return h.hex();
  }
  outOfBounds(s = this.player) { const w = this.map.world; return s.x < w.playMin || s.z < w.playMin || s.x > w.playMax || s.z > w.playMax; }
  obs() {
    const p = this.player, W = WEAPONS[p.weapon];
    return {
      tick: this.tick, time: this.clock(), hash: this.hash(), mine: this.flags.mine, zero: this.flags.zero,
      player: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: p.yaw, pitch: p.pitch, hp: Math.round(p.hp), alive: p.alive, stance: p.stance,
        weapon: W.name, mag: p.mag, reserve: p.reserve, reloading: p.reloading > 0, oob: this.outOfBounds(), inTrench: !!this.T.inTrench(p.x, p.z), kills: p.kills, deaths: p.deaths,
        canRespawn: !p.alive && this.tick - p.deadAt > HZ * 3, wire: +this.F.wireAt(p.x, p.z).toFixed(2), climbing: p.climb > 0 },
      soldiers: this.soldiers.filter(s => !s.isPlayer).map(s => ({ id: s.id, side: s.side, role: s.role, x: +s.x.toFixed(1), z: +s.z.toFixed(1), alive: s.alive, mode: s.ai.mode })),
      objectives: this.objectives.map(o => ({ id: o.id, name: o.name, owner: o.owner, progress: +o.progress.toFixed(2) })),
      score: this.score,
    };
  }
}

// ray vs a soldier's body (vertical capsule; prone men are a low, long target)
function rayCapsule(ox, oy, oz, dx, dy, dz, o, maxT) {
  const H = HEIGHT[o.stance], R = o.stance === 2 ? 0.45 : 0.27;
  // closest approach of the ray to the vertical axis segment
  const ax = o.x, az = o.z, ay0 = o.y + R * 0.5, ay1 = o.y + H - R * 0.6;
  const wx = ox - ax, wz = oz - az, a = dx * dx + dz * dz;
  if (a < 1e-9) return -1;
  const b = wx * dx + wz * dz, c = wx * wx + wz * wz - R * R, disc = b * b - a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t < 0.2 || t > maxT) return -1;
  const y = oy + dy * t;
  if (y < ay0 - R || y > ay1 + R) return -1;
  return t;
}
