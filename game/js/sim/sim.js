// The simulation: deterministic, fixed 60 Hz tick, seeded RNG, no wall-clock time (Cimmerian README §11).
// seed + per-tick inputs -> identical state on every run, so an AI agent can play it and recorded runs replay as tests.
// Rendering, ragdolls, particles and sound are cosmetic: they read `events` and never feed back in.
import { mulberry32, FNV } from '../core/rng.js';
import { segDist } from '../world/terrain.js';

export const HZ = 60, DT = 1 / HZ;
// the enemy's chance of hitting with a round at distance d metres: 50% at 25 m, 1% at 100 m, linear between (and beyond, capped)
// how far a man will engage: riflemen 300 m, machine guns 700 m
export const engageRange = s => s.role === 'mg' ? 700 : 300;
export const hitChance = d => Math.max(0.01, Math.min(0.66, 0.5 - (d - 25) * 0.49 / 75));
const G = 9.81;
export const WEAPONS = {
  smle:  { name: 'SMLE Mk III*', mag: 10, reserve: 60, cycle: 0.95, reload: 0.42, clip: 5, dmg: 100, spread: 0.0012, hip: 0.03, range: 700, auto: false },
  g98:   { name: 'Gewehr 98', mag: 5, reserve: 60, cycle: 1.0, reload: 0.5, clip: 5, dmg: 100, spread: 0.0011, hip: 0.03, range: 700, auto: false },
  mg08:  { name: 'MG 08', mag: 250, reserve: 2000, cycle: 0.133, reload: 6, clip: 250, dmg: 80, spread: 0.010, hip: 0.010, range: 1100, auto: true },
  vickers: { name: 'Vickers', mag: 250, reserve: 2000, cycle: 0.125, reload: 6, clip: 250, dmg: 80, spread: 0.010, hip: 0.010, range: 1100, auto: true },
};
// a bullet's damage is not a sure kill: drawn from a bell curve for where it hits (out of 100 hp). A body hit averages 58
// (it rarely drops a man outright: most take two, some three); the head usually kills; the legs wound. Scaled by the
// weapon (the MG 08's 80 against a rifle's 100).
const HIT = { head: [110, 20], body: [58, 20], legs: [30, 10] };
export function bulletDamage(W, zone, rng) {
  const [m, sd] = HIT[zone] || HIT.body;
  return Math.max(8, Math.min(140, (m + sd * rng.gauss()) * W.dmg / 100));
}
// close quarters: a strike is wound up for STRIKE_HIT ticks, lands if he is still within reach and in front, then
// recovers; damage on a bell curve for the weapon (the bayonet usually kills, a club or knife often takes two)
const STRIKE_TICKS = 36, STRIKE_HIT = 15, REACH = 2.0;
// forward spawns (a strongpoint his side holds): men come up a dugout's stairs, two at most from each per wave
const EMERGE_TICKS = 110, FWD_PER_WAVE = 2;
// machine guns: emplaced, belt-fed, water-cooled (the German MG 08 on its sledge, the British Vickers on its tripod),
// crewed by a gunner and a loader. ~450-480 rounds a minute in bursts, traversing along a line of men; 250-round belts
// (a change takes 4.5 s with the loader, 8 s alone); the water in the jacket boils after a few hundred rounds of
// steady fire (steam); a stoppage now and then. Each round is a real ray (it hits whoever is in its path), and
// rounds cracking past within a few metres pin men down.
export const GUNS = {
  mg08:    { name: 'MG 08', cycle: 60 / 450, disp: 0.0032, range: 1000, arc: 1.0, belts: 12 },
  vickers: { name: 'Vickers', cycle: 60 / 480, disp: 0.0032, range: 1000, arc: 1.0, belts: 12 },
};
export const BELT = 250;
// grenades (three a man: the British the Mills bomb, the Germans the stick grenade). A throw: 0.5 s to get it out and pull
// the pin, then the overhand throw, the bomb leaving the hand 0.34 s into it (THROW_RELEASE ticks before the end); the
// fuse burns from the release (the Mills's lever flies off then): 5 s, the stick grenade's 5.5. Speed 6 to 28 m/s with
// the power of the throw (28 m/s at 45 degrees is ~80 m).
export const THROW_TICKS = 100, THROW_PREP = 70, THROW_RELEASE = 50;
export const NADE = { BRI: { kind: 'mills', fuse: 5 }, GER: { kind: 'stick', fuse: 5.5 } };
// twice the old reach (a full throw ~75 m at 45 degrees), and the harder he throws the flatter it goes (0.3 rad above his
// view for a lob down to 0.15 for a full throw), so a long throw gets there quicker than a slow high lob would
const NADE_V0 = 6, NADE_V1 = 22, NADE_LOFT = 0.3, NADE_FLAT = 0.15;
const nadeLoft = power => NADE_LOFT - NADE_FLAT * Math.max(0, Math.min(1, power));
// where and how fast a bomb leaves his hand (over his head, a little forward and to the right)
export function nadeLaunch(x, y, z, yaw, pitch, power) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), v = NADE_V0 + NADE_V1 * Math.max(0, Math.min(1, power)), a = Math.max(-0.4, Math.min(1.3, pitch + nadeLoft(power))), c = Math.cos(a);
  return { x: x + fx * 0.3 - fz * 0.15, y: y + 0.25, z: z + fz * 0.3 + fx * 0.15, vx: fx * c * v, vy: Math.sin(a) * v, vz: fz * c * v };
}
// one tick of a bomb in flight or on the ground: it bounces off the slope it lands on (a quarter of its speed into the
// ground comes back) and drags along it, then rolls to a stop
export function nadeStep(g, T) {
  if (g.rest) return true;
  g.vy -= G * DT; g.x += g.vx * DT; g.y += g.vy * DT; g.z += g.vz * DT;
  const gh = T.height(g.x, g.z);
  if (g.y < gh + 0.04) {
    const e = 0.4, hx = (T.height(g.x + e, g.z) - T.height(g.x - e, g.z)) / (2 * e), hz = (T.height(g.x, g.z + e) - T.height(g.x, g.z - e)) / (2 * e), nl = Math.hypot(hx, 1, hz);
    const nx = -hx / nl, ny = 1 / nl, nz = -hz / nl, vn = g.vx * nx + g.vy * ny + g.vz * nz;
    g.y = gh + 0.04; g.bounces = (g.bounces || 0) + 1;
    if (vn < 0) { const tx = g.vx - vn * nx, ty = g.vy - vn * ny, tz = g.vz - vn * nz, k = g.bounces > 1 ? 0.75 : 0.45; g.vx = tx * k - 0.25 * vn * nx; g.vy = ty * k - 0.25 * vn * ny; g.vz = tz * k - 0.25 * vn * nz; }
    else { g.vx *= 0.97; g.vz *= 0.97; }
    if (Math.hypot(g.vx, g.vy, g.vz) < 0.6) { g.vx = g.vy = g.vz = 0; g.rest = true; }
  }
  return false;
}
// the path a bomb will take (for the aiming arc): points until it comes to rest or the fuse runs out; first, where it
// first lands
export function nadePath(L, T, secs = 5.5) {
  const g = { ...L }, pts = [[g.x, g.y, g.z]]; let land = null;
  for (let i = 0; i < secs * HZ; i++) { const was = g.bounces || 0; if (nadeStep(g, T)) break; if (!land && (g.bounces || 0) > was) land = [g.x, g.y, g.z]; if (i % 2 === 0) pts.push([g.x, g.y, g.z]); }
  pts.push([g.x, g.y, g.z]); return { pts, land: land || [g.x, g.y, g.z], end: [g.x, g.y, g.z] };
}
const STEEL = { bayonet: [85, 25], club: [60, 18], knife: [65, 20] };
const steelDamage = (kind, rng) => { const [m, sd] = STEEL[kind] || STEEL.bayonet; return Math.max(15, m + sd * rng.gauss()); };
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
// the player's aim: a slow breathing sway (a figure of eight, radians) that the view shows and the shot follows, most
// standing, half crouched, next to nothing lying down, three times as much on the move; and the scatter of a shot
const STANCE_SWAY = [0.0015, 0.0008, 0.0002], STANCE_SPREAD = [1, 0.75, 0.5];
export function aimSway(s, tick) {
  const t = tick / HZ, moving = s.intent && (s.intent.f || s.intent.s), a = STANCE_SWAY[s.stance] * (moving ? 3 : 1) * (s.ads ? 1 : 1.6);
  return [a * (Math.sin(t * 0.9) + 0.45 * Math.sin(t * 2.3 + 1.1)), a * 0.75 * (Math.sin(t * 1.8 + 0.4) + 0.35 * Math.sin(t * 3.1))];
}
export function aimSpread(s) {
  const W = WEAPONS[s.weapon], moving = s.intent && (s.intent.f || s.intent.s);
  return (s.ads ? W.spread : W.hip) * STANCE_SPREAD[s.stance] + (moving ? 0.012 : 0);
}
const PICKUP_TICKS = 66;   // 1.1 s to stoop, swap rifles and come up again
const SPEED = { walk: 1.7, run: 4.6, crouch: 1.1, prone: 0.45, advance: 3.1 };   // advance: the AI jogs forward (stopping to fire)
const EYE = [1.62, 1.1, 0.35], HEIGHT = [1.78, 1.25, 0.45];
const START_TIME = 7 * 3600 + 27 * 60 + 30, MINE_TIME = 7 * 3600 + 28 * 60, ZERO = 7 * 3600 + 30 * 60;
// before zero hour the clock runs 5x fast: the mines go up ~6 s in and the whistles blow ~30 s in; after zero, real time
export const PRE_ZERO_RATE = 5, ZERO_TIME = ZERO, MINE_AT = MINE_TIME;

export class Sim {
  constructor(T, F, { seed = 1, playerSide = 'BRI', bri = 900, ger = 400, mgs = 16, strength = { BRI: 10000, GER: 2000 } } = {}) {
    this.nMG = mgs;
    this.T = T; this.F = F; this.seed = seed; this.rng = mulberry32(seed); this.tick = 0;
    this.map = T.map; this.events = []; this.soldiers = []; this.shells = []; this.grenades = []; this.gt = 0;
    this.flags = { mine: false, zero: false };
    this.rambo = false; this.god = false;
    this.objectives = this.map.objectives.map(o => ({ ...o, owner: 'GER', progress: 0 }));
    this.dugouts = this.objectives.map(o => this._dugoutFor(o));   // the way up from the deep dugouts at each strongpoint
    this.fwd = {};   // men each forward spawn may still send up this wave
    this.score = { BRI: { kills: 0, deaths: 0 }, GER: { kills: 0, deaths: 0 } };
    this.waveT = { BRI: 0, GER: 0 };
    this.drops = [];   // rifles lying where men fell
    this.guns = [];    // machine guns on their mounts
    this.trenchPts = { BRI: this._trenchPoints('BRI'), GER: this._trenchPoints('GER') };
    // the player first, then the AI, in a fixed order (Cimmerian §11: stable entity order)
    const ps = this.map.playerStart.pos, p0 = this._snapToTrench(ps[0], ps[1], playerSide, 30, true) || ps;   // on the fire-step, looking over the parapet
    this.player = this._spawn(playerSide, p0[0], p0[1], 'rifle', true);
    { const o = this.map.objectives[0].c; this.player.yaw = Math.atan2(-(o[0] - p0[0]), -(o[1] - p0[1])); }
    this._populate(bri, ger);
    // the men still to come: each side's whole strength (historically ~10,000 British in 12 battalions against ~2,000 of
    // Reserve Infantry Regiment 110 here) less those already in the line; every man sent in comes out of it
    this.reserve = {}; for (const side of ['BRI', 'GER']) this.reserve[side] = Math.max(0, strength[side] - this.soldiers.filter(o => o.side === side).length);
  }
  // a dugout entrance at a strongpoint: on level, open ground 12-60 m from its middle (not in a trench, the wire, a ruin
  // or a mine crater), its mouth facing the middle. Men sent up there climb its stairs out of the dark.
  _dugoutFor(o) {
    const T = this.T, [cx, cz] = o.c; let best = null;
    for (let r = 12; r <= 60 && !best; r += 4) for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8 + r * 0.37, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if ((this.map.mines || []).some(m => Math.hypot(x - m.c[0], z - m.c[1]) < m.craterR * 1.35)) continue;   // (not in a mine crater or on its lip)
      if (T.trenchAt(x, z, {}).d < 5 || this.F.wireAt(x, z) > 0 || this.F.wallAt(x, z, T.height(x, z) - 1, 2.5)) continue;
      let lo = 1e9, hi = -1e9; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const h = T.height(x + i * 1.2, z + j * 1.2); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (hi - lo > 0.6) continue;
      const sc = hi - lo + Math.abs(r - 18) * 0.01; if (!best || sc < best.sc) best = { sc, x, z };
    }
    if (!best) best = { x: cx + 15, z: cz };
    const yaw = Math.atan2(-(cx - best.x), -(cz - best.z));   // facing out of the mouth, towards the middle (forward = -sin, -cos)
    return { name: o.name, x: best.x, z: best.z, y: T.height(best.x, best.z), yaw, next: 0 };
  }
  // coming up the dugout stairs (steep, as they were): from 2.4 m back and 3.2 m down, up to the mouth, then a step out into the open; a second
  // man waits below until the first is clear
  _emerge(s) {
    const D = s.emergeAt, fx = -Math.sin(D.yaw), fz = -Math.cos(D.yaw);
    if (s.emergeWait > 0) { s.emergeWait--; s.x = D.x - fx * 2.4; s.z = D.z - fz * 2.4; s.y = D.y - 3.2; return; }
    s.emerge--; const u = 1 - s.emerge / EMERGE_TICKS;
    if (u < 0.75) { const k = u / 0.75; s.x = D.x - fx * 2.4 * (1 - k); s.z = D.z - fz * 2.4 * (1 - k); s.y = D.y - 3.2 * (1 - k) - 0.05; }
    else { const k = (u - 0.75) / 0.25; s.x = D.x + fx * 1.6 * k; s.z = D.z + fz * 1.6 * k; s.y = this.T.height(s.x, s.z); }
    s.yaw = D.yaw; s.vy = 0; s.onGround = true;
    if (s.emerge <= 0) { s.emergeAt = null; s.y = this.T.height(s.x, s.z); if (s.ai) s.ai.post = [s.x, s.z]; }
  }
  // ---------- machine guns ----------
  // a gun on the fire-step nearest (x, z): facing over the parapet, its bore high enough to clear it; the gunner behind
  // it (kneeling, or standing where the parapet is high), the loader at his right
  _makeGun(kind, side, x, z) {
    // of the fire-step points within 35 m, the one whose gun would see out best across its arc (the parapet low enough
    // there), the nearest of those
    const T = this.T, pts = this.trenchPts[side].filter(p => Math.hypot(p[0] - x, p[1] - z) < 35 && !(this.map.mines || []).some(m => Math.hypot(p[0] - m.c[0], p[1] - m.c[1]) < m.craterR * 1.25));   // (not where a mine's crater will be)
    let pick = null;
    for (const p of pts) {
      const c = this._gunSite(p, side, kind); if (!c) continue;
      let clear = 0; for (let k = -4; k <= 4; k++) { const yy = c.yaw0 + k * GUNS[kind].arc / 4, dx = -Math.sin(yy), dz = -Math.cos(yy); if (T.raycast(c.x + dx * 0.55, c.by, c.z + dz * 0.55, dx, 0, dz, 80) < 0) clear++; }
      const sc = clear * 100 - Math.hypot(p[0] - x, p[1] - z); if (!pick || sc > pick.sc) pick = { sc, c };
    }
    if (!pick) return null;
    const { cx, cz, fx, fz, yaw0, bore, stand, lift } = pick.c;
    const gun = { id: this.guns.length, kind, side, yaw0, arc: GUNS[kind].arc, x: cx + fx * 0.75, z: cz + fz * 0.75, by: bore, gy: T.height(cx + fx * 0.75, cz + fz * 0.75),
      crew: [cx, cz], lift, crewStance: stand ? 0 : 1, aimYaw: yaw0, aimPitch: 0, belt: BELT, belts: GUNS[kind].belts, change: 0, cool: 0, jam: 0, heat: 0,
      burst: 0, pause: 0, target: -1, retarget: 0, sweep: 0, spreadA: 0, trigger: false, gunner: -1, loader: -1, idle: 0, fired: 0 };
    this.guns.push(gun);
    const rx = -fz, rz = fx;   // his right (forward x up)
    const gn = this._spawn(side, cx, cz, 'mg'), ld = this._spawn(side, cx + rx * 0.95 - fx * 0.25, cz + rz * 0.95 - fz * 0.25, 'mg');
    this._crew(gun, gn, 'gunner'); this._crew(gun, ld, 'loader');
    return gun;
  }
  _gunSite(p, side, kind) {
    const T = this.T, cx = p[3], cz = p[4];
    let fx = p[3] - p[0], fz = p[4] - p[1], L = Math.hypot(fx, fz);
    if (L < 0.05) { const e = side === 'GER' ? -1 : 1; fx = e; fz = 0; L = 1; }   // (no step offset: face the enemy's side)
    fx /= L; fz /= L;
    const yaw0 = Math.atan2(-fx, -fz), g0 = T.height(cx, cz);
    // the gun sits on the parapet at the trench's edge (a gap in its sandbags), its bore 25 cm over the ground under it and
    // clear of the ground beyond; the gunner on the fire-step behind it, standing where the parapet is high. Not where
    // the parapet is too high for a man on the step to work the gun over it.
    // its parapet must face the enemy (the nearest of his trenches), not along the line or back over the parados
    { const other = side === 'GER' ? 'BRI' : 'GER'; let e = null, ed = 1e9; for (const q of this.trenchPts[other]) { const d = Math.abs(q[0] - cx) + Math.abs(q[1] - cz); if (d < ed) { ed = d; e = q; } }
      if (e) { const ex = e[0] - cx, ez = e[1] - cz, el = Math.hypot(ex, ez) || 1; if ((ex * fx + ez * fz) / el < 0.5) return null; } }
    let hn = g0, hf = g0; for (let d = 0.3; d <= 3; d += 0.15) { const h = T.height(cx + fx * d, cz + fz * d); if (d <= 1.3) hn = Math.max(hn, h); else hf = Math.max(hf, h); }
    const bore = Math.max(g0 + 0.62, hn + 0.25, hf + 0.12);
    if (bore - g0 > 1.68) return null;
    // (a high parapet: the gunner stands on a crate, so his eye is over the sights)
    return { cx, cz, fx, fz, yaw0, bore, stand: bore - g0 > 1.08, x: cx + fx * 0.75, z: cz + fz * 0.75, by: bore, lift: Math.max(0, Math.min(0.35, bore - g0 - 1.38)) };
  }
  _crewSpot(gun, role) { const fx = -Math.sin(gun.yaw0), fz = -Math.cos(gun.yaw0), [cx, cz] = gun.crew; return role === 'gunner' ? [cx, cz] : [cx - fz * 0.95 - fx * 0.25, cz + fx * 0.95 - fz * 0.25]; }
  _crew(gun, s, role) {
    gun[role] = s.id; s.gun = gun.id; s.gunRole = role; s.role = 'mg';
    const [x, z] = this._crewSpot(gun, role); s.x = x; s.z = z; s.y = this.T.height(x, z);
    s.yaw = gun.yaw0; s.stance = gun.crewStance;
    if (s.ai) { s.ai.post = [x, z]; s.ai.mode = s.ai.mode === 'shelter' ? 'shelter' : 'mg'; }
  }
  _manned(gun) { const g = gun.gunner >= 0 ? this.soldiers[gun.gunner] : null; if (!g || !g.alive || g.gun !== gun.id) return null; const [x, z] = gun.crew; return Math.hypot(g.x - x, g.z - z) < 1.3 ? g : null; }
  // where a gun's rounds leave it, and their direction for an aim
  gunMuzzle(gun, yaw = gun.aimYaw, pitch = gun.aimPitch) {
    const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
    return { ox: gun.x + dx * 0.55, oy: gun.by + dy * 0.55, oz: gun.z + dz * 0.55, dx, dy, dz };
  }
  // the player at a gun: E beside one (unmanned, or his own side's: its gunner moves over to load); a gun of the other
  // side is swung round to face where he looks
  nearGun(p) {
    let best = -1, bd = 1.8;
    for (const g of this.guns) { const [x, z] = g.crew, d = Math.min(Math.hypot(p.x - x, p.z - z), Math.hypot(p.x - g.x, p.z - g.z) + 0.3); if (d < bd && Math.abs(this.T.height(x, z) - p.y) < 1.2) { const m = this._manned(g); if (!m || (m.side === p.side && !m.isPlayer)) { bd = d; best = g.id; } } }
    return best;
  }
  _mount(p, gun) {
    const was = this._manned(gun);
    if (was && !was.isPlayer) { was.gun = -1; was.gunRole = null; if (gun.loader < 0 || !this.soldiers[gun.loader].alive) this._crew(gun, was, 'loader'); else if (was.ai) { was.ai.mode = 'hold'; was.ai.post = [was.x, was.z]; } }
    if (gun.side !== p.side) { gun.side = p.side; gun.yaw0 = p.yaw; gun.loader = -1; }   // taken: turned round to face the way he is looking
    else if (Math.abs(wrapAngle(p.yaw - gun.yaw0)) > gun.arc) p.yaw = gun.yaw0;
    this._crew(gun, p, 'gunner'); gun.aimYaw = p.yaw; gun.aimPitch = 0; p.pitch = 0; p.intent = null; p.ads = false;
    this.events.push({ t: 'mount', id: p.id, gun: gun.id });
  }
  _dismount(p) { const gun = this.guns[p.gun]; if (gun && gun.gunner === p.id) gun.gunner = -1; p.gun = -1; p.gunRole = null; p.role = 'rifle'; gun.trigger = false; this.events.push({ t: 'dismount', id: p.id, gun: gun ? gun.id : -1 }); }
  // the guns, each tick: belts, stoppages, heat; the AI gunner's aim and bursts; the trigger
  _guns() {
    for (const gun of this.guns) {
      gun.heat = Math.max(0, gun.heat - DT * 0.012);
      if (gun.cool > 0) gun.cool -= DT;
      const g = this._manned(gun), ld = gun.loader >= 0 ? this.soldiers[gun.loader] : null, loader = ld && ld.alive && ld.gun === gun.id ? ld : null;
      if (gun.change > 0) { gun.change -= DT; if (gun.change <= 0) { gun.change = 0; gun.belt = BELT; this.events.push({ t: 'belt_done', gun: gun.id }); } }
      if (gun.jam > 0) { gun.jam -= DT * (loader ? 1.5 : 1); if (gun.jam <= 0) gun.jam = 0; }
      if (!g) {
        gun.trigger = false; gun.idle++;
        // the gunner down: the loader moves over to the gun (two seconds)
        if (loader && !loader.isPlayer && gun.idle > 120 && !(loader.ai && loader.ai.closeIn)) { gun.loader = -1; this._crew(gun, loader, 'gunner'); gun.idle = 0; }
        continue;
      }
      gun.idle = 0;
      if (!g.isPlayer) this._gunAI(gun, g);
      if (gun.trigger) this._gunFire(gun, g, loader);
    }
  }
  // what the AI gunner is firing at: the best target in his arc and range that he can see from the gun (men in the open
  // in numbers first, then the nearest); he traverses across their line, firing bursts of 10-30, pausing between
  _gunAI(gun, g) {
    const ai = g.ai; gun.trigger = false;
    if (!ai || ai.mode === 'shelter' || g.strike > 0 || ai.closeIn) return;
    const K = GUNS[gun.kind];
    if (--gun.retarget <= 0) {
      gun.retarget = 25 + g.rng.int(15);
      const gx = Math.floor(gun.x / 100), gz = Math.floor(gun.z / 100), R = Math.ceil(K.range / 100), cand = [];
      for (let cz = gz - R; cz <= gz + R; cz++) for (let cx = gx - R; cx <= gx + R; cx++) { const l = this.grid.get((cx << 8) | cz); if (!l) continue;
        for (const o of l) { if (o.side === gun.side || !o.alive || o.emerge > 0) continue; const dx = o.x - gun.x, dz = o.z - gun.z, d = Math.hypot(dx, dz); if (d > K.range || d < 2) continue;
          const b = Math.atan2(-dx, -dz); if (Math.abs(wrapAngle(b - gun.yaw0)) > gun.arc) continue; cand.push([d, o, b]); } }
      cand.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
      let best = null, bs = -1e9;
      let looks = 0;
      for (let i = 0; i < Math.min(10, cand.length) && looks < 4; i++) {
        const [d, o, b] = cand[i]; let n = 0; for (let j = 0; j < Math.min(40, cand.length); j++) if (Math.abs(cand[j][0] - d) < 25 && Math.abs(wrapAngle(cand[j][2] - b)) * d < 25) n++;
        const sc = n * 40 - d - (o.stance === 2 ? 60 : 0) + (o.isPlayer ? 10 : 0);
        if (sc <= bs) continue;
        looks++;
        const M = this.gunMuzzle(gun, b, Math.atan2(o.y + 1.0 - gun.by, d)), ty = o.y + HEIGHT[o.stance] * 0.6, ddx = o.x - M.ox, ddy = ty - M.oy, ddz = o.z - M.oz, LL = Math.hypot(ddx, ddy, ddz);
        if (this.T.raycast(M.ox, M.oy, M.oz, ddx / LL, ddy / LL, ddz / LL, LL - 0.6) >= 0) continue;
        best = [o, b, d, n]; bs = sc;
      }
      if (best) {
        const [o, b, d, n] = best; if (gun.target !== o.id) { gun.target = o.id; gun.burst = 0; }
        gun.spreadA = Math.min(0.12, (6 + n * 2.5) / Math.max(d, 20));   // the width of the line he sweeps (radians)
      } else gun.target = -1;
    }
    const o = gun.target >= 0 ? this.soldiers[gun.target] : null;
    if (!o || !o.alive) { gun.target = -1; return; }
    const dx = o.x - gun.x, dz = o.z - gun.z, d = Math.hypot(dx, dz);
    gun.sweep += DT * (0.7 + (g.id % 5) * 0.08);
    const wantY = Math.atan2(-dx, -dz) + Math.sin(gun.sweep) * gun.spreadA, wantP = Math.atan2(o.y + (o.stance === 2 ? 0.2 : 0.85) - gun.by, d);
    const ey = wrapAngle(wantY - gun.aimYaw), ep = wantP - gun.aimPitch;
    gun.aimYaw += Math.max(-0.6 * DT, Math.min(0.6 * DT, ey)); gun.aimPitch += Math.max(-0.3 * DT, Math.min(0.3 * DT, ep));
    { const off = wrapAngle(gun.aimYaw - gun.yaw0); if (Math.abs(off) > gun.arc) gun.aimYaw = gun.yaw0 + Math.sign(off) * gun.arc; }
    g.yaw = gun.aimYaw; g.pitch = gun.aimPitch;
    if (gun.pause > 0) { gun.pause -= DT; return; }
    if (Math.abs(ey) > gun.spreadA + 0.05) return;   // still traversing onto them
    if (gun.burst <= 0) { gun.burst = 10 + g.rng.int(21); }
    gun.trigger = true;
  }
  _gunFire(gun, g, loader) {
    const K = GUNS[gun.kind];
    if (gun.cool > 0 || gun.change > 0 || gun.jam > 0) return false;
    if (gun.belt <= 0) { if (gun.belts > 0 || !g.isPlayer) { gun.belts = Math.max(0, gun.belts - 1); gun.change = loader ? 4.5 : 8; this.events.push({ t: 'belt', gun: gun.id, id: g.id }); } gun.trigger = false; return false; }
    gun.belt--; gun.cool = K.cycle; gun.fired++;
    gun.heat = Math.min(1, gun.heat + 1 / 420);
    if (g.rng() < 1 / 400) { gun.jam = 2.5 + g.rng() * 2; gun.trigger = false; this.events.push({ t: 'gunjam', gun: gun.id, id: g.id }); }
    if (!g.isPlayer && --gun.burst <= 0) { gun.pause = 0.25 + g.rng() * 0.8; gun.trigger = false; }
    // the round: the gun's aim, a little dispersion (more as the barrel heats), the shake of the mount
    const r = g.rng, disp = K.disp * (1 + gun.heat * 0.6);
    const M = this.gunMuzzle(gun, gun.aimYaw + r.gauss() * disp, gun.aimPitch + r.gauss() * disp * 0.7), { ox, oy, oz, dx, dy, dz } = M;
    let tHit = this.T.raycast(ox, oy, oz, dx, dy, dz, K.range); if (tHit < 0) tHit = K.range;
    let victim = null, zone = 'body';
    const near = [];
    for (const o of this.soldiers) {
      if (!o.alive || o.gun === gun.id || o.emerge > 0) continue;
      const t = rayCapsule(ox, oy, oz, dx, dy, dz, o, tHit);
      if (t >= 0) { tHit = t; victim = o; const hy = oy + dy * t - o.y; zone = hy > HEIGHT[o.stance] * 0.84 ? 'head' : hy < HEIGHT[o.stance] * 0.45 ? 'legs' : 'body'; continue; }
      if (o.side === gun.side) continue;
      const wx = o.x - ox, wz = o.z - oz, t0 = wx * dx + wz * dz; if (t0 < 0 || t0 > tHit + 3) continue;
      if (Math.hypot(wx - dx * t0, (o.y + 1) - (oy + dy * t0), wz - dz * t0) < 3) near.push(o);
    }
    for (const o of near) if (o !== victim) o.pinned = this.tick + 70 + o.rng.int(110);   // rounds cracking past: heads down
    const hx = ox + dx * tHit, hy = oy + dy * tHit, hz = oz + dz * tHit;
    this.events.push({ t: 'shot', id: g.id, w: gun.kind, gun: gun.id, o: [ox, oy, oz], h: [hx, hy, hz], victim: victim ? victim.id : -1 });
    if (victim) this._damage(victim, bulletDamage(WEAPONS[gun.kind], zone, r), g, { dir: [dx, dy, dz], zone, point: [hx, hy, hz], kind: 'bullet', mg: true });
    return true;
  }
  // a man who comes on a gun with no one on it takes it: an enemy gun is swung round to face the way his side is
  // attacking (or defending), his own is simply manned
  _grabGun(s) {
    for (const gun of this.guns) {
      const [x, z] = gun.crew; if (Math.abs(s.x - x) > 6 || Math.abs(s.z - z) > 6 || Math.hypot(s.x - x, s.z - z) > 6 || this._manned(gun)) continue;
      const ld = gun.loader >= 0 ? this.soldiers[gun.loader] : null; if (gun.side === s.side && ld && ld.alive && ld.gun === gun.id) continue;   // (his own loader is moving over)
      if (s.rng() > 0.35 || Math.abs(this.T.height(x, z) - s.y) > 1.5) return false;
      if (gun.side !== s.side) {
        const g = this.target(s.side, x, z); gun.side = s.side; gun.loader = -1;
        if (g) gun.yaw0 = Math.atan2(-(g.c[0] - x), -(g.c[1] - z)); else gun.yaw0 = wrapAngle(gun.yaw0 + Math.PI);
        gun.aimYaw = gun.yaw0; this.events.push({ t: 'gun_taken', gun: gun.id, side: s.side, id: s.id });
      }
      this._crew(gun, s, 'gunner'); s.ai.mode = 'mg'; s.intent = null;
      return true;
    }
    return false;
  }
  // between waves: a gun with no crew and no enemy near it gets a fresh crew (up out of a dugout, out of the player's sight)
  _crewGuns(side) {
    for (const gun of this.guns) {
      if (gun.side !== side || this._manned(gun) || this.reserve[side] <= 0) continue;
      const ld = gun.loader >= 0 ? this.soldiers[gun.loader] : null; if (ld && ld.alive && ld.gun === gun.id) continue;
      const p = this.player, [x, z] = gun.crew;
      if (Math.hypot(p.x - x, p.z - z) < 90 || this._enemyNear({ x, z, side }, 40)) continue;
      const dead = this.soldiers.filter(o => !o.alive && !o.isPlayer && o.side === side && this.tick - o.deadAt > HZ * 8).slice(0, 2);
      if (dead.length < 2) continue;
      for (const [o, role] of [[dead[0], 'gunner'], [dead[1], 'loader']]) {
        this.reserve[side]--; Object.assign(o, { alive: true, hp: 100, climb: 0, climbTo: null, vy: 0, onGround: true, stamina: 1, pickup: 0, mag: WEAPONS[o.weapon].mag, reserve: WEAPONS[o.weapon].reserve, reloading: 0, cool: 0, grenades: 3, throw: 0, lastHit: null, emerge: 0, emergeAt: null, jam: 0, strike: 0, pinned: 0 });
        if (o.ai) Object.assign(o.ai, { mode: 'mg', target: -1, goal: null, closeIn: 0, fleeUntil: 0, think: 20 });
        this._crew(gun, o, role); this.events.push({ t: 'respawn', id: o.id, p: [o.x, o.y, o.z], gun: gun.id });
      }
      gun.belt = BELT; gun.jam = 0; gun.change = 0;
    }
  }
  // the tally: fallen, still standing in the field, and the reserve still to come
  tally(side) { let field = 0; for (const o of this.soldiers) if (o.side === side && o.alive) field++; return { fallen: this.score[side].deaths, field, reserve: this.reserve[side], left: field + this.reserve[side] }; }
  get time() { return START_TIME + this.gt; }
  clock() { const t = Math.floor(this.time); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }

  // ---------- setup ----------
  _trenchPoints(side) {   // fire-trench floor points of one side, used for spawning and posting men
    const out = [];
    // [floor x, floor z, segment, fire-step x, fire-step z]
    this.T.segs.forEach((s, i) => { if (!s.gone && s.side === side && (s.kind === 0 || (side === 'GER' && s.kind === 2)) && Math.hypot(s.bx - s.ax, s.bz - s.az) > 4) { const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2, o = s.kind === 0 ? s.hw - 0.33 : 0; out.push([mx, mz, i, mx + s.nx * o, mz + s.nz * o]); } });
    return out;
  }
  // a spot along a bay (t metres from its middle, kept a metre clear of its ends): [floor x, z, fire-step x, z]
  _alongBay(p, t) {
    const s = this.T.segs[p[2]], L = s.len, ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L, tt = Math.max(-L / 2 + 1, Math.min(L / 2 - 1, t));
    return [p[0] + ux * tt, p[1] + uz * tt, p[3] + ux * tt, p[4] + uz * tt];
  }
  // a cluster of n men along a bay, at least 1.2 m apart
  _clusterIn(p, n, r) {
    const L = this.T.segs[p[2]].len, half = Math.max(0.5, L / 2 - 1), out = [];
    for (let tries = 0; out.length < n && tries < n * 12; tries++) { const t = (r() * 2 - 1) * half; if (out.every(q => Math.abs(q - t) >= 1.2)) out.push(t); }
    return out.map(t => this._alongBay(p, t));
  }
  _snapToTrench(x, z, side, maxD = 60, step = false) {
    let best = null, bd = maxD;
    for (const p of this.trenchPts[side]) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = p; } }
    return best ? (step ? [best[3], best[4]] : [best[0], best[1]]) : null;
  }
  _spawn(side, x, z, role = 'rifle', isPlayer = false) {
    const id = this.soldiers.length, w = side === 'BRI' ? 'smle' : 'g98';
    const s = { id, side, role, isPlayer, x, z, y: this.T.height(x, z), vy: 0, yaw: side === 'BRI' ? -Math.PI / 2 : Math.PI / 2, pitch: 0,
      stance: 0, hp: 100, alive: true, deadAt: 0, onGround: true, climb: 0, climbTo: null, stamina: 1, kills: 0, deaths: 0,
      weapon: w, mag: WEAPONS[w].mag, reserve: WEAPONS[w].reserve, cool: 0, reloading: 0, ads: false,
      ai: isPlayer ? null : { mode: 'hold', think: this.rng.int(30), target: -1, post: [x, z], goal: null, wave: 0, fireUntil: 0, seen: 0, skill: this.rng.range(0.6, 1.2) },
      lastHit: null, rng: mulberry32((this.seed * 7919 + id * 104729) >>> 0) };
    s.yaw = side === 'BRI' ? -Math.PI / 2 * 1 : Math.PI / 2;   // face the enemy: BRI east, GER west
    // his steel for close quarters: the bayonet, or (some of the Germans) a spiked trench club or a knife
    { const r = s.rng(); s.steel = side === 'BRI' || isPlayer ? 'bayonet' : r < 0.2 ? 'club' : r < 0.3 ? 'knife' : 'bayonet'; }
    s.strike = 0; s.jam = 0; s.grenades = 3; s.throw = 0; s.gun = -1; s.pinned = 0;
    this.soldiers.push(s);
    return s;
  }
  _populate(nb, ng) {
    const r = this.rng, near = (side, cx, cz, R) => this.trenchPts[side].filter(p => Math.hypot(p[0] - cx, p[1] - cz) < R);
    // the 34th Division's frontage, astride La Boisselle from Mash Valley to Sausage Valley, around the player;
    // the British in their front and support lines, the Germans in the Schwabenhöhe and La Boisselle salient opposite
    const ps = this.player, [lx, lz] = this.map.objectives[0].c;
    // (historically ~10,000 British in 12 battalions against ~2,000 of Reserve Infantry Regiment 110 here)
    const bri = near('BRI', ps.x, ps.z, 1100), ger = near('GER', lx, lz - 120, 1000);
    // each man his own place on a fire-trench floor (a shuffled draw, no two on one spot)
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    // weighted toward the player's stretch of the line (density falling off over ~300 m), as the battalions went over
    // in waves of men a few paces apart; each point used once while points last
    const weighted = (pts, cx, cz, n, fall) => { const pool = pts.slice(), out = [];
      while (out.length < n && pool.length) { let tot = 0; const w = pool.map(p => { const v = Math.exp(-Math.hypot(p[0] - cx, p[1] - cz) / fall) + 0.02; tot += v; return v; });
        let x = r() * tot, i = 0; while (i < pool.length - 1 && (x -= w[i]) > 0) i++; out.push(pool[i]); pool.splice(i, 1);
        if (out.length % 64 === 0 && pool.length > 4000) pool.splice(0, 0); }
      while (out.length < n) out.push(pts[out.length % pts.length]); return out; };
    const briPts = weighted(bri, ps.x, ps.z, nb, 300), gerPts = shuffle(weighted(ger, lx, lz - 60, Math.max(0, ng), 320));
    for (let i = 0; i < nb; i++) { const p = briPts[i % briPts.length]; const s = this._spawn('BRI', p[0], p[1]); s.ai.wave = i % 4; s.stance = 1; }
    // machine guns: the known posts, then more spread along the German front system opposite the attack
    const mgAt = this.map.mgs.slice(), front = ger.filter(p => this.T.segs[p[2]].kind === 0);
    for (let k = 0; mgAt.length < this.nMG && front.length && k < 200; k++) { const p = front[Math.floor((k * 0.618034 % 1) * front.length)]; if (mgAt.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 70)) mgAt.push([p[0], p[1]]); }
    // (a post with no workable site is passed over for the next point along the front)
    { let made = 0; for (const m of mgAt) { if (made >= this.nMG) break; if (this.guns.some(g => Math.hypot(g.x - m[0], g.z - m[1]) < 40)) continue; if (this._makeGun('mg08', 'GER', m[0], m[1])) made++; }
      for (let k = 0; made < this.nMG && front.length && k < 400; k++) { const p = front[Math.floor((k * 0.381966 % 1) * front.length)]; if (this.guns.some(g => Math.hypot(g.x - p[0], g.z - p[1]) < 70)) continue; if (this._makeGun('mg08', 'GER', p[0], p[1])) made++; } }
    // and three Vickers in the British front line opposite the attack, to fire on the German parapet
    { const bf = this.trenchPts.BRI.filter(p => this.T.segs[p[2]].kind === 0 && Math.hypot(p[0] - ps.x, p[1] - ps.z) < 700), at = [];
      for (let k = 0; at.length < 3 && k < bf.length; k++) { const q = bf[Math.floor((k * 0.618034 % 1) * bf.length)]; if (at.every(a => Math.hypot(a[0] - q[0], a[1] - q[1]) > 150) && Math.hypot(q[0] - ps.x, q[1] - ps.z) > 25) at.push(q); }
      for (const q of at) this._makeGun('vickers', 'BRI', q[0], q[1]); }
    // the garrison in clusters along the line: a quarter of the bays empty, others with one to five men, spread along the step
    { const SIZES = [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5];
      let i = this.soldiers.filter(s => s.side === 'GER').length;
      for (let k = 0; i < ng && gerPts.length; k++) {
        const bay = gerPts[k % gerPts.length], n = Math.min(ng - i, k < gerPts.length ? SIZES[r.int(SIZES.length)] : 1 + r.int(3));
        for (const q of this._clusterIn(bay, n, r)) { const s = this._spawn('GER', q[0], q[1]); s.stance = 1; s.ai.mode = 'shelter'; s.ai.post = [q[2], q[3]]; i++; }
      } }
    for (const s of this.soldiers) if (s.role === 'mg') s.ai.mode = 'shelter';
  }

  // ---------- the tick ----------
  // a 100 m grid of the living, rebuilt each tick: target search looks only in nearby cells
  _buildGrid() {
    // a 2 m hash of the living, for men bumping into each other
    const h = this.bump || (this.bump = new Map()); h.clear();
    for (const s of this.soldiers) { if (!s.alive) continue; const k = (Math.floor(s.x / 2) << 12) | Math.floor(s.z / 2); let l = h.get(k); if (!l) h.set(k, l = []); l.push(s); }
    const g = this.grid || (this.grid = new Map()); g.clear();
    for (const s of this.soldiers) { if (!s.alive) continue; const k = (Math.floor(s.x / 100) << 8) | Math.floor(s.z / 100); let l = g.get(k); if (!l) g.set(k, l = []); l.push(s); }
  }
  step(input = {}) {
    const p = this.player;
    this._buildGrid();
    this._player(p, input);
    for (const s of this.soldiers) if (!s.isPlayer && s.alive) this._think(s);
    this._guns();
    for (const s of this.soldiers) if (s.alive) this._move(s);
    this._director();
    this._objectives();
    this._respawns(input);
    this.tick++;
    this.gt += DT * (this.time < ZERO ? PRE_ZERO_RATE : 1);
  }

  // ---------- player input -> intent ----------
  _player(p, a) {
    // K: give up this man and go straight back to the respawn choice (counts as a death; no 3 s wait)
    if (a.switchMan && p.alive) this._switchMan(p);
    if (a.respawnNow && p.alive) {
      p.alive = false; p.hp = 0; p.deadAt = this.tick; p.deaths++; this.score[p.side].deaths++; p.gaveUp = true; p.intent = null;
      this.events.push({ t: 'death', id: p.id, by: -1, kind: 'gaveup', dir: [0, -1, 0], zone: 'chest', point: [p.x, p.y + 1, p.z] }); this._drop(p); p.pickup = 0; return;
    }
    if (!p.alive) { p.intent = null; if (a.respawn && this.tick - p.deadAt > HZ * (p.gaveUp ? 0.5 : 3)) { if (a.respawnInto !== undefined) this._takeOver(p, a.respawnInto); else this._respawn(p, a.respawnAt); } return; }
    if (a.yaw !== undefined) p.yaw = a.yaw; if (a.pitch !== undefined) p.pitch = Math.max(-1.45, Math.min(1.45, a.pitch));
    if (a.crouch) p.stance = p.stance === 1 ? 0 : 1; if (a.prone) p.stance = p.stance === 2 ? 0 : 2;
    p.ads = !!a.ads;
    if (p.emerge > 0) { p.intent = null; this._weaponTick(p); return; }   // coming up out of the dugout: he can look about, no more
    if (p.gun >= 0) {   // on a machine gun: traverse it (within its arc), the trigger, R a fresh belt, E to leave it
      const gun = this.guns[p.gun];
      if (!gun || gun.gunner !== p.id || a.pickup) { if (gun) this._dismount(p); else p.gun = -1; this._weaponTick(p); return; }
      const off = wrapAngle(p.yaw - gun.yaw0); if (Math.abs(off) > gun.arc) p.yaw = gun.yaw0 + Math.sign(off) * gun.arc;
      p.pitch = Math.max(-0.3, Math.min(0.35, p.pitch));
      gun.aimYaw = p.yaw; gun.aimPitch = p.pitch; gun.trigger = !!a.fire;
      if (a.reload && gun.belt < BELT && gun.change <= 0 && gun.belts > 0) { const ld = gun.loader >= 0 && this.soldiers[gun.loader].alive; gun.belts--; gun.change = ld ? 4.5 : 8; this.events.push({ t: 'belt', gun: gun.id, id: p.id }); }
      const [x, z] = gun.crew; p.x = x; p.z = z; p.stance = gun.crewStance; p.intent = null;
      this._weaponTick(p); return;
    }
    if (a.pickup && !(p.climb > 0)) { const gi = this.nearGun(p); if (gi >= 0) { this._mount(p, this.guns[gi]); return; } }
    // E by a fallen man's rifle: stoop, put yours down, take his (with what he had left in it and in his pouches)
    if (p.pickup > 0) {
      p.pickup--; p.intent = null; p.ads = false;
      if (p.pickup === PICKUP_TICKS >> 1) this._swapRifle(p, this.drops[p.pickupAt]);
      this._weaponTick(p); return;
    }
    if (a.pickup && !(p.climb > 0) && !(p.reloading > 0)) { const i = this.nearDrop(p), d = this.drops[i]; if (i >= 0 && !(d.weapon === p.weapon && (d.mag + d.reserve <= 0 || p.reserve >= WEAPONS[p.weapon].reserve * 2))) { p.pickup = PICKUP_TICKS; p.pickupTotal = PICKUP_TICKS; p.pickupAt = i; p.intent = null; this.events.push({ t: 'stoop', id: p.id, weapon: this.drops[i].weapon }); return; } }
    p.intent = { f: a.forward || 0, s: a.side || 0, run: !!a.run && p.stance === 0, jump: !!a.jump, vault: !!a.vault };
    if (a.reload) { if (p.jam > 0) { p.jam = 0; p.reloading = 1.2; p.reloadMore = false; this.events.push({ t: 'clear', id: p.id }); } else this._startReload(p); }
    if (a.melee) this._startStrike(p);
    if (a.fire && !(p.strike > 0) && !(p.throw > 0)) this._fire(p, p.yaw, p.pitch);
    if (a.grenade) this._startThrow(p, typeof a.grenade === 'number' ? a.grenade : 0.75);
    this._weaponTick(p);
  }

  // ---------- AI ----------
  _think(s) {
    this._weaponTick(s);
    const ai = s.ai, t = this.time;
    if (s.emerge > 0) { s.intent = null; return; }   // still coming up the dugout stairs
    if (s.throw > 0) { s.intent = null; return; }   // mid-throw
    if (--ai.think > 0) { this._aimAndFire(s); return; }
    ai.think = (Math.abs(s.x - this.player.x) + Math.abs(s.z - this.player.z) > 350 ? 45 : 20) + s.rng.int(20);   // far from the player: thinks half as often
    // before the barrage lifts, the Germans shelter in their deep dugouts (they come up when it lifts: the race for the parapet)
    if (ai.mode === 'shelter') { s.stance = 1; s.intent = null; if (t >= ZERO - 4 + s.rng.range(0, 25)) ai.mode = s.role === 'mg' ? 'mg' : 'hold'; return; }
    // British: wait in the trench for zero hour and their wave, then go over the top and walk forward
    if (s.side === 'BRI' && ai.mode === 'hold' && !ai.goal) {
      if (t >= ZERO + ai.wave * 25 + s.rng.range(0, 6)) { ai.mode = 'advance'; ai.goal = this._goalFor(s); s.stance = 0; }
      else { s.intent = null; s.stance = 1; return; }
    }
    // look for an enemy: nearest visible within range
    const W = WEAPONS[s.weapon], range = engageRange(s);
    let best = -1, bd = range;
    const cand = [], gx = Math.floor(s.x / 100), gz = Math.floor(s.z / 100), gr = Math.ceil(range / 100);
    for (let cz = gz - gr; cz <= gz + gr; cz++) for (let cx = gx - gr; cx <= gx + gr; cx++) {
      const l = this.grid.get((cx << 8) | cz); if (!l) continue;
      for (const o of l) { if (o.side === s.side) continue; const d = Math.abs(o.x - s.x) + Math.abs(o.z - s.z); if (d < range * 1.3) cand.push([d, o]); }
    }
    cand.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
    for (let i = 0; i < Math.min(4, cand.length); i++) {   // line-of-sight checks are the expensive part: nearest few only
      const o = cand[i][1], d = Math.hypot(o.x - s.x, o.z - s.z); if (d > range) continue;
      if (this._canSee(s, o, d)) { best = o.id; bd = d; break; }
    }
    // a new enemy close by catches most men by surprise: one in ten is ready; the rest take half a second or more to
    // turn and face him (no shot, no strike till then)
    if (best >= 0 && best !== ai.target && bd < 20) ai.reactUntil = this.tick + (s.rng() < 0.1 ? 0 : 30 + s.rng.int(25));
    ai.target = best;
    // close quarters: an enemy within 4 m (or out of rounds with one within 25 m): most men go at him with the steel; a
    // defender with an enemy jumping into his trench beside him may run for it
    { const near = this._nearestFoe(s, s.mag + s.reserve === 0 ? 25 : 4);
      if (near && !ai.closeIn && !(this.tick < (ai.fleeUntil || 0))) {
        const inMine = s.side === 'GER' && this.T.inTrench(near.x, near.z), r = s.rng();
        if (inMine && ai.mode !== 'advance' && r < 0.25 && Math.hypot(near.x - s.x, near.z - s.z) < 6) { ai.fleeUntil = this.tick + 150 + s.rng.int(120); ai.fleeFrom = [near.x, near.z]; }
        else if (r < 0.75 || s.mag + s.reserve === 0) ai.closeIn = near.id + 1;   // (id + 1: the player is soldier 0)
      }
      if (ai.closeIn && (!near || !this.soldiers[ai.closeIn - 1].alive)) ai.closeIn = 0; }
    if (this.tick < (ai.fleeUntil || 0)) {   // running for it: away from the man who came in, along whatever way is open
      const fx = s.x - ai.fleeFrom[0], fz = s.z - ai.fleeFrom[1];
      s.stance = 0; s.intent = { f: 1, s: 0, run: true, jump: false, yaw: Math.atan2(-fx, -fz) + s.rng.range(-0.3, 0.3) }; return;
    }
    if (ai.closeIn) {   // going in with the steel
      const o = this.soldiers[ai.closeIn - 1], dx = o.x - s.x, dz = o.z - s.z;
      s.stance = 0; s.intent = Math.hypot(dx, dz) > REACH * 0.8 ? { f: 1, s: 0, run: true, jump: true, yaw: Math.atan2(-dx, -dz) } : null; return;
    }
    if (s.gun >= 0) {   // a gun crew: at the gun (the gunner's aim and bursts are the gun's; see _guns)
      const gun = this.guns[s.gun], [x, z] = this._crewSpot(gun, s.gunRole), d = Math.hypot(x - s.x, z - s.z);
      s.stance = gun.crewStance; if (s.gunRole === 'loader') s.yaw = gun.aimYaw;
      s.intent = d > 0.5 ? { f: 1, s: 0, run: false, jump: false, yaw: Math.atan2(-(x - s.x), -(z - s.z)) } : null;
      return;
    }
    if (ai.mode !== 'shelter' && this._grabGun(s)) return;
    if (ai.mode !== 'shelter' && this._considerThrow(s, cand, best)) return;
    if (best >= 0) { ai.seen = this.tick; if (s.side === 'BRI' && ai.mode === 'advance' && bd > 40 && s.rng() < 0.45) { ai.fireUntil = this.tick + 60 + s.rng.int(120); } }
    if (s.mag === 0 && !s.reloading) this._startReload(s);
    // movement intent
    if (ai.mode === 'advance' && ai.goal) {
      const dx = ai.goal[0] - s.x, dz = ai.goal[1] - s.z, d = Math.hypot(dx, dz);
      if (d < 6) { ai.goal = this._goalFor(s, true); }
      const firing = this.tick < ai.fireUntil;
      if (this.tick < s.pinned) {   // machine-gun fire cracking past: down flat, crawling on now and then; then up and a rush forward
        s.stance = 2; ai.rushUntil = s.pinned + 150 + s.rng.int(120);
        s.intent = s.rng() < 0.45 ? { f: 1, s: 0, run: false, jump: false, yaw: this._wireDetour(s, Math.atan2(-dx, -dz)) } : null; return;
      }
      s.stance = firing ? 1 : 0;
      s.intent = firing ? null : { f: 1, s: 0, run: (best >= 0 && bd < 120) || this.tick < (ai.rushUntil || 0), jump: true, yaw: this._wireDetour(s, Math.atan2(-dx, -dz)) + s.rng.range(-0.15, 0.15) };
    } else if (ai.mode === 'hold' || ai.mode === 'mg') {
      // German defenders man the fire-step: stand to fire, duck to reload
      s.stance = s.reloading || this.tick < s.pinned ? 1 : 0;
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
  _eye(s) { return s.y + EYE[s.stance] + (s.gun >= 0 && s.gunRole === 'gunner' ? this.guns[s.gun].lift : 0); }   // (a gunner on his crate)
  _canSee(s, o, d) {
    const ox = s.x, oy = this._eye(s) + 0.12, oz = s.z, tx = o.x, ty = o.y + HEIGHT[o.stance] * 0.85, tz = o.z;   // +0.12: leaning into the parapet
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, L = Math.hypot(dx, dy, dz);
    // a man in the open is easy to see; one in a trench or prone in long grass far less so
    if (o.stance === 2 && d > 120) return false;
    return this.T.raycast(ox, oy, oz, dx / L, dy / L, dz / L, L - 0.5) < 0;
  }
  _aimAndFire(s) {
    const ai = s.ai; if (ai.mode === 'shelter') return;
    if (s.strike > 0 || s.throw > 0) return;   // mid-strike or mid-throw
    if (s.gun >= 0 && !ai.closeIn) return;   // (a gun crew: the gun does the firing)
    if (this.tick < s.pinned && s.rng() < 0.7) return;   // heads down under machine-gun fire
    // within reach of an enemy and choosing the steel: strike (any enemy, not only his target: a man jumping in on him)
    const startled = this.tick < (ai.reactUntil || 0);
    if (ai.closeIn && !startled && this.tick % 3 === s.id % 3) { const o = this._nearestFoe(s, REACH * 0.95); if (o) { const want = Math.atan2(-(o.x - s.x), -(o.z - s.z)); if (Math.abs(wrapAngle(want - s.yaw)) < 0.6) { s.yaw = want; this._startStrike(s); return; } } }
    if (ai.target < 0) return;
    if (s.side === 'BRI' && ai.mode === 'advance' && this.tick >= ai.fireUntil && s.rng() > 0.004) return;   // walking forward, rifle at the port
    const o = this.soldiers[ai.target]; if (!o.alive) { ai.target = -1; return; }
    const dx = o.x - s.x, dz = o.z - s.z, d = Math.hypot(dx, dz), ty = o.y + HEIGHT[o.stance] * 0.7, dy = ty - this._eye(s);
    // he turns to the man at a man's pace (startled, slower), and fires only once he is facing him
    const want = Math.atan2(-dx, -dz), dyaw = wrapAngle(want - s.yaw), rate = startled ? 0.045 : 0.14;
    s.yaw += Math.max(-rate, Math.min(rate, dyaw)); s.pitch = Math.atan2(dy, d);
    if (startled || Math.abs(dyaw) > 0.12) return;
    if (s.cool > 0 || s.reloading) return;
    const W = WEAPONS[s.weapon];
    if (!W.auto && s.rng() > 0.05) return;   // riflemen take their time over a shot
    // only at a man he can see, now, and within range: if the target has ducked, dropped behind a lip or gone out of
    // range since he picked him, he holds his fire and looks for another
    // (a sight check holds for 0.1 s on the same man, so a machine gun isn't re-tracing 700 m for every round of a burst)
    if (d > engageRange(s)) { ai.target = -1; ai.think = Math.min(ai.think, 6); return; }
    if (!(ai.losFor === o.id && this.tick - ai.losAt < 6)) { if (!this._canSee(s, o, d)) { ai.target = -1; ai.losFor = -1; ai.think = Math.min(ai.think, 6); return; } ai.losFor = o.id; ai.losAt = this.tick; }
    if (s.side !== this.player.side) {
      // the enemy's shooting: each round hits with a chance falling linearly from 50% at 25 m to 1% at 100 m (1% beyond).
      // A hit is aimed true at what shows of the man (cover still stops it); a miss goes a metre or more wide.
      const pHit = hitChance(d);
      if (s.rng() < pHit) { const ay = o.y + HEIGHT[o.stance] * 0.8 - this._eye(s); this._fire(s, Math.atan2(-dx, -dz), Math.atan2(ay, d), true); }
      else { const side = s.rng() < 0.5 ? -1 : 1, off = (1.1 + s.rng() * 2.5) / Math.max(d, 3); this._fire(s, s.yaw + side * off, s.pitch + (s.rng() - 0.3) * off, true); }
      return;
    }
    const err = (0.006 + d * 0.00003) / ai.skill;
    this._fire(s, s.yaw + s.rng.gauss() * err, s.pitch + s.rng.gauss() * err * 0.7);
  }

  // ---------- weapons ----------
  // close quarters ----------------------------------------------------------------------------------------------------
  _nearestFoe(s, r) {
    let best = null, bd = r; const gx = Math.floor(s.x / 100), gz = Math.floor(s.z / 100);
    for (let cz = gz - 1; cz <= gz + 1; cz++) for (let cx = gx - 1; cx <= gx + 1; cx++) { const l = this.grid.get((cx << 8) | cz); if (!l) continue;
      for (const o of l) { if (o.side === s.side || !o.alive || Math.abs(o.y - s.y) > 1.4) continue; const d = Math.hypot(o.x - s.x, o.z - s.z); if (d < bd) { bd = d; best = o; } } }
    return best;
  }
  _startStrike(s) {
    if (s.strike > 0 || s.climb > 0 || s.pickup > 0) return;
    s.strike = STRIKE_TICKS; this.events.push({ t: 'strike', id: s.id, steel: s.steel });
  }
  _strikeTick(s) {
    s.strike--;
    if (s.strike !== STRIKE_TICKS - STRIKE_HIT) return;
    // it lands on whoever is within reach and in front of him (a 70-degree cone), nearest first
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw); let best = null, bd = REACH;
    const gx = Math.floor(s.x / 100), gz = Math.floor(s.z / 100);
    for (let cz = gz - 1; cz <= gz + 1; cz++) for (let cx = gx - 1; cx <= gx + 1; cx++) { const l = this.grid.get((cx << 8) | cz); if (!l) continue;
      for (const o of l) { if (o === s || o.side === s.side || !o.alive || Math.abs(o.y - s.y) > 1.2) continue; const dx = o.x - s.x, dz = o.z - s.z, d = Math.hypot(dx, dz);
        if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.57) { bd = d; best = o; } } }
    if (!best) { this.events.push({ t: 'whiff', id: s.id }); return; }
    const dx = best.x - s.x, dz = best.z - s.z, d = Math.hypot(dx, dz) || 1;
    this._damage(best, steelDamage(s.steel, s.rng), s, { dir: [dx / d, 0, dz / d], zone: 'body', point: [best.x, best.y + 1.1, best.z], kind: 'melee', steel: s.steel });
  }
  _weaponTick(s) {
    if (s.cool > 0) s.cool -= DT;
    if (s.jam > 0 && !s.isPlayer) { s.jam -= DT; if (s.jam <= 0) { s.jam = 0; this.events.push({ t: 'unjam', id: s.id }); } }
    if (s.strike > 0) this._strikeTick(s);
    if (s.throw > 0) this._throwTick(s);
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
  _fire(s, yaw, pitch, exact = false) {
    const W = WEAPONS[s.weapon];
    if (s.cool > 0 || s.reloading > 0 || s.climb > 0) return false;
    if (s.mag <= 0) { this._startReload(s); return false; }
    if (s.jam > 0) return false;   // jammed: nothing until it is cleared
    s.mag--; s.cool = W.cycle;
    // now and then a round fails to feed or a case sticks: a rifle about one round in 120, the machine gun one in 300
    if (s.rng() < (W.auto ? 1 / 300 : 1 / 120)) { s.jam = s.isPlayer ? 1e9 : 1.8 + s.rng() * 1.4; this.events.push({ t: 'jam', id: s.id }); }
    const moving = s.intent && (s.intent.f || s.intent.s);
    const spread = exact ? 0 : s.isPlayer ? aimSpread(s) : (moving ? 0.012 : 0);
    if (s.isPlayer) { const [sy, sp] = aimSway(s, this.tick); yaw += sy; pitch += sp; }   // (where the swaying view was pointing)
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
    if (victim) this._damage(victim, bulletDamage(W, zone, s.rng), s, { dir: [dx, dy, dz], zone, point: [hx, hy, hz], kind: 'bullet' });
    return true;
  }
  // a throw: the bomb out and the pin pulled, the overhand throw, released at THROW_RELEASE; the player throws where he
  // is looking at release (he can still aim through the wind-up), the AI where he chose when he started
  _startThrow(s, power, aim = null) {
    if (!(s.grenades > 0) || s.throw > 0 || s.climb > 0 || s.strike > 0 || s.pickup > 0 || s.reloading > 0) return false;
    s.grenades--; s.throw = THROW_TICKS; s.throwPow = power; s.throwAim = aim;
    this.events.push({ t: 'throw', id: s.id, kind: NADE[s.side].kind });
    return true;
  }
  _throwTick(s) {
    s.throw--;
    if (s.throw !== THROW_RELEASE) return;
    const A = s.throwAim, L = nadeLaunch(s.x, this._eye(s), s.z, A ? A.yaw : s.yaw, A ? A.pitch : s.pitch, s.throwPow);
    const N = NADE[s.side]; this.grenades.push({ ...L, id: this.nadeId = (this.nadeId || 0) + 1, kind: N.kind, fuse: Math.round(N.fuse * HZ), owner: s.id, side: s.side, age: 0 });
    this.events.push({ t: 'release', id: s.id });
  }
  // AI: a bomb at an enemy 10-32 m off (12-20 s between one man's throws); most of all at one in a trench or out of sight behind cover (what a rifle can't
  // reach), never with a man of his own side near where it would land
  _considerThrow(s, cand, best) {
    const ai = s.ai;
    if (!(s.grenades > 0) || s.throw > 0 || s.climb > 0 || s.reloading > 0 || s.gun >= 0 || this.tick < (ai.nadeAt || 0)) return false;
    if (s.rng() > 0.3) return false;   // (cheap first: most thinks never get further)
    cand = cand.slice(0, 12).sort((a, b) => (b[1].gun >= 0 && b[0] < 45 ? 1 : 0) - (a[1].gun >= 0 && a[0] < 45 ? 1 : 0) || a[0] - b[0]);
    for (let i = 0; i < Math.min(6, cand.length); i++) {
      const o = cand[i][1]; if (!o.alive || cand[i][0] < 10) continue; if (cand[i][0] > 45) return false;
      const d = Math.hypot(o.x - s.x, o.z - s.z); if (d < 10 || d > 32) continue;   // (closer than 10 m: the steel)
      const hidden = this.T.inTrench(o.x, o.z) || o.id !== best || o.gun >= 0;   // (a gun crew above all)
      if (s.rng() > (hidden ? 1 : s.side === 'GER' ? 0.5 : 0.27)) return false;   // (x 0.3 above: 0.3, 0.15, 0.08)
      const err = 1 + d * 0.06, tx = o.x + s.rng.gauss() * err, tz = o.z + s.rng.gauss() * err;
      if (this._friendNear(s, tx, tz, 7)) return false;
      // the speed for a 45-degree lob (35 if that's beyond him) to land there
      const L0 = nadeLaunch(s.x, this._eye(s), s.z, 0, 0, 0), D = Math.hypot(tx - s.x, tz - s.z) - 0.3, h = this.T.height(tx, tz) - L0.y;
      for (const ang of [0.78, 0.6, 1.0]) {
        const q = D * Math.tan(ang) - h; if (q <= 0.2) continue;
        const v = Math.sqrt(G * D * D / (2 * Math.cos(ang) ** 2 * q));
        if (v > NADE_V0 + NADE_V1 || v < NADE_V0) continue;
        const pw = (v - NADE_V0) / NADE_V1;
        if (!this._startThrow(s, pw, { yaw: Math.atan2(-(tx - s.x), -(tz - s.z)), pitch: ang - nadeLoft(pw) })) return false;
        s.stance = 0; s.intent = null; s.yaw = s.throwAim.yaw; ai.nadeAt = this.tick + 12 * HZ + s.rng.int(8 * HZ);
        return true;
      }
      return false;
    }
    return false;
  }
  _friendNear(s, x, z, r) {
    const gx = Math.floor(x / 100), gz = Math.floor(z / 100);
    for (let cz = gz - 1; cz <= gz + 1; cz++) for (let cx = gx - 1; cx <= gx + 1; cx++) { const l = this.grid.get((cx << 8) | cz); if (!l) continue;
      for (const o of l) if (o.side === s.side && o.alive && o !== s && Math.abs(o.x - x) < r && Math.abs(o.z - z) < r && Math.hypot(o.x - x, o.z - z) < r) return true; }
    if (this.player.alive && this.player.side === s.side && Math.hypot(this.player.x - x, this.player.z - z) < r) return true;
    return false;
  }
  _damage(v, dmg, src, info) {
    if (!v.alive) return;
    // God mode (Esc menu): nothing hurts the player at all
    if (v.isPlayer && this.god) return;
    // Rambo mode (Esc menu): the player shrugs off bullets: 10 hits and he's still standing, the 11th drops him
    if (v.isPlayer && this.rambo && info.kind === 'bullet') dmg = 9.5;
    v.hp -= dmg; v.lastHit = info;
    this.events.push({ t: 'hit', id: v.id, dmg, ...info });
    if (v.hp > 0) return;
    v.alive = false; v.hp = 0; v.deadAt = this.tick; v.deaths++; this.score[v.side].deaths++;
    if (v.isPlayer && v.gun >= 0) this._dismount(v);
    // shot with the pin out: the bomb drops at his feet, live
    if (v.throw > THROW_RELEASE && v.throw <= THROW_PREP) { const N = NADE[v.side]; this.grenades.push({ x: v.x, y: v.y + 1, z: v.z, vx: 0, vy: 0, vz: 0, id: this.nadeId = (this.nadeId || 0) + 1, kind: N.kind, fuse: Math.round(N.fuse * HZ), owner: v.id, side: v.side, age: 0 }); }
    v.throw = 0;
    if (src && src.side !== v.side) { src.kills++; this.score[src.side].kills++; }
    this.events.push({ t: 'death', id: v.id, by: src ? src.id : -1, ...info });
    this._drop(v);
  }
  // a fallen man's rifle stays where he fell, with his ammunition (the newest few hundred are kept)
  _drop(v) {
    if (v.weapon === 'mg08') return;   // (a machine gun stays on its mount)
    this.drops.push({ x: v.x, z: v.z, y: v.y, weapon: v.weapon, mag: v.mag, reserve: v.reserve, side: v.side, of: v.id, tick: this.tick });
    if (this.drops.length > 600) this.drops.shift();
  }
  // the nearest rifle lying within reach (1.8 m), or -1
  nearDrop(p) {
    let best = -1, bd = 1.8;
    for (let i = this.drops.length - 1; i >= 0; i--) { const d = this.drops[i]; if (Math.abs(d.x - p.x) > bd || Math.abs(d.z - p.z) > bd || Math.abs(d.y - p.y) > 1.2) continue; const r = Math.hypot(d.x - p.x, d.z - p.z); if (r < bd) { bd = r; best = i; } }
    return best;
  }
  _swapRifle(p, d) {
    if (!d) return;
    if (d.weapon === p.weapon) {   // the same rifle as his own: he takes the dead man's rounds into his pouches (up to a full load) and leaves the rifle
      const room = WEAPONS[p.weapon].reserve * 2 - p.reserve, n = Math.min(room, d.mag + d.reserve);
      p.reserve += n; const fromMag = Math.min(d.mag, n); d.mag -= fromMag; d.reserve -= n - fromMag;
      this.events.push({ t: 'ammo', id: p.id, n }); return;
    }
    const mine = { weapon: p.weapon, mag: p.mag, reserve: p.reserve };
    Object.assign(p, { weapon: d.weapon, mag: d.mag, reserve: d.reserve, reloading: 0, cool: 0 });
    Object.assign(d, mine, { of: p.id });   // yours left lying in its place
    this.events.push({ t: 'pickup', id: p.id, weapon: p.weapon });
  }
  _explode(x, y, z, r, kill, src, kind = 'shell') {
    this.events.push({ t: 'explosion', p: [x, y, z], r, kind });
    for (const o of this.soldiers) {
      if (!o.alive || o.emerge > 0) continue;   // (down in a dugout)
      const d = Math.hypot(o.x - x, o.y + 0.9 - y, o.z - z); if (d > r) continue;
      // a man in a trench is sheltered from a burst outside it
      // (but a bomb in the trench itself is in there with him; and its walls hold most of it in from a man up on top)
      const blastIn = kind === 'grenade' && this.T.inTrench(x, z), inT = this.T.inTrench(o.x, o.z);
      const sheltered = inT && !blastIn && !(Math.hypot(o.x - x, o.z - z) < 3), contained = blastIn && !inT;
      const dmg = d < kill ? 250 : 120 * (1 - d / r) * (sheltered ? 0.25 : contained ? 0.4 : 1);
      if (dmg < 5) continue;
      const L = Math.max(0.5, Math.hypot(o.x - x, o.z - z));
      this._damage(o, dmg, src, { dir: [(o.x - x) / L, 0.8, (o.z - z) / L], zone: 'body', point: [o.x, o.y + 1, o.z], kind, blast: Math.min(1, (r - d) / r + 0.3) });
    }
  }

  // ---------- movement (player and AI share it) ----------
  _move(s) {
    if (s.emerge > 0) { this._emerge(s); return; }
    const T = this.T, I = s.intent;
    if (s.climb > 0) {          // scrambling up a trench wall or over the parapet
      s.climb -= DT;
      if (s.climb <= 0) { s.x = s.climbTo[0]; s.z = s.climbTo[1]; s.y = T.height(s.x, s.z); s.climbTo = null; }
      return;
    }
    if (I && I.yaw !== undefined) s.yaw = I.yaw;
    if (s.isPlayer && I && (I.jump || I.vault) && s.onGround) {
      // the way he's going, or the way he's facing if he's standing still
      let dx = -Math.sin(s.yaw), dz = -Math.cos(s.yaw);
      if (I.f || I.s) { const sy = Math.sin(s.yaw), cy = Math.cos(s.yaw), L = Math.hypot(I.f, I.s); dx = (-sy * I.f + cy * I.s) / L; dz = (-cy * I.f - sy * I.s) / L; }
      if (this._tryClimb(s, dx, dz, 2.8, 1.6)) return;          // up and out: anything up to head height (a trench wall and its sandbags), reaching over the fire-step
      if (I.vault && this._tryLeap(s, dx, dz)) return;           // E on the lip of a trench: jump across it
    }
    // a man going forward who comes to the lip of a narrow trench may jump it (about two in three do) rather than climb
    // down into it and out again; the choice holds while he is at that lip
    if (!s.isPlayer && I && I.jump && I.f > 0 && s.onGround && s.ai && this.tick > (s.ai.leapNo || 0)) {
      const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
      if (T.height(s.x + fx * 0.8, s.z + fz * 0.8) < s.y - 0.8) {
        s.ai.leapNo = this.tick + 90;
        if (s.rng() < 0.65 && this._tryLeap(s, fx, fz)) return;
      }
    }
    let sp = 0, mx = 0, mz = 0;
    if (I && (I.f || I.s)) {
      const run = I.run && s.stamina > 0.05;
      sp = s.stance === 2 ? SPEED.prone : s.stance === 1 ? SPEED.crouch : run ? SPEED.run : s.isPlayer ? SPEED.walk : SPEED.advance;
      if (run) s.stamina = Math.max(0, s.stamina - DT / 14); else s.stamina = Math.min(1, s.stamina + DT / 9);
      const f = I.f, sd = I.s, L = Math.hypot(f, sd) || 1, sy = Math.sin(s.yaw), cy = Math.cos(s.yaw);
      mx = (-sy * f + cy * sd) / L; mz = (-cy * f - sy * sd) / L;
      if (s.isPlayer || (this.tick + s.id) % 6 === 0) s.wire = this.F.wireAt(s.x, s.z);   // AI: every sixth tick is enough
      if (s.wire > 0) sp *= 1 - s.wire * 0.78;
      // walking up a steep crater side is slow (the ground under him is known from last tick)
      const ahead = T.height(s.x + mx * 0.6, s.z + mz * 0.6) - (s.gh ?? s.y); if (ahead > 0.15) sp *= Math.max(0.45, 1 - ahead * 0.8);
    } else s.stamina = Math.min(1, s.stamina + DT / 7);
    const nx = s.x + mx * sp * DT, nz = s.z + mz * sp * DT, x0 = s.x, z0 = s.z;
    const lim = [5, this.T.size - 5], R = 0.3;
    // a man is a 0.3 m circle: he can't move into ground that rises more than a step anywhere ahead of him on that circle
    // (only the leading side blocks, so a man pressed against a wall can always step away from it)
    const far = !s.isPlayer && Math.abs(s.x - this.player.x) + Math.abs(s.z - this.player.z) > 350;   // simulation level of detail
    const ok = (x, z, dx, dz) => {
      if (x < lim[0] || z < lim[0] || x > lim[1] || z > lim[1]) return false;
      if (far) { const L = Math.hypot(dx, dz) || 1; return !(T.height(x + dx / L * 0.3, z + dz / L * 0.3) - s.y > (s.onGround ? 0.75 : 0.02)); }   // far away: one probe ahead
      const L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
      // the player is probed on 16 rays at two radii, so a sharp wall corner can't slip between probes; AI on 8
      const n = s.isPlayer ? 16 : 6, lim2 = s.onGround ? 0.75 : 0.02;   // in the air he can't pass into anything above his feet
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
    const moved = s.x !== x0 || s.z !== z0 || !s.onGround;
    // vertical: follow the ground, fall into trenches and shell holes
    const gh = T.height(s.x, s.z); s.gh = gh;
    if (I && I.jump && s.onGround && s.isPlayer && sp === 0) { s.vy = 3.6; s.onGround = false; }
    if (I && I.jump && s.onGround && s.isPlayer && sp > 0 && gh - s.y < 0.1) { /* jumping while walking: a hop */ s.vy = 3.6; s.onGround = false; }
    s.vy -= G * DT; s.y += s.vy * DT;
    if (s.y <= gh) { if (!s.onGround && s.vy < -9) this._damage(s, (-s.vy - 9) * 18, null, { dir: [0, -1, 0], zone: 'legs', point: [s.x, s.y, s.z], kind: 'fall' }); s.y = gh; s.vy = 0; s.onGround = true; }
    else if (s.y - gh > 0.3 || s.vy > 0) s.onGround = false; else { s.y = gh; s.vy = 0; s.onGround = true; }   // rising (a jump) is never snapped back down
    if (!far && (!s.onGround || (moved && (s.isPlayer || (this.tick + s.id) % 3 === 0)))) this._depenetrate(s);   // AI checked every third tick; far men not at all   // after the fall step, so a man dropping in beside a wall is pushed clear the same tick
    // other men are solid: a man is a body ~0.3 m across and can't walk into another; around the player the gap is 0.8 m
    // (his rifle and arms reach ahead of him). An AI man always gives way to the player; otherwise the mover backs out.
    if (!s.climb && !far && (s.isPlayer || s.x !== x0 || s.z !== z0 || moved)) {   // after the wall push-out, so nothing undoes it
      const okAt = (m, x, z) => x > 5 && z > 5 && x < T.size - 5 && z < T.size - 5 && T.height(x, z) - m.y < 0.75 && !this.F.wallAt(x, z, m.y);
      const gx = Math.floor(s.x / 2), gz = Math.floor(s.z / 2);
      for (let cz = gz - 1; cz <= gz + 1; cz++) for (let cx = gx - 1; cx <= gx + 1; cx++) {
        const l = this.bump && this.bump.get((cx << 12) | cz); if (!l) continue;
        for (const o of l) {
          if (o === s || !o.alive || (o.climb > 0 && !s.isPlayer) || Math.abs(o.y - s.y) > 1.6) continue;   // (a man climbing out is solid to the player, who backs off: he isn't pulled off the wall)
          const MIN = s.isPlayer || o.isPlayer ? 0.8 : 0.6, dx = s.x - o.x, dz = s.z - o.z, d = Math.hypot(dx, dz);
          if (d >= MIN) continue;
          let ux = dx, uz = dz; if (d < 1e-4) { ux = x0 - s.x; uz = z0 - s.z; if (Math.hypot(ux, uz) < 1e-6) { ux = Math.cos(o.id); uz = Math.sin(o.id); } }
          const L = Math.hypot(ux, uz); ux /= L; uz /= L;
          if (s.isPlayer && !o.isPlayer && !(o.climb > 0)) {   // the AI man steps aside (or, if he can't, the player stops)
            const ox = s.x - ux * MIN, oz = s.z - uz * MIN;
            if (okAt(o, ox, oz)) { o.x = ox; o.z = oz; o.y = Math.max(o.y, T.height(ox, oz)); continue; }
          }
          const nx2 = o.x + ux * MIN, nz2 = o.z + uz * MIN;
          if (okAt(s, nx2, nz2)) { s.x = nx2; s.z = nz2; } else if (Math.hypot(x0 - o.x, z0 - o.z) > d) { s.x = x0; s.z = z0; }
          // still pressed together against a wall (the player dropping in beside him): the AI man steps off whichever way is clear
          if ((s.isPlayer || o.isPlayer) && Math.hypot(s.x - o.x, s.z - o.z) < MIN) {
            const pl = s.isPlayer ? s : o, ai = s.isPlayer ? o : s;
            if (!(ai.climb > 0)) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + ai.id, ax = pl.x + Math.cos(a) * MIN, az = pl.z + Math.sin(a) * MIN; if (okAt(ai, ax, az)) { ai.x = ax; ai.z = az; ai.y = Math.max(ai.y, T.height(ax, az)); break; } }
          }
        }
      }
    }
  }
  // push a man out of any wall his 0.3 m body overlaps (dropping in beside a wall, a crater opening up under him)
  _depenetrate(s) {
    const T = this.T, n = s.isPlayer ? 16 : 6, R = 0.3;
    const t = T.trenchAt(s.x, s.z, this._dp || (this._dp = {}));
    if (t.seg < 0 || t.d > T.segs[t.seg].hw + 0.5) { if (!T.craterAt(s.x, s.z)) return; }   // walls only exist at trench edges (and steep crater sides)
    for (let it = 0; it < 8; it++) {
      let px = 0, pz = 0, hit = 0;
      for (let k = 0; k < n; k++) {
        const a = k * Math.PI * 2 / n, cx = Math.cos(a), cz = Math.sin(a);
        for (const r of [R, R * 0.6]) if (T.height(s.x + cx * r, s.z + cz * r) - s.y > 0.75) { px -= cx * (R - r + 0.05); pz -= cz * (R - r + 0.05); hit++; break; }
      }
      if (!hit) return;
      const L = Math.hypot(px, pz); if (L < 1e-6) return;
      const step = Math.min(s.onGround ? 0.06 : 0.12, L / hit + 0.01), nx = s.x + px / L * step, nz = s.z + pz / L * step;
      if (s.onGround && T.height(nx, nz) - s.y > 0.75) return;   // nowhere better to go (falling, he is always pushed clear)
      s.x = nx; s.z = nz;
    }
  }
  // climb the wall ahead: its top no more than maxH above his feet, the wall starting within reach, somewhere to stand beyond
  _tryClimb(s, mx, mz, maxH = 3.6, reach = 3.3) {
    const T = this.T;
    let start = -1;
    for (let d = 0.3; d <= reach + 2.2; d += 0.15) {
      const x = s.x + mx * d, z = s.z + mz * d, h = T.height(x, z);
      if (h - s.y < 0.75) { start = -1; continue; }   // below a step (or back down off a fire-step): keep looking
      if (start < 0) { if (d > reach) return false; start = d; }
      if (h - s.y > maxH) return false;
      // the top: ground beyond that is roughly level with this point
      const fx = x + mx * 0.7, fz = z + mz * 0.7, fh = T.height(fx, fz);
      if (Math.abs(fh - h) < 0.9 && !T.isTrench(fx, fz) && !this.F.wallAt(fx, fz, fh)) {
        // a laden man scrambling out takes his time: ~1.3 s for a 1 m lip, ~2.3 s for a 2 m trench wall
        s.climb = 0.55 + (h - s.y) * 0.85; s.climbDur = s.climb; s.climbFrom = [s.x, s.y, s.z]; s.climbKind = 'climb'; s.climbTo = [fx, fz]; s.vy = 0;
        this.events.push({ t: 'climb', id: s.id, h: h - s.y }); return true;
      }
    }
    return false;
  }
  // leap a trench from its lip: a drop just ahead, and level ground on the far side within ~3 m
  _tryLeap(s, mx, mz) {
    const T = this.T;
    let gap = -1;
    for (let d = 0.2; d <= 3.2; d += 0.1) {
      const x = s.x + mx * d, z = s.z + mz * d, h = T.height(x, z);
      if (gap < 0) { if (h < s.y - 0.8) gap = d; else if (d > 1.0) return false; continue; }
      if (Math.abs(h - s.y) < 0.7 && !T.isTrench(x, z)) {
        const fx = x + mx * 0.35, fz = z + mz * 0.35, fh = T.height(fx, fz);
        if (Math.abs(fh - s.y) < 0.8 && !this.F.wallAt(fx, fz, fh)) { s.climb = 0.35 + d * 0.08; s.climbDur = s.climb; s.climbFrom = [s.x, s.y, s.z]; s.climbKind = 'leap'; s.climbTo = [fx, fz]; s.vy = 0; this.events.push({ t: 'leap', id: s.id, d }); return true; }
      }
    }
    return false;
  }

  // ---------- the battle's own clock: barrage, mines, zero hour, enemy shellfire ----------
  _director() {
    const t = this.time, r = this.rng;
    if (!this.flags.mine && t >= MINE_TIME) {
      this.flags.mine = true;
      for (const m of this.map.mines) {
        const b = this.T.blowMine(m.name); if (b) this.F.clearWire(b.x, b.z, b.r);
        this.events.push({ t: 'mine', name: m.name, p: [m.c[0], this.T.height(m.c[0], m.c[1]), m.c[1]], r: m.craterR });
        this._explode(m.c[0], this.T.height(m.c[0], m.c[1]) + 2, m.c[1], m.craterR * 2.2, m.craterR * 1.25, null, 'mine');
      }
      this.trenchPts = { BRI: this._trenchPoints('BRI'), GER: this._trenchPoints('GER') };   // the blown trenches are no place to stand
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
      nadeStep(g, this.T); g.age++;
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
  // ---------- wire: a man going forward goes round a belt when he can see a way through ----------
  // The heading toward his goal if the next 12 m are clear of wire; else the nearest heading that is (up to 80 degrees
  // off), keeping to the side he chose last so he works along the belt to a gap instead of dithering; if there is no
  // way round in reach, or he is already in it, straight on through.
  _wireDetour(s, h0) {
    const F = this.F, clear = h => { const sx = -Math.sin(h), sz = -Math.cos(h); for (let d = 2; d <= 12; d += 1.5) if (F.wireAt(s.x + sx * d, s.z + sz * d) > 0) return false; return true; };
    if (F.wireAt(s.x, s.z) > 0 || clear(h0)) { s.ai.wireSide = 0; return h0; }
    const first = s.ai.wireSide || (s.id % 2 ? 1 : -1);
    for (let a = 0.2; a <= 1.41; a += 0.2) for (const side of [first, -first]) if (clear(h0 + side * a)) { s.ai.wireSide = side; return h0 + side * a; }
    return h0;
  }

  // ---------- respawn: death is common and the line is always fed with fresh men ----------
  spawnPoints(side) {
    const pts = this.map.spawns[side].map(p => ({ p, name: 'Trench' }));
    for (const o of this.objectives) if (o.owner === side) pts.push({ p: o.c, name: o.name });
    return pts;
  }
  // the objective a side is going for (the nearest it doesn't hold), or, when it holds them all, the nearest it holds
  target(side, x, z) {
    const near = l => l.length ? l.reduce((b, o) => Math.hypot(o.c[0] - x, o.c[1] - z) < Math.hypot(b.c[0] - x, b.c[1] - z) ? o : b) : null;
    return near(this.objectives.filter(o => o.owner !== side)) || near(this.objectives);
  }
  // men the player may go back in as: alive, his side, not halfway up a wall, no enemy within 25 m; nearest the
  // objective first (the fight, not the far end of the line)
  takeoverChoices(side, x = this.player.x, z = this.player.z, n = 12) {
    const goal = this.target(side, x, z), gx = goal ? goal.c[0] : x, gz = goal ? goal.c[1] : z;
    const foes = this.soldiers.filter(o => o.alive && o.side !== side), out = [];
    const mine = this.soldiers.filter(o => o.alive && !o.isPlayer && o.side === side && !(o.climb > 0) && !(o.emerge > 0) && !(o.gun >= 0)).sort((a, b) => Math.hypot(a.x - gx, a.z - gz) - Math.hypot(b.x - gx, b.z - gz) || a.id - b.id);
    for (const o of mine) { if (foes.some(f => Math.abs(f.x - o.x) < 25 && Math.abs(f.z - o.z) < 25 && Math.hypot(f.x - o.x, f.z - o.z) < 25)) continue; out.push(o); if (out.length >= n) break; }
    return out;
  }
  // going back in as a man already in the field (his place, his kit, his wounds); 'random' is one of the men nearest the
  // objective. He leaves the line as the player takes his place (his slot is filled from the reserve later, as any gap)
  _takeOver(p, id) {
    let o = id === 'random' ? null : this.soldiers[id];
    if (!o || !o.alive || o.isPlayer || o.side !== p.side || o.climb > 0) { const c = this.takeoverChoices(p.side); o = c.length ? c[p.rng.int(c.length)] : null; }
    if (!o) return this._respawn(p);
    const g = this.target(p.side, o.x, o.z), yaw = g ? Math.atan2(-(g.c[0] - o.x), -(g.c[1] - o.z)) : o.yaw;   // facing the objective
    Object.assign(p, { x: o.x, z: o.z, y: o.y, yaw, pitch: 0, vy: 0, hp: o.hp, alive: true, climb: 0, climbTo: null, stance: o.stance, stamina: 1, onGround: true,
      weapon: o.weapon, mag: o.mag, reserve: o.reserve, reloading: 0, cool: 0, grenades: o.grenades ?? 3, throw: 0, lastHit: null, pickup: 0, gun: -1, gunRole: null, pinned: 0 });
    o.alive = false; o.hp = 0; o.deadAt = this.tick; o.intent = null;
    p.gaveUp = false; this.events.push({ t: 'respawn', id: p.id, p: [p.x, p.y, p.z], into: o.id });
    return true;
  }
  // N: the player goes on as another man in the fight, and an AI takes over the man he was (they swap: no one leaves the
  // line). Each time a fresh cluster: men of his side round the objective he is attacking (within 250 m of it, wider if
  // there are too few), one of them at random as its seed and his 9 nearest comrades; one of those 10 at random, never one
  // of the last six he has been (so it can't flick back and forth between two men), never one about to be overrun.
  switchCandidates(p) {
    const g = this.target(p.side, p.x, p.z), gx = g ? g.c[0] : p.x, gz = g ? g.c[1] : p.z, recent = p.switchHist || [];
    const mine = this.soldiers.filter(o => o.alive && !o.isPlayer && o.side === p.side && !(o.climb > 0) && !(o.emerge > 0) && !(o.gun >= 0) && !(o.throw > 0) && !(o.strike > 0) && !recent.includes(o.id));
    let pool = [];
    for (const R of [250, 500, Infinity]) { pool = mine.filter(o => Math.hypot(o.x - gx, o.z - gz) < R); if (pool.length >= 10) break; }
    if (!pool.length) return [];
    // the seed: of two dozen men drawn at random, one of the four with his nine nearest comrades closest round him (a
    // real knot of men, not a straggler and whoever happens to be nearest him)
    const near10 = c => pool.map(o => [Math.hypot(o.x - c.x, o.z - c.z), o]).sort((a, b) => a[0] - b[0] || a[1].id - b[1].id).slice(0, 10);
    const tries = []; for (let i = 0; i < Math.min(24, pool.length); i++) { const c = pool[p.rng.int(pool.length)], n = near10(c); tries.push([n[n.length - 1][0], c]); }
    tries.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
    const seed = tries[p.rng.int(Math.min(4, tries.length))][1];
    return near10(seed).map(q => q[1])
      .filter(o => !this._nearestFoe(o, 6));
  }
  _switchMan(p) {
    if (p.climb > 0 || p.throw > 0 || p.pickup > 0 || p.strike > 0) return false;
    const c = this.switchCandidates(p); if (!c.length) return false;
    const o = c[p.rng.int(c.length)];
    const K = ['x', 'z', 'y', 'yaw', 'pitch', 'vy', 'hp', 'stance', 'stamina', 'onGround', 'weapon', 'mag', 'reserve', 'grenades', 'jam', 'steel', 'wire'];
    const mineNow = Object.fromEntries(K.map(k => [k, p[k]]));
    for (const k of K) p[k] = o[k];
    for (const k of K) o[k] = mineNow[k];
    Object.assign(p, { reloading: 0, cool: 0, ads: false, intent: null, lastHit: null }); Object.assign(o, { reloading: 0, cool: 0, intent: null, climb: 0, climbTo: null });
    const g = this.target(p.side, p.x, p.z); if (g) p.yaw = Math.atan2(-(g.c[0] - p.x), -(g.c[1] - p.z));
    // the man he was carries on as one of the line (going forward, if the attack is on)
    const ai = o.ai; ai.target = -1; ai.think = 0; ai.closeIn = 0; ai.fleeUntil = 0; ai.post = [o.x, o.z];
    if (o.side === 'BRI' && this.time >= ZERO) { ai.mode = 'advance'; ai.goal = this._goalFor(o); }
    p.switchHist = [...(p.switchHist || []), o.id].slice(-6);
    this.events.push({ t: 'switch', id: p.id, from: o.id, n: c.length });
    return true;
  }
  _respawn(s, at) {
    if (this.reserve[s.side] <= 0) return false;   // no one left to send
    this.reserve[s.side]--;
    const pts = this.spawnPoints(s.side), r = s.rng;
    let pick = at ? pts.find(q => q.name === at) : null;
    if (!pick) { // nearest to where the fight is, for the player; for the AI, a couple up each forward dugout per wave, the rest from the rear
      if (s.isPlayer) pick = pts.reduce((b, q) => Math.hypot(q.p[0] - s.x, q.p[1] - s.z) < Math.hypot(b.p[0] - s.x, b.p[1] - s.z) ? q : b);
      else { const fwd = pts.filter(q => q.name !== 'Trench' && (this.fwd[s.side + q.name] || 0) > 0), rear = pts.filter(q => q.name === 'Trench');
        pick = fwd.length ? r.pick(fwd) : rear.length ? r.pick(rear) : r.pick(pts); if (pick.name !== 'Trench') this.fwd[s.side + pick.name] = (this.fwd[s.side + pick.name] || 0) - 1; }
    }
    const dug = pick.name !== 'Trench' ? this.dugouts.find(d => d.name === pick.name) : null;
    let [x, z] = pick.p;
    if (dug) {   // up the dugout stairs (one man at a time)
      const wait = Math.max(0, dug.next - this.tick); dug.next = this.tick + wait + 55;
      if (s.isPlayer) s.weapon = s.side === 'BRI' ? 'smle' : 'g98';
      Object.assign(s, { hp: 100, alive: true, climb: 0, climbTo: null, stance: 0, stamina: 1, pickup: 0, vy: 0, onGround: true, mag: WEAPONS[s.weapon].mag, reserve: WEAPONS[s.weapon].reserve, reloading: 0, cool: 0, grenades: 3, throw: 0, lastHit: null, jam: 0, strike: 0, gun: -1, gunRole: null, pinned: 0, role: s.role === 'mg' ? 'rifle' : s.role,
        emerge: EMERGE_TICKS, emergeWait: wait, emergeAt: dug, x: dug.x, z: dug.z, y: dug.y - 3.2, yaw: dug.yaw, pitch: 0 });
      this._emerge(s); s.emerge++;   // (placed at the foot of the stairs)
      if (s.ai) Object.assign(s.ai, { mode: s.side === 'BRI' ? 'advance' : s.role === 'mg' ? 'mg' : 'hold', target: -1, goal: null, post: [dug.x, dug.z], think: 30 + r.int(60) });
      if (s.ai && s.side === 'BRI') { s.ai.goal = this._goalFor(s); if (this.time < ZERO) s.ai.mode = 'hold'; }
      s.gaveUp = false; this.events.push({ t: 'respawn', id: s.id, p: [s.x, s.y, s.z], dugout: dug.name });
      return true;
    }
    if (!s.isPlayer && s.side === 'GER') {   // into one of the bays near there, anywhere along it (not all onto the one spot)
      const near = this.trenchPts.GER.filter(q => Math.abs(q[0] - x) < 90 && Math.abs(q[1] - z) < 90);
      if (near.length) { const q = this._alongBay(near[r.int(near.length)], r.range(-6, 6)); x = q[2]; z = q[3]; }
      else { const a = r() * Math.PI * 2, d = 4 + r() * 26; x += Math.cos(a) * d; z += Math.sin(a) * d; }   // (no trench there, a village strongpoint: spread through it, not all on its centre)
    } else { const snap = this._snapToTrench(x + r.range(-25, 25), z + r.range(-25, 25), s.side, 60, s.isPlayer || s.side === 'GER'); if (snap) [x, z] = snap; }
    if (s.isPlayer) s.weapon = s.side === 'BRI' ? 'smle' : 'g98';   // (a fresh man has his own rifle again)
    Object.assign(s, { x, z, y: this.T.height(x, z), vy: 0, hp: 100, alive: true, climb: 0, climbTo: null, stance: 1, stamina: 1, pickup: 0,
      mag: WEAPONS[s.weapon].mag, reserve: WEAPONS[s.weapon].reserve, reloading: 0, cool: 0, grenades: 3, throw: 0, lastHit: null, emerge: 0, emergeAt: null, gun: -1, gunRole: null, pinned: 0, role: s.role === 'mg' ? 'rifle' : s.role });
    if (s.ai) Object.assign(s.ai, { mode: s.side === 'BRI' ? 'advance' : s.role === 'mg' ? 'mg' : 'hold', target: -1, goal: null, post: [x, z], think: 30 + r.int(60) });
    if (s.ai && s.side === 'BRI') { s.ai.goal = this._goalFor(s); if (this.time < ZERO) s.ai.mode = 'hold'; }
    s.gaveUp = false; this.events.push({ t: 'respawn', id: s.id, p: [x, s.y, z] });
    return true;
  }
  _respawns() {
    // AI reinforcements come up in waves, as fresh platoons did
    for (const side of ['BRI', 'GER']) {
      if (this.tick < this.waveT[side]) continue;
      this.waveT[side] = this.tick + HZ * (side === 'BRI' ? 20 : 28);
      for (const o of this.objectives) if (o.owner === side) this.fwd[side + o.name] = FWD_PER_WAVE;
      this._crewGuns(side);
      for (const s of this.soldiers) if (!s.isPlayer && s.side === side && !s.alive && this.tick - s.deadAt > HZ * 8 && this.reserve[side] > 0) this._respawn(s);
    }
  }

  // ---------- agent interface ----------
  hash() {
    const h = new FNV().u32(this.tick).u32(this.rng.state()).u32(this.rambo ? 1 : 0).u32(this.god ? 1 : 0);
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
        canRespawn: !p.alive && this.tick - p.deadAt > HZ * (p.gaveUp ? 0.5 : 3), jammed: p.jam > 0, wire: +this.F.wireAt(p.x, p.z).toFixed(2), climbing: p.climb > 0 },
      soldiers: this.soldiers.filter(s => !s.isPlayer).map(s => ({ id: s.id, side: s.side, role: s.role, x: +s.x.toFixed(1), z: +s.z.toFixed(1), alive: s.alive, mode: s.ai.mode })),
      objectives: this.objectives.map(o => ({ id: o.id, name: o.name, owner: o.owner, progress: +o.progress.toFixed(2) })),
      score: this.score, tally: { BRI: this.tally('BRI'), GER: this.tally('GER') },
      guns: this.guns.map(g => ({ id: g.id, kind: g.kind, side: g.side, manned: !!this._manned(g), belt: g.belt, belts: g.belts })), onGun: p.gun,
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
