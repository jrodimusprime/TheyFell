// The simulation: deterministic, fixed 60 Hz tick, seeded RNG, no wall-clock time (Cimmerian README §11).
// seed + per-tick inputs -> identical state on every run, so an AI agent can play it and recorded runs replay as tests.
// Rendering, ragdolls, particles and sound are cosmetic: they read `events` and never feed back in.
import { mulberry32, FNV } from '../core/rng.js';
import { segDist } from '../world/terrain.js';

export const HZ = 60, DT = 1 / HZ;
// the enemy's chance of hitting with a round at distance d metres: 50% at 25 m, 1% at 100 m, linear between (and beyond, capped)
// how far a man will engage: riflemen 300 m, machine guns 700 m
export const engageRange = s => s.role === 'mg' ? 700 : 300;
const hm = s => { const [h, m] = (s || '08:30').split(':').map(Number); return h * 3600 + m * 60; };   // 'hh:mm' as seconds of the day
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
// the highest a man steps up without climbing (the fire-step is 0.9 m above the trench floor)
const STEP_UP = 0.95;
const STRIKE_TICKS = 36, STRIKE_HIT = 15, REACH = 2.0;
// forward spawns (a strongpoint his side holds): men come up a dugout's stairs, two at most from each per wave
const EMERGE_TICKS = 110, FWD_PER_WAVE = 2;
// machine guns: emplaced, belt-fed, water-cooled (the German MG 08 on its sledge, the British Vickers on its tripod),
// crewed by a gunner and a loader. ~450-480 rounds a minute in bursts, traversing along a line of men; 250-round belts
// (a change takes 4.5 s with the loader, 8 s alone); the water in the jacket boils after a few hundred rounds of
// steady fire (steam); a stoppage now and then. Each round is a real ray (it hits whoever is in its path), and
// rounds cracking past within a few metres pin men down.
export const GUNS = {
  mg08:    { name: 'MG 08', side: 'GER', cycle: 60 / 450, disp: 0.0032, range: 1000, arc: 1.0, belts: 12 },
  vickers: { name: 'Vickers', side: 'BRI', cycle: 60 / 480, disp: 0.0032, range: 1000, arc: 1.0, belts: 12 },
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
const SPEED = { walk: 1.7, run: 4.6, crouch: 1.1, prone: 0.45, advance: 3.1, stroll: 1.3, march: 4.0 };   // march: a section coming up at the double   // stroll: a German walking his trench   // advance: the AI jogs forward (stopping to fire)
const EYE = [1.62, 1.1, 0.35], HEIGHT = [1.78, 1.25, 0.45];
const START_TIME = 7 * 3600 + 27 * 60 + 30, MINE_TIME = 7 * 3600 + 28 * 60, ZERO = 7 * 3600 + 30 * 60;
// before zero hour the clock runs 5x fast: the mines go up ~6 s in and the whistles blow ~30 s in; after zero, real time
export const PRE_ZERO_RATE = 5, ZERO_TIME = ZERO, MINE_AT = MINE_TIME;

export class Sim {
  constructor(T, F, { seed = 1, playerSide = 'BRI', bri = 1500, ger = 750, mgs = 20, strength = { BRI: 10000, GER: 2000 } } = {}) {
    this.nMG = mgs;
    this.T = T; this.F = F; this.seed = seed; this.rng = mulberry32(seed); this.tick = 0;
    this.map = T.map; this.events = []; this.soldiers = []; this.shells = []; this.grenades = []; this.gt = 0;
    this.flags = { mine: false, zero: false };
    this.rambo = false; this.god = false;
    // the objectives: the German front, support and reserve lines (A, B, C), each cut into stretches, taken in order
    this.lines = this.map.lines; this.objectives = this._stretches();
    this.dugouts = this.objectives.map(o => this._dugoutFor(o));   // the way up from the deep dugouts in each stretch
    this.fwd = {};   // men each forward spawn may still send up this wave
    this.score = { BRI: { kills: 0, deaths: 0 }, GER: { kills: 0, deaths: 0 } };
    this.waveT = { BRI: 0, GER: 0 };
    this.drops = [];   // rifles lying where men fell
    this.guns = [];    // machine guns on their mounts
    // the battle's statistics (for the end): each side's kills by what did it, the objectives as they changed hands, and
    // the player's own war
    this.stats = { kills: { BRI: {}, GER: {} }, captures: [], player: { shots: 0, hits: 0, bombs: 0, steel: 0, mg: 0 } };
    this.over = null;   // the end: { winner, reason, at }
    this.hq = { sections: [], nextId: 0, counter: null, zones: null };   // the German HQ (docs/RESERVES.md)
    this._placed = [];   // places taken this tick (not yet in the grid)
    this.trenchPts = { BRI: this._trenchPoints('BRI'), GER: this._trenchPoints('GER') };
    // the player first, then the AI, in a fixed order (Cimmerian §11: stable entity order)
    const ps = this.map.playerStart.pos, p0 = this._snapToTrench(ps[0], ps[1], playerSide, 30, true) || ps;   // on the fire-step, looking over the parapet
    this.player = this._spawn(playerSide, p0[0], p0[1], 'rifle', true);
    { const o = this._onObj(this.target(playerSide, p0[0], p0[1]), p0[0], p0[1]); this.player.yaw = Math.atan2(-(o[0] - p0[0]), -(o[1] - p0[1])); }
    this._populate(bri, ger);
    // the men still to come: each side's whole strength (historically ~10,000 British in 12 battalions against ~2,000 of
    // Reserve Infantry Regiment 110 here) less those already in the line; every man sent in comes out of it
    this.reserve = {}; for (const side of ['BRI', 'GER']) this.reserve[side] = Math.max(0, strength[side] - this.soldiers.filter(o => o.side === side).length);
  }
  // ---------- the trench lines ----------
  // each line's trench (its map polyline, from 'from' to 'to') cut into equal stretches: { id 'A1', line 'A', name, pts,
  // len, c (its middle, on the trench, out of any mine crater), r (how near the trench a man must be to count as in it) }
  _stretches() {
    const out = [], mines = this.map.mines || [];
    for (const L of this.lines) {
      const tr = this.map.trenches.find(t => t.line === L.id), P = tr.pts;
      // the arc length along the polyline at the point nearest p
      const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const proj = p => { let best = 0, bd = 1e9; for (let i = 1; i < P.length; i++) { const ax = P[i - 1][0], az = P[i - 1][1], dx = P[i][0] - ax, dz = P[i][1] - az, l2 = dx * dx + dz * dz, u = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / l2)) : 0, d = Math.hypot(ax + dx * u - p[0], az + dz * u - p[1]); if (d < bd) { bd = d; best = cum[i - 1] + u * (cum[i] - cum[i - 1]); } } return best; };
      const at = t => { let i = 1; while (i < P.length - 1 && cum[i] < t) i++; const u = (t - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u]; };
      const t0 = proj(L.from), t1 = proj(L.to), n = L.stretches.length;
      for (let k = 0; k < n; k++) {
        const a = t0 + (t1 - t0) * k / n, b = t0 + (t1 - t0) * (k + 1) / n, pts = [at(a)];
        for (let i = 0; i < P.length; i++) if (cum[i] > a && cum[i] < b) pts.push(P[i].slice());
        pts.push(at(b));
        let mid = (a + b) / 2; for (let j = 0; j < 40; j++) { const c = at(mid); if (!mines.some(m => Math.hypot(c[0] - m.c[0], c[1] - m.c[1]) < m.craterR + 15)) break; mid += (j % 2 ? -1 : 1) * (j + 1) * 6; mid = Math.max(a, Math.min(b, mid)); }
        out.push({ id: L.id + (k + 1), line: L.id, lineName: L.name, name: L.stretches[k], pts, len: b - a, c: at(mid), r: 20, owner: 'GER', progress: 0 });
      }
    }
    return out;
  }
  // distance from (x, z) to a stretch's trench, and the nearest point on it ({ d, x, z, t: metres along the stretch })
  _nearObj(o, x, z) {
    const P = o.pts; let bd = 1e9, bx = P[0][0], bz = P[0][1], bt = 0, run = 0;
    for (let i = 1; i < P.length; i++) { const ax = P[i - 1][0], az = P[i - 1][1], dx = P[i][0] - ax, dz = P[i][1] - az, l2 = dx * dx + dz * dz, L = Math.sqrt(l2), u = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0, px = ax + dx * u, pz = az + dz * u, d = Math.hypot(px - x, pz - z);
      if (d < bd) { bd = d; bx = px; bz = pz; bt = run + u * L; } run += L; }
    return { d: bd, x: bx, z: bz, t: bt };
  }
  _dObj(o, x, z) {   // (with a quick reject: further than this from the middle is further than 'far' from the trench)
    return this._nearObj(o, x, z).d;
  }
  _onObj(o, x, z) { const q = this._nearObj(o, x, z); return [q.x, q.z]; }
  // a point t metres along a stretch (clamped), or near t (+- spread) at random
  _alongObj(o, r, t = null, spread = 0) {
    let tt = t === null ? r() * o.len : t + (r() * 2 - 1) * spread; tt = Math.max(0, Math.min(o.len, tt));
    const P = o.pts; for (let i = 1; i < P.length; i++) { const L = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (tt <= L || i === P.length - 1) { const u = L ? Math.min(1, tt / L) : 0; return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u]; } tt -= L; }
    return o.c.slice();
  }
  // the stretches a side is going for: the British, the stretches not yet theirs of the first line they don't wholly hold
  // (the lines are taken in order: A, then B, then C); the Germans, any stretch the British hold
  _wanted(side) {
    if (side === 'BRI') { for (const L of this.lines) { const l = this.objectives.filter(o => o.line === L.id && o.owner !== 'BRI'); if (l.length) return l; } return []; }
    return this.objectives.filter(o => o.owner !== side);
  }
  lineHeld(id, side = 'BRI') { return this.objectives.every(o => o.line !== id || o.owner === side); }
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
      if (clear < 4) continue;   // (a gun that can't see out over most of its arc is no use there)
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
    // the player's rounds go down his line of sight (the crosshair): tight for the first 10 rounds of a burst (he is
    // laying the gun by eye, not by a guess at the range), then wider round by round as the gun shakes on its mount
    // (up to 5x by the 37th); letting go of the trigger for a quarter of a second steadies it again
    if (g.isPlayer) { if (this.tick - (gun.lastAt ?? -1e9) > HZ / 4) gun.run = 0; gun.run = (gun.run || 0) + 1; gun.lastAt = this.tick; }
    const r = g.rng, disp = g.isPlayer ? K.disp * 0.165 * Math.min(5, 1 + Math.max(0, gun.run - 10) * 0.15) * (1 + gun.heat * 0.3) : K.disp * (1 + gun.heat * 0.6);
    const M = this.gunMuzzle(gun, gun.aimYaw + r.gauss() * disp, gun.aimPitch + r.gauss() * disp * 0.7);
    if (g.isPlayer) { M.ox = g.x; M.oy = this._eye(g); M.oz = g.z; }
    const { ox, oy, oz, dx, dy, dz } = M;
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
    for (const o of near) if (o !== victim) o.pinned = this.tick + 45 + o.rng.int(60);   // rounds cracking past: heads down
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
  // ---------- the German garrison in its trenches ----------
  // how a man in the line spends the battle: 'popup' crouched below the parapet, standing up on the fire-step now and
  // then for a shot or two with his head and shoulders over the top, then down again and along a little before the next;
  // 'wait' crouched on the trench floor looking along it, holding his fire for whoever comes down into the trench;
  // 'patrol' walking the trench up and down through a few bays; 'steady' standing to the parapet firing, as before.
  _trenchStyle(s, seg, q) {
    // (only a fire trench has a fire-step to stand up on; in a support trench a man waits or walks it)
    const r = s.rng(), fire = this.T.segs[seg] && this.T.segs[seg].kind === 0;
    s.ai.style = fire ? (r < 0.45 ? 'popup' : r < 0.65 ? 'wait' : r < 0.8 ? 'patrol' : 'steady') : (r < 0.6 ? 'wait' : 'patrol');
    s.ai.seg = seg; s.ai.floor = [q[0], q[1]]; s.ai.step = [q[2], q[3]]; s.ai.up = false; s.ai.popNext = 0;
    if (s.ai.style === 'patrol') s.ai.route = this._route(seg, s.rng);
  }
  // a patrol's walk: joints along the trench's floor line, up to five segments each way from his own
  _route(seg, r) {
    const S = this.T.segs, joined = (a, b) => S[a] && S[b] && !S[a].gone && !S[b].gone && Math.abs(S[a].bx - S[b].ax) < 0.02 && Math.abs(S[a].bz - S[b].az) < 0.02;
    let a = seg, b = seg; for (let k = 0; k < 5 && joined(a - 1, a); k++) a--; for (let k = 0; k < 5 && joined(b, b + 1); k++) b++;
    const pts = [[S[a].ax, S[a].az]]; for (let j = a; j <= b; j++) pts.push([S[j].bx, S[j].bz]);
    return pts.length >= 2 ? { pts, i: Math.min(pts.length - 1, seg - a), dir: r() < 0.5 ? 1 : -1, pause: 0 } : null;
  }
  _trenchWork(s, best, bd) {
    const ai = s.ai, t = this.tick;
    if (this.T.segs[ai.seg] && this.T.segs[ai.seg].gone) { ai.style = 'steady'; ai.route = null; }   // (his trench blown in: he fights where he is)
    if (best >= 0 && bd < 25 && ai.style !== 'wait') ai.alertUntil = t + 300;   // an enemy close: up and fight, whatever he was doing
    const alert = t < ai.alertUntil;
    let goal = ai.step, stance = s.reloading || t < s.pinned ? 1 : 0, tol = 0.3;   // (onto the fire-step itself; not shuffling to a point as men brush past)
    if (ai.style === 'popup' && !alert) {
      if (t >= ai.popNext) {
        ai.up = !ai.up && !s.reloading && !(t < s.pinned);
        ai.popNext = t + (ai.up ? 120 + s.rng.int(150) : 100 + s.rng.int(130));
        if (ai.up) ai.think = Math.min(ai.think, 2);   // (up: he looks for a mark at once)
        else { const p = this.trenchPts.GER.find(q => q[2] === ai.seg); if (p) { const q = this._alongBay(p, s.rng.range(-2.5, 2.5)); ai.step = [q[2], q[3]]; ai.floor = [q[0], q[1]]; } }   // down, and along a little
      }
      stance = ai.up && !s.reloading ? 0 : 1; goal = ai.step; tol = 0.2;
    } else if (ai.style === 'wait') { goal = ai.floor; stance = 1; tol = 0.5; }
    else if (ai.style === 'patrol' && !alert && ai.route) {
      const R = ai.route, w = R.pts[R.i];
      if (R.pause > t) { s.intent = null; s.stance = 0; return; }
      if (Math.hypot(w[0] - s.x, w[1] - s.z) < 0.7) {
        if (R.i + R.dir < 0 || R.i + R.dir >= R.pts.length) { R.dir = -R.dir; R.pause = t + 120 + s.rng.int(150); }   // the end of his beat: a pause, then back
        R.i = Math.max(0, Math.min(R.pts.length - 1, R.i + R.dir));
      }
      goal = R.pts[R.i]; stance = 0; tol = 0.3;
    }
    const dx = goal[0] - s.x, dz = goal[1] - s.z, d = Math.hypot(dx, dz);
    // (moving along under the parapet, the pop-up man and the waiting man stoop; the patrol strolls)
    s.stance = d > tol ? (alert || ai.style === 'patrol' || ai.style === 'steady' ? 0 : 1) : stance;
    s.intent = d > tol ? { f: 1, s: 0, run: alert && d > 6, jump: false, stroll: ai.style === 'patrol' && !alert, yaw: Math.atan2(-dx, -dz) } : null;
    if (!s.intent && ai.style === 'wait' && !(ai.target >= 0)) { const S = this.T.segs[ai.seg]; if (S) { const ux = S.bx - S.ax, uz = S.bz - S.az; s.yaw = Math.atan2(ux, uz) + (s.id % 2 ? Math.PI : 0); } }   // looking along the trench
  }
  // ---------- reserves (docs/RESERVES.md) ----------
  // a free place near (x, z) on open ground: no one within 0.75 m (rings outward)
  _freeSpot(x, z) {
    for (let ring = 0; ring < 8; ring++) for (let k = 0; k < (ring ? 8 * ring : 1); k++) {
      const a = k * Math.PI * 2 / (8 * ring || 1) + ring, px = x + Math.cos(a) * ring * 0.8, pz = z + Math.sin(a) * ring * 0.8;
      let clear = true; const gx = Math.floor(px / 2), gz = Math.floor(pz / 2);
      if (this.bump) for (let cz = gz - 1; cz <= gz + 1 && clear; cz++) for (let cx = gx - 1; cx <= gx + 1 && clear; cx++) { const l = this.bump.get((cx << 12) | cz); if (l) for (const o of l) if (o.alive && Math.hypot(o.x - px, o.z - pz) < 0.75) { clear = false; break; } }
      if (clear) for (const q of this._placed) if (Math.hypot(q[0] - px, q[1] - pz) < 0.75) { clear = false; break; }
      if (clear && Math.abs(this.T.height(px, pz) - this.T.height(x, z)) < 0.8) { this._placed.push([px, pz]); return [px, pz]; }
    }
    return [x, z];
  }
  _deepPoint(side, near) {
    const R = this.map.reserves[side]; let pts = side === 'BRI' ? (this.time >= hm(R.deepFrom) && this.rng() < 0.35 ? R.deep : R.line) : R.deep;
    if (side === 'GER') pts = pts.filter(p => !this.objectives.some(o => o.owner === 'BRI' && this._dObj(o, p[0], p[1]) < 170));   // (a line taken over it: not there)
    if (!pts.length) return R.deepFallback || R.deep[0];
    return near ? pts.reduce((b, p) => Math.hypot(p[0] - near[0], p[1] - near[1]) < Math.hypot(b[0] - near[0], b[1] - near[1]) ? p : b) : pts[this.rng.int(pts.length)];
  }
  _fromRear(s) {
    if (this.reserve[s.side] <= 0) return false;
    this.reserve[s.side]--;
    const r = s.rng, need = s.side === 'GER' ? this._neediest() : null, c = this._deepPoint(s.side, need ? need.c : null);
    const [x, z] = this._freeSpot(c[0] + r.range(-40, 40), c[1] + r.range(-40, 40));
    if (s.isPlayer) s.weapon = s.side === 'BRI' ? 'smle' : 'g98';
    Object.assign(s, { x, z, y: this.T.height(x, z), vy: 0, hp: 100, alive: true, climb: 0, climbTo: null, stance: 1, stamina: 1, pickup: 0,
      mag: WEAPONS[s.weapon].mag, reserve: WEAPONS[s.weapon].reserve, reloading: 0, cool: 0, grenades: 3, throw: 0, lastHit: null, emerge: 0, emergeAt: null, gun: -1, gunRole: null, pinned: 0, role: s.role === 'mg' ? 'rifle' : s.role });
    if (s.ai) Object.assign(s.ai, { target: -1, goal: null, post: [x, z], think: 30 + r.int(60), style: null, route: null, up: false, alertUntil: 0, counter: -1, closeIn: 0, fleeUntil: 0 });
    if (s.side === 'BRI') { s.ai.mode = this.time < ZERO ? 'hold' : 'advance'; s.ai.goal = this._goalFor(s); s.ai.cover = s.rng() < 0.1; s.ai.coverDone = false; s.ai.coverStance = 0; }
    else { s.ai.mode = 'muster'; this._muster(s, c); }
    s.gaveUp = false; this.events.push({ t: 'respawn', id: s.id, p: [x, s.y, z], rear: true });
    return true;
  }
  // German sections: men coming back at the second position fall in at its muster point; a section goes when it has 8
  // (or after 40 s with fewer)
  _muster(s, c) {
    const hq = this.hq; let sec = hq.sections.find(q => q.state === 'muster' && Math.hypot(q.at[0] - c[0], q.at[1] - c[1]) < 1);
    if (!sec) { sec = { id: hq.nextId++, at: c, men: [], state: 'muster', since: this.tick, task: null }; hq.sections.push(sec); }
    sec.men.push(s.id); s.ai.section = sec.id;
  }
  // each objective's German zone: its fire-trench bays, and how things stand there
  _zones() {
    if (this.hq.zones) return this.hq.zones;
    // (a stretch's bays: its own line's, nearer it than any other stretch of the line)
    const Z = this.objectives.map((o, i) => ({ i, o, bays: [] }));
    for (const p of this.trenchPts.GER) { const ln = this.T.segs[p[2]].line; if (!ln) continue; let best = null, bd = 15; for (const z of Z) if (z.o.line === ln) { const d = this._dObj(z.o, p[0], p[1]); if (d < bd) { bd = d; best = z; } } if (best) best.bays.push(p); }
    return (this.hq.zones = Z);
  }
  _zoneState(z) {
    const o = z.o, R = 150; let bri = 0, ger = 0, briIn = 0, gerIn = 0, threat = 0, bx = 0, bz = 0;
    const gx = Math.floor(o.c[0] / 100), gz = Math.floor(o.c[1] / 100);
    for (let cz = gz - 5; cz <= gz + 5; cz++) for (let cx = gx - 5; cx <= gx + 5; cx++) { const l = this.grid.get((cx << 8) | cz); if (!l) continue;
      for (const s of l) { const d = this._dObj(o, s.x, s.z); if (s.side === 'BRI') { if (d < 400) { threat++; bx += s.x; bz += s.z; } if (d < R) bri++; if (d < o.r) briIn++; } else if (d < R && s.ai && s.ai.mode !== 'muster' && s.ai.mode !== 'reserve') { ger++; if (d < o.r) gerIn++; } } }
    return { bri, ger, briIn, gerIn, threat, from: threat ? [bx / threat, bz / threat] : null };
  }
  // the zone that most needs men (for where a man comes back)
  _neediest() { const Z = this._zones(); let best = null, bv = -1e9; for (const z of Z) { const st = z.st || { threat: 0, ger: 0 }; const v = (z.o.owner === 'GER' ? 1 : 0.6) * (Math.min(60, 12 + st.threat * 0.6) - st.ger - (z.coming || 0)); if (v > bv) { bv = v; best = z.o; } } return best; }
  // the German HQ, every 5 s: hold each zone at the strength its threat calls for; a hasty counter-thrust where the
  // British have got in; a deliberate counter-attack on an objective lost for some minutes; a withdrawal from one that
  // cannot be held
  _hq() {
    if (!this.map.reserves || this.tick % (5 * HZ) !== 7) return;
    const Z = this._zones(), hq = this.hq, t = this.tick;
    for (const z of Z) { z.st = this._zoneState(z); z.coming = 0; }
    for (const sec of hq.sections) if (sec.state === 'march' && sec.dest >= 0) Z[sec.dest].coming += sec.men.length;
    // sections formed up: send them where they're needed most (or to a counter-attack's assembly)
    for (const sec of hq.sections) {
      if (sec.state !== 'muster') continue;
      sec.men = sec.men.filter(id => this.soldiers[id].alive && this.soldiers[id].ai.mode === 'muster');
      if (sec.men.length < 8 && (t - sec.since < 40 * HZ || !sec.men.length)) continue;
      const ca = hq.counter && hq.counter.state === 'gather' && this.soldiers.filter(m => m.alive && m.ai && m.ai.route && m.ai.route.task === 'counter').length < 40 ? hq.counter : null;   // (a counter-attack takes 40 at most)
      // the immediate reserve thin (under 40): this section goes to the intermediate line to make it up
      if (!ca && this.soldiers.filter(m => m.alive && m.side === 'GER' && m.ai && m.ai.mode === 'reserve').length + hq.sections.filter(q => q.task === 'reserve' && q.state === 'march').reduce((n, q) => n + q.men.length, 0) < 40) {
        const RG = this.map.reserves.GER.ready, rp = RG[sec.id % RG.length];
        sec.state = 'march'; sec.dest = -1; sec.task = 'reserve';
        sec.men.forEach((id, k) => { const m = this.soldiers[id]; m.ai.mode = 'march'; m.ai.route = { pts: [rp], i: 0, k, n: sec.men.length, dest: -1, task: 'reserve' }; });
        this.events.push({ t: 'section', id: sec.id, dest: -1, n: sec.men.length, task: 'reserve' }); continue;
      }
      let dest = ca ? ca.obj : -1, bv = -1e9;
      if (!ca) for (const z of Z) { if (z.o.owner !== 'GER') continue; const v = Math.min(60, 12 + z.st.threat * 0.6) - z.st.ger - z.coming; if (v > bv) { bv = v; dest = z.i; } }
      if (dest < 0) continue;
      const o = this.objectives[dest], away = this._awayFrom(o), w = this.map.world, cl = v => Math.max(w.playMin + 40, Math.min(w.playMax - 40, v)), stage = ca ? ca.stage : [cl(o.c[0] + away[0] * (o.r + 160)), cl(o.c[1] + away[1] * (o.r + 160))];
      sec.state = 'march'; sec.dest = dest; sec.task = ca ? 'counter' : 'hold'; Z[dest].coming += sec.men.length;
      sec.men.forEach((id, k) => { const m = this.soldiers[id]; m.ai.mode = 'march'; m.ai.route = { pts: [stage, ca ? stage : o.c], i: 0, k, n: sec.men.length, dest, task: sec.task }; });
      this.events.push({ t: 'section', id: sec.id, dest, n: sec.men.length, task: sec.task });
    }
    hq.sections = hq.sections.filter(q => q.state === 'muster' || (q.state === 'march' && q.men.some(id => this.soldiers[id].alive && this.soldiers[id].ai.mode === 'march')));
    for (const z of Z) {
      const o = z.o, st = z.st;
      // hasty counter-thrust: British inside a German zone, the nearest reserve party goes in at once with bombs
      if (o.owner === 'GER' && st.briIn > 0 && st.gerIn < st.briIn * 1.5 && t > (z.thrustAt || 0)) {
        const party = this.soldiers.filter(m => m.alive && m.side === 'GER' && m.ai && m.ai.mode === 'reserve').sort((a, b) => Math.hypot(a.x - o.c[0], a.z - o.c[1]) - Math.hypot(b.x - o.c[0], b.z - o.c[1]) || a.id - b.id).slice(0, 6 + Math.min(6, st.briIn));
        if (party.length) { z.thrustAt = t + 60 * HZ; for (const m of party) Object.assign(m.ai, { mode: 'advance', counter: z.i, goal: st.from ? this._onObj(o, st.from[0], st.from[1]) : o.c.slice(), fireUntil: 0, rushUntil: t + 300 * HZ });   // (at a run: they are needed now)
          this.events.push({ t: 'counter', kind: 'thrust', obj: z.i, n: party.length }); }
      }
      // withdraw: a German zone the British hold several times over; its survivors back to the next German one
      if (o.owner === 'GER' && st.ger > 0 && st.ger <= 5 && st.bri >= st.ger * 3 && st.bri >= 8 && t > (z.withdrawnAt || 0)) {
        const next = Z.filter(q => q !== z && q.o.owner === 'GER').sort((a, b) => Math.hypot(a.o.c[0] - o.c[0], a.o.c[1] - o.c[1]) - Math.hypot(b.o.c[0] - o.c[0], b.o.c[1] - o.c[1]))[0];
        const to = next ? next.o.c : this._deepPoint('GER'); z.withdrawnAt = t + 120 * HZ;
        for (const m of this.soldiers) if (m.alive && m.side === 'GER' && m.ai && !(m.gun >= 0) && this._dObj(o, m.x, m.z) < 170 && (m.ai.mode === 'hold' || m.ai.mode === 'advance'))
          Object.assign(m.ai, { mode: 'march', route: { pts: [to], i: 0, k: m.id % 8, n: 8, dest: next ? next.i : -1, task: 'hold' }, style: null });
        this.events.push({ t: 'withdraw', obj: z.i, to: next ? next.i : -1 });
      }
      // a deliberate counter-attack on an objective lost for 3 minutes, when 20 men can be found for it
      if (o.owner === 'BRI') { z.lostAt = z.lostAt || t; } else z.lostAt = 0;
      if (o.owner === 'BRI' && !hq.counter && t - z.lostAt > 180 * HZ && this.reserve.GER > 20) {
        const away = this._awayFrom(o), w = this.map.world, cl = v => Math.max(w.playMin + 40, Math.min(w.playMax - 40, v)), stage = [cl(o.c[0] + away[0] * (o.r + 200)), cl(o.c[1] + away[1] * (o.r + 200))]; hq.counter = { obj: z.i, stage, state: 'gather', since: t };   // (inside the play area)
        // the regiment's reserve first (it is near): up to 24 of the immediate reserve go to the assembly; sections from the rear follow
        const res = this.soldiers.filter(m => m.alive && m.side === 'GER' && m.ai && m.ai.mode === 'reserve').sort((a, b) => Math.hypot(a.x - stage[0], a.z - stage[1]) - Math.hypot(b.x - stage[0], b.z - stage[1]) || a.id - b.id).slice(0, 24);
        res.forEach((m, k) => { m.ai.mode = 'march'; m.ai.route = { pts: [stage, stage], i: 0, k: k % 8, n: 8, dest: z.i, task: 'counter' }; });
        this.events.push({ t: 'counter', kind: 'gather', obj: z.i, n: res.length });
      }
    }
    // the counter-attack: gathered (20 men there, or 4 minutes), the guns shell the objective, then in by rushes
    const ca = hq.counter;
    if (ca) {
      const o = this.objectives[ca.obj], there = this.soldiers.filter(m => m.alive && m.side === 'GER' && m.ai && m.ai.route && m.ai.route.task === 'counter' && Math.hypot(m.x - ca.stage[0], m.z - ca.stage[1]) < 40);
      if (o.owner === 'GER') hq.counter = null;
      else if (ca.state === 'gather' && (there.length >= 20 || (t - ca.since > 240 * HZ && there.length >= 8))) {
        ca.state = 'shell'; ca.goAt = t + 50 * HZ; ca.men = there.map(m => m.id);
        for (let i = 0; i < 26; i++) { const q = this._alongObj(o, this.rng); this.shells.push({ x: q[0] + this.rng.gauss() * 8, z: q[1] + this.rng.gauss() * 8, at: t + 40 + this.rng.int(45 * HZ), kind: this.rng() < 0.4 ? 'shrapnel' : 'he', cal: 'field', side: 'GER' }); }
        this.events.push({ t: 'counter', kind: 'bombard', obj: ca.obj, n: there.length });
      } else if (ca.state === 'shell' && t >= ca.goAt) {
        ca.state = 'go';
        for (const id of ca.men) { const m = this.soldiers[id]; if (m.alive) Object.assign(m.ai, { mode: 'advance', counter: ca.obj, goal: this._alongObj(o, m.rng), route: null, fireUntil: 0 }); }
        this.events.push({ t: 'counter', kind: 'assault', obj: ca.obj, n: ca.men.length });
      } else if (ca.state === 'go' && ca.men.every(id => !this.soldiers[id].alive || this.soldiers[id].ai.mode !== 'advance')) hq.counter = null;
    }
    // men who reach a counter-attack's assembly after it has gone in: into the assault if it is still going on; else a post
    // in the objective if it is German again, or back to the immediate reserve
    for (const m of this.soldiers) {
      if (!m.alive || m.side !== 'GER' || !m.ai || m.ai.mode !== 'march' || !m.ai.route || m.ai.route.task !== 'counter') continue;
      const R = m.ai.route, live = hq.counter && hq.counter.obj === R.dest; if (live && hq.counter.state !== 'go') continue;
      if (Math.hypot(m.x - R.pts[0][0], m.z - R.pts[0][1]) > 40 && live) continue;
      const o = this.objectives[R.dest];
      if (live) Object.assign(m.ai, { mode: 'advance', counter: R.dest, goal: this._alongObj(o, m.rng), route: null, fireUntil: 0 });
      else if (o.owner === 'GER') this._takePost(m, Z[R.dest]);
      else { const RG = this.map.reserves.GER.ready; m.ai.route = { pts: [RG[m.id % RG.length]], i: 0, k: m.id % 8, n: 8, dest: -1, task: 'reserve' }; }
    }
    // men of a counter-thrust or counter-attack whose objective is German again settle into it
    for (const m of this.soldiers) if (m.alive && m.side === 'GER' && m.ai && m.ai.mode === 'advance' && m.ai.counter >= 0) { const o = this.objectives[m.ai.counter]; if (o.owner === 'GER' && this._dObj(o, m.x, m.z) < 60) this._takePost(m, Z[m.ai.counter]); }
  }
  // which way is away from the British, at an objective (for staging points): from the British there, or due east
  _awayFrom(o) { const z = this.hq.zones && this.hq.zones[this.objectives.indexOf(o)], f = z && z.st && z.st.from; if (!f) return [1, 0]; const dx = o.c[0] - f[0], dz = o.c[1] - f[1], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; }
  // a section on the march: in a loose file abreast of the route (each man his own slot), at the double; it stops to
  // fire at an enemy close by; at the end it takes up posts in its zone
  _march(s, best, bd) {
    const ai = s.ai, R = ai.route, w = R.pts[R.i];
    const fwd0 = Math.atan2(-(w[0] - s.x), -(w[1] - s.z)), lat = (R.k - (R.n - 1) / 2) * 3, ox = Math.cos(fwd0) * lat, oz = -Math.sin(fwd0) * lat;
    const gx = w[0] + ox, gz = w[1] + oz, dx = gx - s.x, dz = gz - s.z, d = Math.hypot(dx, dz);
    const dw = Math.hypot(w[0] - s.x, w[1] - s.z), last = R.i + 1 >= R.pts.length;
    if (d < 6 || dw < (last && R.task === 'hold' ? 60 : 20)) {   // (there: in the zone, or by the waypoint; his own slot may be in a wall)
      if (R.i + 1 < R.pts.length) R.i++;
      else if (R.task === 'counter') { s.intent = null; s.stance = 1; return; }   // at the counter-attack's assembly: down, waiting
      else if (R.task === 'reserve') { ai.mode = 'reserve'; ai.route = null; ai.post = [s.x, s.z]; s.intent = null; return; }   // into the intermediate line's dugouts
      else { const Z = this._zones(); if (R.dest >= 0) this._takePost(s, Z[R.dest]); else { ai.mode = 'muster'; this._muster(s, this._deepPoint('GER')); } return; }
    }
    if (best >= 0 && bd < 90 && this.tick < ai.fireUntil) { s.intent = null; s.stance = 1; return; }   // stopped to fire
    s.stance = 0; s.intent = { f: 1, s: 0, run: false, march: true, jump: true, yaw: this._wireDetour(s, Math.atan2(-dx, -dz)) };
  }
  // a post in a zone: the fire-trench bay with fewest men (and the trench habits), else an open post in the shell holes
  _takePost(m, z) {
    const ai = m.ai, o = z.o; ai.counter = -1; ai.route = null; ai.mode = 'hold';
    const used = new Map(); for (const q of this.soldiers) if (q.alive && q.side === 'GER' && q.ai && q.ai.seg !== undefined && q.ai.mode === 'hold') used.set(q.ai.seg, (used.get(q.ai.seg) || 0) + 1);
    const bays = z.bays.filter(p => !this.T.segs[p[2]].gone && (used.get(p[2]) || 0) < 4).sort((a, b) => (used.get(a[2]) || 0) - (used.get(b[2]) || 0) || Math.hypot(a[0] - m.x, a[1] - m.z) - Math.hypot(b[0] - m.x, b[1] - m.z));
    if (bays.length) { const b = bays[0], q = this._alongBay(b, m.rng.range(-3, 3)); ai.post = [q[2], q[3]]; this._trenchStyle(m, b[2], q); return; }
    const st = z.st || {}, f = st.from || [o.c[0] - 300, o.c[1]], a = Math.atan2(f[1] - o.c[1], f[0] - o.c[0]) + m.rng.range(-0.9, 0.9), rr = o.r * (0.5 + m.rng() * 0.4);
    ai.style = 'open'; ai.seg = undefined; ai.post = this._freeSpot(o.c[0] + Math.cos(a) * rr, o.c[1] + Math.sin(a) * rr); ai.face = Math.atan2(-(f[0] - ai.post[0]), -(f[1] - ai.post[1]));
  }
  // ---------- making way: a man of the player's own side in his path steps aside and lets him by ----------
  // Ahead of the player (within his reach for his pace) and within a shoulder's width of his line, a comrade steps to the
  // side: up onto the fire-step if it is that side, else back to the trench wall (or just out of the way in the open);
  // there he stands side-on to the trench, rifle at the port, and the player squeezes past (slowed while he is beside
  // him). Once the player is past (or has gone another way) he goes back to what he was doing.
  _giveWay() {
    const p = this.player, T = this.T, list = this._giving || (this._giving = []);
    for (const id of list) { const o = this.soldiers[id], g = o.giveWay; if (!g) continue;
      const rx = o.x - p.x, rz = o.z - p.z, along = rx * g.dx + rz * g.dz;
      if (!o.alive || !p.alive || this.tick > g.until || along < -0.8 || Math.hypot(rx, rz) > 4.5 || o.climb > 0 || o.throw > 0) { o.giveWay = null; o.intent = null; if (o.ai) o.ai.think = 0; } }
    this._giving = list.filter(id => this.soldiers[id].giveWay);
    const v = Math.hypot(p.mvx || 0, p.mvz || 0) / DT;
    if (p.alive && !(p.gun >= 0) && !(p.climb > 0) && v > 0.4 && this.bump) {
      const dx = p.mvx / (v * DT), dz = p.mvz / (v * DT), nx = -dz, nz = dx, reach = 1.4 + v * 0.8, gx = Math.floor(p.x / 2), gz = Math.floor(p.z / 2);
      for (let cz = gz - 3; cz <= gz + 3; cz++) for (let cx = gx - 3; cx <= gx + 3; cx++) { const l = this.bump.get((cx << 12) | cz); if (!l) continue;
        for (const o of l) {
          if (o.isPlayer || o.side !== p.side || !o.alive || o.giveWay || o.climb > 0 || o.emerge > 0 || o.gun >= 0 || o.throw > 0 || o.strike > 0 || o.stance === 2 || Math.abs(o.y - p.y) > 1.2) continue;
          const rx = o.x - p.x, rz = o.z - p.z, along = rx * dx + rz * dz, lat = rx * nx + rz * nz;
          if (along < 0.25 || along > reach || Math.abs(lat) > 0.75) continue;
          // the spot: as far off the player's line as there is room for (his whole body clear of the wall), away from the
          // line first, the other way if that side is the wall; never onto another man
          const h0 = T.height(o.x, o.z), free = (x, z) => { for (const q of l) if (q !== o && q.alive && Math.hypot(q.x - x, q.z - z) < 0.55) return false; return true; };
          // (up onto the fire-step first, where there is one: the floor of a fire bay is a metre wide, too narrow for two
          // men side by side; else the furthest spot off the line on the floor)
          let best = null;
          for (const side of lat >= 0 ? [1, -1] : [-1, 1]) {
            let sb = null;
            for (let k = 0.95; k >= 0.3 && !sb; k -= 0.05) {
              const off = side * k - lat, tx = o.x + nx * off, tz = o.z + nz * off, ht = T.height(tx, tz);
              if (ht - h0 > STEP_UP || h0 - ht > 0.4 || this.F.wallAt(tx, tz, ht)) continue;
              let clear = true; for (let a = 0; a < 8 && clear; a++) { const c = Math.cos(a * Math.PI / 4), sn = Math.sin(a * Math.PI / 4); if (T.height(tx + c * 0.28, tz + sn * 0.28) - ht > 0.35) clear = false; }
              if (clear && free(tx, tz)) sb = { x: tx, z: tz, side, up: ht - h0 > 0.5, k };
            }
            if (sb && (!best || (sb.up && !best.up) || (sb.up === best.up && sb.k > best.k + 0.1))) best = sb;
          }
          if (!best) continue;   // (no room either side: he is shoved along as before)
          const fx = -best.side * nx, fz = -best.side * nz;   // facing the trench: back to the wall, front to the player's line
          o.giveWay = { x: best.x, z: best.z, yaw: Math.atan2(-fx, -fz), dx, dz, until: this.tick + 5 * HZ, up: T.height(best.x, best.z) - h0 > 0.5 };
          o.stance = 0; this._giving.push(o.id);
        } }
    }
    // the men giving way: a side-step (or a step up) to the spot, turned to the trench; then still while the player passes
    for (const id of this._giving) { const o = this.soldiers[id], g = o.giveWay, ex = g.x - o.x, ez = g.z - o.z, d = Math.hypot(ex, ez);
      o.yaw = g.yaw; o.stance = 0;
      if (d < 0.06) { o.intent = null; continue; }
      const sy = Math.sin(g.yaw), cy = Math.cos(g.yaw);
      o.intent = { f: (ex * -sy + ez * -cy) / d, s: (ex * cy + ez * -sy) / d, run: false, jump: false, stroll: true, yaw: g.yaw };
    }
    p.squeeze = false; for (const id of this._giving) { const o = this.soldiers[id]; if (Math.hypot(o.x - p.x, o.z - p.z) < 1.0 && Math.abs(o.y - p.y) < 0.5) p.squeeze = true; }
  }
  // no two men in one place: any two closer than 0.6 m (men standing still too) pushed apart, as far as the ground lets
  // them; near the player every 4th tick, everyone else every 30th
  _separate() {
    const p = this.player, near = this.tick % 4 === 0, all = this.tick % 30 === 0; if (!near && !all) return;
    const T = this.T, okAt = (m, x, z) => T.height(x, z) - m.y < STEP_UP && !this.F.wallAt(x, z, m.y);
    for (const [k, l] of this.bump) {
      for (let i = 0; i < l.length; i++) {
        const a = l[i]; if (!a.alive || a.climb > 0 || a.emerge > 0 || a.isPlayer) continue;
        if (!all && Math.abs(a.x - p.x) + Math.abs(a.z - p.z) > 350) continue;
        const gx = Math.floor(a.x / 2), gz = Math.floor(a.z / 2);
        for (let cz = gz - 1; cz <= gz + 1; cz++) for (let cx = gx - 1; cx <= gx + 1; cx++) { const l2 = this.bump.get((cx << 12) | cz); if (!l2) continue;
          for (const b of l2) { if (b === a || !b.alive || b.id < a.id && !b.isPlayer || b.climb > 0 || b.emerge > 0 || Math.abs(b.y - a.y) > 1.6 || (a.gun >= 0 && a.gun === b.gun)) continue;
            const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), MIN = b.isPlayer ? (a.giveWay ? (Math.abs(a.y - b.y) > 0.5 ? 0.3 : 0.45) : 0.8) : 0.6; if (d >= MIN) continue;
            const ux = d > 1e-4 ? dx / d : Math.cos(a.id), uz = d > 1e-4 ? dz / d : Math.sin(a.id), push = (MIN - d) / (b.isPlayer ? 1 : 2);
            const clearOfPlayer = (x, z) => !p.alive || Math.hypot(x - p.x, z - p.z) >= 0.8;   // (never pushed into the player)
            const ax = a.x + ux * push, az = a.z + uz * push; if (okAt(a, ax, az) && clearOfPlayer(ax, az)) { a.x = ax; a.z = az; }
            if (!b.isPlayer && !(b.gun >= 0)) { const bx = b.x - ux * push, bz2 = b.z - uz * push; if (okAt(b, bx, bz2) && clearOfPlayer(bx, bz2)) { b.x = bx; b.z = bz2; } } } }
      }
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
    const ps = this.player, lx = this.objectives.reduce((a, o) => a + o.c[0], 0) / this.objectives.length - 250, lz = this.objectives.reduce((a, o) => a + o.c[1], 0) / this.objectives.length - 100;   // (the middle of the three lines' stretches)
    // (historically ~10,000 British in 12 battalions against ~2,000 of Reserve Infantry Regiment 110 here)
    const bri = near('BRI', ps.x, ps.z, 1100), ger = near('GER', lx + 250, lz + 100, 1300);   // (the German line from north of La Boisselle down past the Scots Redoubt)
    // each man his own place on a fire-trench floor (a shuffled draw, no two on one spot)
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    // weighted toward the player's stretch of the line (density falling off over ~300 m), as the battalions went over
    // in waves of men a few paces apart; each point used once while points last
    // (the British all along the front opposite the German front line's stretches, thickest round the player)
    const dA = new Map(); for (const p of bri) { let d = 1e9; for (const o of this.objectives) if (o.line === 'A') d = Math.min(d, this._dObj(o, p[0], p[1])); dA.set(p, d); }
    const weighted = (pts, cx, cz, n, fall) => { const pool = pts.slice(), out = [];
      while (out.length < n && pool.length) { let tot = 0; const w = pool.map(p => { const v = Math.exp(-dA.get(p) / 220) * (0.45 + Math.exp(-Math.hypot(p[0] - cx, p[1] - cz) / fall)) + 0.02; tot += v; return v; });
        let x = r() * tot, i = 0; while (i < pool.length - 1 && (x -= w[i]) > 0) i++; out.push(pool[i]); pool.splice(i, 1);
        if (out.length % 64 === 0 && pool.length > 4000) pool.splice(0, 0); }
      while (out.length < n) out.push(pts[out.length % pts.length]); return out; };
    const briPts = weighted(bri, ps.x, ps.z, Math.ceil(nb / 3), 230);   // (packed close on the player's stretch, as the battalions were)
    // the German garrison: the front line (A) thickest, the support line (B) a little less, the reserve line (C) less again,
    // along the stretches under attack; the front line either side of them held thinly, the odd fragment of trench barely
    const lineOf = p => { const ln = this.T.segs[p[2]].line; return !ln ? null : this.objectives.some(o => o.line === ln && this._dObj(o, p[0], p[1]) < 15) ? ln : 'flank'; };
    const W8 = { A: 1, B: 0.9, C: 0.7, flank: 0.12 };
    // (in the order drawn: the weighted bays come first and are the ones filled; shuffling them threw the weighting away)
    const gerPts = ((() => { const pool = ger.slice(), w = pool.map(p => W8[lineOf(p)] ?? 0.006), out = []; while (out.length < ng && pool.length) { let tot = 0; for (const v of w) tot += v; let x = r() * tot, i = 0; while (i < pool.length - 1 && (x -= w[i]) > 0) i++; out.push(pool[i]); pool.splice(i, 1); w.splice(i, 1); } return out; })());
    // the British: three in four in the front and support trenches (waves 0-3); the rest, the Tyneside Irish, on the
    // Tara-Usna line a mile back, who go forward at zero hour too and have the whole way to cross
    const RES = this.map.reserves || {}, nLine = RES.BRI ? Math.floor(nb * 0.25) : 0;
    // packed along the bays as the battalions were before zero: up to a man every 1.3 m of each bay, the bays nearest the
    // player's stretch filled first (weighted), never two men on one spot
    { let i = 0; const want = nb - nLine;
      for (let k = 0; i < want && k < briPts.length * 3; k++) {
        const bay = briPts[k % briPts.length], L = this.T.segs[bay[2]].len, n = Math.min(want - i, Math.max(1, Math.floor((L - 1) / 1.3)), k < briPts.length ? 6 : 2);
        for (const q of this._clusterIn(bay, n, r)) { const [x, z] = this._freeSpot(q[0], q[1]); const s = this._spawn('BRI', x, z); s.ai.wave = i % 4; s.stance = 1; s.ai.cover = s.rng() < 0.1; i++; }
      } }
    for (let i = 0; i < nLine; i++) { const c = RES.BRI.line[i % RES.BRI.line.length], q = this._freeSpot(c[0] + r.range(-140, 140), c[1] + r.range(-140, 140)); const s = this._spawn('BRI', q[0], q[1]); s.ai.wave = 1 + (i % 2); s.stance = 1; s.ai.cover = s.rng() < 0.1; }
    // machine guns: the known posts, then more spread along the German front system opposite the attack
    const mgAt = this.map.mgs.slice(), front = ger.filter(p => this.T.segs[p[2]].kind === 0);
    for (let k = 0; mgAt.length < this.nMG && front.length && k < 200; k++) { const p = front[Math.floor((k * 0.618034 % 1) * front.length)]; if (mgAt.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 70)) mgAt.push([p[0], p[1]]); }
    // (a post with no workable site is passed over for the next point along the front)
    { let made = 0; for (const m of mgAt) { if (made >= this.nMG) break; if (this.guns.some(g => Math.hypot(g.x - m[0], g.z - m[1]) < 40)) continue; if (this._makeGun('mg08', 'GER', m[0], m[1])) made++; }
      for (let k = 0; made < this.nMG && front.length && k < 400; k++) { const p = front[Math.floor((k * 0.381966 % 1) * front.length)]; if (this.guns.some(g => Math.hypot(g.x - p[0], g.z - p[1]) < 70)) continue; if (this._makeGun('mg08', 'GER', p[0], p[1])) made++; } }
    // and three Vickers in the British front line opposite the attack, to fire on the German parapet
    { const bf = this.trenchPts.BRI.filter(p => this.T.segs[p[2]].kind === 0 && Math.hypot(p[0] - ps.x, p[1] - ps.z) < 700), at = [];
      for (let k = 0; at.length < 3 && k < bf.length * 2; k++) { const q = bf[Math.floor((k * 0.618034 % 1) * bf.length)]; if (at.every(a => Math.hypot(a[0] - q[0], a[1] - q[1]) > 150) && Math.hypot(q[0] - ps.x, q[1] - ps.z) > 25 && this._makeGun('vickers', 'BRI', q[0], q[1])) at.push(q); } }   // (a post with no view out is passed over)
    // the garrison in clusters along the line: a quarter of the bays empty, others with one to five men, spread along the step
    { const SIZES = [0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6];   // (few bays empty)
      let i = this.soldiers.filter(s => s.side === 'GER').length;
      for (let k = 0; i < ng && gerPts.length; k++) {
        const bay = gerPts[k % gerPts.length], n = Math.min(ng - i, k < gerPts.length ? SIZES[r.int(SIZES.length)] : 1 + r.int(3));
        for (const q of this._clusterIn(bay, n, r)) { const s = this._spawn('GER', q[0], q[1]); s.stance = 1; s.ai.mode = 'shelter'; s.ai.post = [q[2], q[3]]; this._trenchStyle(s, bay[2], q); i++; }
      } }
    for (const s of this.soldiers) if (s.role === 'mg') s.ai.mode = 'shelter';
    // (no man left standing where a gun's crew was put after him: he moves to a free spot beside it)
    { const crews = this.soldiers.filter(c => c.gun >= 0);
      for (const m of this.soldiers) { if (m.gun >= 0 || m.isPlayer) continue;
        if (!crews.some(c => Math.abs(c.x - m.x) < 0.8 && Math.abs(c.z - m.z) < 0.8 && Math.hypot(c.x - m.x, c.z - m.z) < 0.75)) continue;
        for (const o of this.soldiers) if (o !== m && Math.abs(o.x - m.x) < 4 && Math.abs(o.z - m.z) < 4) this._placed.push([o.x, o.z]);
        const q = this._freeSpot(m.x, m.z); m.x = q[0]; m.z = q[1]; m.y = this.T.height(q[0], q[1]); if (m.ai) m.ai.post = q.slice(); this._placed.length = 0; } }
    // the German immediate reserve: ~70 men under cover in the intermediate line, ~1,000 yards back
    if (RES.GER) { const n = Math.min(70, Math.floor(ng * 0.18));
      for (let i = 0; i < n; i++) { const c = RES.GER.ready[i % RES.GER.ready.length], q = this._freeSpot(c[0] + r.range(-35, 35), c[1] + r.range(-35, 35)); const s = this._spawn('GER', q[0], q[1]); s.stance = 1; s.ai.mode = 'reserve'; s.ai.ready = i % RES.GER.ready.length; s.ai.post = q; } }
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
    this._buildGrid(); this._placed.length = 0;
    this._player(p, input);
    this._giveWay();
    for (const s of this.soldiers) if (!s.isPlayer && s.alive) this._think(s);
    this._guns();
    // (men over 350 m from the player, on firm ground and not climbing or coming up a dugout, move every other tick)
    { const p0 = this.player; for (const s of this.soldiers) { if (!s.alive) continue;
      if (!s.isPlayer && s.onGround && !(s.climb > 0) && !(s.emerge > 0) && Math.abs(s.x - p0.x) + Math.abs(s.z - p0.z) > 350) { if ((this.tick + s.id) % 2) continue; this._move(s, 2); }
      else this._move(s); } }
    this._director();
    this._objectives();
    this._respawns(input);
    this._hq();
    this._separate();
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
    if (p.gun >= 0) {   // on a machine gun: traverse it (all the way round), the trigger, R a fresh belt, E to leave it
      const gun = this.guns[p.gun];
      if (!gun || gun.gunner !== p.id || a.pickup) { if (gun) this._dismount(p); else p.gun = -1; this._weaponTick(p); return; }
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
    if (s.giveWay) return;   // stepping aside for the player (_giveWay moves him)
    if (--ai.think > 0) { this._aimAndFire(s); return; }
    ai.think = (Math.abs(s.x - this.player.x) + Math.abs(s.z - this.player.z) > 350 ? 60 + s.rng.int(30) : 20 + s.rng.int(20));   // far from the player: thinks a third as often
    // before the barrage lifts, the Germans shelter in their deep dugouts (they come up when it lifts: the race for the parapet)
    if (ai.mode === 'shelter') { s.stance = 1; s.intent = null; if (t >= ZERO + s.rng.range(2, 8)) ai.mode = s.role === 'mg' ? 'mg' : 'hold'; return; }   // (up the dugout stairs within seconds of the barrage lifting: the race for the parapet)
    // in reserve (under cover in the intermediate line) or forming up behind the lines: waiting on HQ, unless the enemy is on them
    if (ai.mode === 'reserve' || ai.mode === 'muster') { s.intent = null; s.stance = 1; if (this._enemyNear(s, 60)) { ai.mode = 'hold'; ai.style = null; ai.post = [s.x, s.z]; } else return; }
    // British: wait in the trench for zero hour and their wave, then go over the top and walk forward
    if (s.side === 'BRI' && ai.mode === 'hold' && !ai.goal) {
      if (t >= ZERO + ai.wave * 0.8 + s.rng.range(0, 1.5))   /* (everyone goes at the whistles, within a couple of seconds of each other: no waiting for a later wave) */ { ai.mode = 'advance'; ai.goal = this._goalFor(s); s.stance = 0; }
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
    if (best >= 0) { ai.seen = this.tick;
      if (ai.mode === 'march' && bd > 40 && s.rng() < 0.25) ai.fireUntil = this.tick + 60 + s.rng.int(120);
      // the attack: a covering-fire man (one in ten), with the enemy in sight, goes down where he is (prone or kneeling) and
      // fires for 20-40 s before charging himself; the rest keep running
      if (ai.mode === 'advance' && ai.cover && !ai.coverDone && bd < 220 && bd > 25) { ai.coverDone = true; ai.fireUntil = this.tick + (20 + s.rng.int(20)) * HZ; ai.coverStance = s.rng() < 0.5 ? 2 : 1; } }
    if (s.mag === 0 && !s.reloading) this._startReload(s);
    // movement intent
    if (ai.mode === 'advance' && ai.goal) {
      const dx = ai.goal[0] - s.x, dz = ai.goal[1] - s.z, d = Math.hypot(dx, dz);
      if (d < 6) { const o = ai.counter >= 0 && ai.counter !== undefined ? this.objectives[ai.counter] : null; ai.goal = o ? this._alongObj(o, s.rng, this._nearObj(o, s.x, s.z).t, 60) : this._goalFor(s, true); }   // (a counter-attack keeps to its stretch of trench)
      const firing = this.tick < ai.fireUntil;
      if (this.tick < s.pinned && (ai.cover || s.id % 4 === 0)) {   // machine-gun fire cracking past (the covering men and one in four of the rest): down flat, crawling on now and then; then up and a rush forward
        s.stance = 2; ai.rushUntil = s.pinned + 150 + s.rng.int(120);
        s.intent = s.rng() < 0.45 ? { f: 1, s: 0, run: false, jump: false, yaw: this._wireDetour(s, Math.atan2(-dx, -dz)) } : null; return;
      }
      s.stance = firing ? (ai.coverStance || 1) : 0;
      // (a covering man on the British side waits for his moment; everyone else sprints, a German counter-attack too)
      if (!firing && ai.cover && !ai.coverDone && s.side === 'BRI' && d < 120) { ai.coverDone = true; ai.fireUntil = this.tick + (20 + s.rng.int(20)) * HZ; ai.coverStance = s.rng() < 0.5 ? 2 : 1; }
      s.intent = firing ? null : { f: 1, s: 0, run: true, jump: true, yaw: this._wireDetour(s, Math.atan2(-dx, -dz)) + s.rng.range(-0.15, 0.15) };
    } else if (ai.mode === 'march' && ai.route) {
      this._march(s, best, bd);
    } else if (ai.mode === 'hold' && s.side === 'GER' && ai.style === 'open') {
      // an open post in the shell holes round a strongpoint: down (prone or kneeling), facing the threat, firing
      const dx = ai.post[0] - s.x, dz = ai.post[1] - s.z, d = Math.hypot(dx, dz);
      s.stance = d > 1 ? 0 : (s.id % 3 ? 2 : 1); s.intent = d > 1 ? { f: 1, s: 0, run: false, jump: true, yaw: Math.atan2(-dx, -dz) } : null;
      if (!s.intent && !(ai.target >= 0) && ai.face !== undefined) s.yaw = ai.face;
    } else if (ai.mode === 'hold' && s.side === 'GER' && ai.style) {
      this._trenchWork(s, best, bd);
    } else if (ai.mode === 'hold' || ai.mode === 'mg') {
      // German defenders man the fire-step: stand to fire, duck to reload
      s.stance = s.reloading || this.tick < s.pinned ? 1 : 0;
      const dx = ai.post[0] - s.x, dz = ai.post[1] - s.z, d = Math.hypot(dx, dz);
      s.intent = d > 3 ? { f: 1, s: 0, run: false, jump: false, yaw: Math.atan2(-dx, -dz) } : null;
      if (s.side === 'GER' && s.role !== 'mg' && this._enemyNear(s, 25) && s.rng() < 0.05) ai.mode = 'hold';
    }
  }
  _goalFor(s, next = false) {
    // a stretch of trench his side is going for (the lines in order): of those not much further than the nearest, his
    // own (men spread over them, not all to the nearest), struck where he meets it with some spread along it so they
    // don't all walk one file; once in it, clearing it: along the trench at the nearest enemy still in it
    const objs = this._wanted(s.side), ai = s.ai;
    if (!objs.length) return null;
    const near = objs.map(o => [this._nearObj(o, s.x, s.z), o]), dmin = Math.min(...near.map(n => n[0].d));
    const cand = near.filter(n => n[0].d < dmin + 350), [q, o] = near.find(n => n[0].d < 25) || cand[s.id % cand.length];
    if (q.d < 25) {
      // (the man he is after: kept while he lives and is in the stretch; looked for again every 2 s at most)
      let f = ai.hunt >= 0 ? this.soldiers[ai.hunt] : null;
      if (!f || !f.alive || this._dObj(o, f.x, f.z) >= o.r) { f = null;
        if (this.tick >= (ai.huntAt || 0)) { ai.huntAt = this.tick + 2 * HZ; let fd = 1e9;
          for (const g of this.soldiers) { if (!g.alive || g.side === s.side || g.emerge > 0) continue; const dd = Math.abs(g.x - s.x) + Math.abs(g.z - s.z); if (dd < fd && this._dObj(o, g.x, g.z) < o.r) { fd = dd; f = g; } } } }   // (however far along it he is)
      ai.hunt = f ? f.id : -1;
      if (f) { const dx = f.x - s.x, dz = f.z - s.z, L = Math.hypot(dx, dz) || 1, k = Math.max(0, L - 1.5) / L; return [s.x + dx * k, s.z + dz * k]; }   // (to arm's length: the steel or the bomb does the rest)
      return this._alongObj(o, s.rng, q.t, 80);
    }
    return this._alongObj(o, s.rng, q.t, 70);
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
    if (ai.style === 'popup' && !ai.up && !(this.tick < (ai.alertUntil || 0))) return;   // (ducked below the parapet)
    if (ai.style === 'wait' && ai.target >= 0 && Math.hypot(this.soldiers[ai.target].x - s.x, this.soldiers[ai.target].z - s.z) > 25) return;   // (holding his fire for whoever comes down into the trench)
    // within reach of an enemy and choosing the steel: strike (any enemy, not only his target: a man jumping in on him)
    const startled = this.tick < (ai.reactUntil || 0);
    if (ai.closeIn && !startled && this.tick % 3 === s.id % 3) { const o = this._nearestFoe(s, REACH * 0.95); if (o) { const want = Math.atan2(-(o.x - s.x), -(o.z - s.z)); if (Math.abs(wrapAngle(want - s.yaw)) < 0.6) { s.yaw = want; this._startStrike(s); return; } } }
    if (ai.target < 0) return;
    if ((ai.mode === 'advance' || ai.mode === 'march') && this.tick >= ai.fireUntil && s.rng() > 0.004) return;   // on the move, rifle at the port
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
    if (s.side !== this.player.side && o.isPlayer) {   // (the forgiving model is for shots at the player only; at other men, aimed fire as the British have)
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
    s.mag--; s.cool = W.cycle; if (s.isPlayer) this.stats.player.shots++;
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
    if (victim) { if (s.isPlayer && victim.side !== s.side) this.stats.player.hits++; this._damage(victim, bulletDamage(W, zone, s.rng), s, { dir: [dx, dy, dz], zone, point: [hx, hy, hz], kind: 'bullet' }); }
    return true;
  }
  // a throw: the bomb out and the pin pulled, the overhand throw, released at THROW_RELEASE; the player throws where he
  // is looking at release (he can still aim through the wind-up), the AI where he chose when he started
  _startThrow(s, power, aim = null) {
    if (!(s.grenades > 0) || s.throw > 0 || s.climb > 0 || s.strike > 0 || s.pickup > 0 || s.reloading > 0) return false;
    s.grenades--; if (s.isPlayer) this.stats.player.bombs++; s.throw = THROW_TICKS; s.throwPow = power; s.throwAim = aim;
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
  // reach), never with a man of his own side near where it would land, and never at one of his own side's machine guns, even
// with the enemy on it (it is wanted back: the gun is worth more than its crew); the enemy's own guns are fair game
  _ownGunNear(s, x, z, r = 6) { for (const g of this.guns) if (GUNS[g.kind].side === s.side && Math.abs(g.x - x) < r && Math.abs(g.z - z) < r && Math.hypot(g.x - x, g.z - z) < r) return true; return false; }
  _considerThrow(s, cand, best) {
    const ai = s.ai;
    if (!(s.grenades > 0) || s.throw > 0 || s.climb > 0 || s.reloading > 0 || s.gun >= 0 || this.tick < (ai.nadeAt || 0)) return false;
    if (s.rng() > 0.3) return false;   // (cheap first: most thinks never get further)
    cand = cand.slice(0, 12).sort((a, b) => (b[1].gun >= 0 && b[0] < 45 ? 1 : 0) - (a[1].gun >= 0 && a[0] < 45 ? 1 : 0) || a[0] - b[0]);
    for (let i = 0; i < Math.min(6, cand.length); i++) {
      const o = cand[i][1]; if (!o.alive || cand[i][0] < 10) continue; if (cand[i][0] > 45) return false;
      const d = Math.hypot(o.x - s.x, o.z - s.z); if (d < 10 || d > 32) continue;   // (closer than 10 m: the steel)
      if (this._ownGunNear(s, o.x, o.z)) continue;   // (our gun, taken: to be retaken with the rifle and the bayonet)
      const hidden = this.T.inTrench(o.x, o.z) || o.id !== best || o.gun >= 0;   // (a gun crew above all)
      if (s.rng() > (hidden ? 1 : s.side === 'GER' ? 0.5 : 0.27)) return false;   // (x 0.3 above: 0.3, 0.15, 0.08)
      const err = 1 + d * 0.06, tx = o.x + s.rng.gauss() * err, tz = o.z + s.rng.gauss() * err;
      if (this._friendNear(s, tx, tz, 7) || this._ownGunNear(s, tx, tz)) return false;
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
    if (src && src.side !== v.side) { src.kills++; this.score[src.side].kills++;
      const how = info.mg ? 'mg' : info.kind === 'bullet' ? 'rifle' : info.kind === 'melee' ? 'steel' : info.kind === 'grenade' ? 'bombs' : info.kind === 'mine' ? 'mines' : 'shells';
      this.stats.kills[src.side][how] = (this.stats.kills[src.side][how] || 0) + 1;
      if (src.isPlayer) { if (how === 'steel') this.stats.player.steel++; if (how === 'mg') this.stats.player.mg++; } }
    else if (!src && info) { const how = info.kind === 'mine' ? 'mines' : info.kind === 'gaveup' || info.kind === 'fall' ? 'other' : 'shells'; const by = v.side === 'BRI' ? 'GER' : 'BRI'; if (how !== 'other') this.stats.kills[by][how] = (this.stats.kills[by][how] || 0) + 1; }
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
  _move(s, k = 1) {   // (k: ticks this step covers; men far from the player move every other tick, a double step)
    const DTm = DT * k;
    if (s.emerge > 0) { this._emerge(s); return; }
    const T = this.T, I = s.intent;
    if (s.climb > 0) {          // scrambling up a trench wall or over the parapet
      s.climb -= DTm;
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
      sp = s.stance === 2 ? SPEED.prone : s.stance === 1 ? SPEED.crouch : run ? SPEED.run : s.isPlayer ? SPEED.walk : I.stroll ? SPEED.stroll : I.march ? SPEED.march : SPEED.advance;
      if (run) s.stamina = Math.max(0, s.stamina - DTm / (s.isPlayer ? 14 : 45)); else s.stamina = Math.min(1, s.stamina + DTm / 9);
      const f = I.f, sd = I.s, L = Math.hypot(f, sd) || 1, sy = Math.sin(s.yaw), cy = Math.cos(s.yaw);
      mx = (-sy * f + cy * sd) / L; mz = (-cy * f - sy * sd) / L;
      if (s.isPlayer || (this.tick + s.id) % 6 === 0) s.wire = this.F.wireAt(s.x, s.z);   // AI: every sixth tick is enough
      if (s.wire > 0) sp *= 1 - s.wire * 0.78;
      if (s.isPlayer && s.squeeze) sp *= 0.55;   // squeezing past a man pressed to the trench wall
      // walking up a steep crater side is slow (the ground under him is known from last tick)
      const ahead = T.height(s.x + mx * 0.6, s.z + mz * 0.6) - (s.gh ?? s.y); if (ahead > 0.15) sp *= Math.max(0.45, 1 - ahead * 0.8);
    } else s.stamina = Math.min(1, s.stamina + DTm / 7);
    const nx = s.x + mx * sp * DTm, nz = s.z + mz * sp * DTm, x0 = s.x, z0 = s.z;
    const lim = [5, this.T.size - 5], R = 0.3;
    // a man is a 0.3 m circle: he can't move into ground that rises more than a step anywhere ahead of him on that circle
    // (only the leading side blocks, so a man pressed against a wall can always step away from it)
    const pd = s.isPlayer ? 0 : Math.abs(s.x - this.player.x) + Math.abs(s.z - this.player.z), far = pd > 350, mid = pd > 120;   // simulation level of detail: near (full), mid (lighter), far (one probe)
    const ok = (x, z, dx, dz) => {
      if (x < lim[0] || z < lim[0] || x > lim[1] || z > lim[1]) return false;
      if (far) { const L = Math.hypot(dx, dz) || 1; return !(T.height(x + dx / L * 0.3, z + dz / L * 0.3) - s.y > (s.onGround ? STEP_UP : 0.02)); }   // far away: one probe ahead
      const L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
      // the player is probed on 16 rays at two radii, so a sharp wall corner can't slip between probes; AI on 8
      const n = s.isPlayer ? 16 : mid ? 4 : 6, lim2 = s.onGround ? STEP_UP : 0.02;   // in the air he can't pass into anything above his feet (mid-distance: 4 rays, the 3 ahead)
      for (let k = 0; k < n; k++) {
        const a = k * Math.PI * 2 / n, cx = Math.cos(a), cz = Math.sin(a);
        if (cx * ux + cz * uz < 0.1) continue;
        if (T.height(x + cx * R, z + cz * R) - s.y > lim2) return false;
        if (s.isPlayer && T.height(x + cx * R * 0.6, z + cz * R * 0.6) - s.y > lim2) return false;
      }
      return !this.F.wallAt(x, z, s.y);
    };
    if (sp > 0) {
      const dx = mx * sp * DTm, dz = mz * sp * DTm;
      if (ok(nx, nz, dx, dz)) { s.x = nx; s.z = nz; }
      else if (Math.abs(dx) > 1e-5 && ok(nx, s.z, dx, 0)) s.x = nx;
      else if (Math.abs(dz) > 1e-5 && ok(s.x, nz, 0, dz)) s.z = nz;
      else if (I.jump && s.onGround) this._tryClimb(s, mx, mz);
    }
    const moved = s.x !== x0 || s.z !== z0 || !s.onGround;
    if (s.isPlayer) { s.mvx = s.x - x0; s.mvz = s.z - z0; }
    // vertical: follow the ground, fall into trenches and shell holes
    const gh = T.height(s.x, s.z); s.gh = gh;
    if (I && I.jump && s.onGround && s.isPlayer && sp === 0) { s.vy = 3.6; s.onGround = false; }
    if (I && I.jump && s.onGround && s.isPlayer && sp > 0 && gh - s.y < 0.1) { /* jumping while walking: a hop */ s.vy = 3.6; s.onGround = false; }
    s.vy -= G * DTm; s.y += s.vy * DTm;
    if (s.y <= gh) { if (!s.onGround && s.vy < -9) this._damage(s, (-s.vy - 9) * 18, null, { dir: [0, -1, 0], zone: 'legs', point: [s.x, s.y, s.z], kind: 'fall' }); s.y = gh; s.vy = 0; s.onGround = true; }
    else if (s.y - gh > 0.3 || s.vy > 0) s.onGround = false; else { s.y = gh; s.vy = 0; s.onGround = true; }   // rising (a jump) is never snapped back down
    if (!far && (!s.onGround || (moved && (s.isPlayer || (this.tick + s.id) % (mid ? 6 : 3) === 0)))) this._depenetrate(s);   // AI checked every third tick; far men not at all   // after the fall step, so a man dropping in beside a wall is pushed clear the same tick
    // other men are solid: a man is a body ~0.3 m across and can't walk into another; around the player the gap is 0.8 m
    // (his rifle and arms reach ahead of him). An AI man always gives way to the player; otherwise the mover backs out.
    if (!s.climb && !far && (!mid || (this.tick + s.id) % 2 === 0) && (s.isPlayer || s.x !== x0 || s.z !== z0 || moved)) {   // after the wall push-out, so nothing undoes it
      const okAt = (m, x, z) => x > 5 && z > 5 && x < T.size - 5 && z < T.size - 5 && T.height(x, z) - m.y < STEP_UP && !this.F.wallAt(x, z, m.y);
      const gx = Math.floor(s.x / 2), gz = Math.floor(s.z / 2);
      for (let cz = gz - 1; cz <= gz + 1; cz++) for (let cx = gx - 1; cx <= gx + 1; cx++) {
        const l = this.bump && this.bump.get((cx << 12) | cz); if (!l) continue;
        for (const o of l) {
          if (o === s || !o.alive || (o.climb > 0 && !s.isPlayer) || Math.abs(o.y - s.y) > 1.6) continue;   // (a man climbing out is solid to the player, who backs off: he isn't pulled off the wall)
          const gw = (s.isPlayer && o.giveWay) || (o.isPlayer && s.giveWay), MIN = gw ? (Math.abs(o.y - s.y) > 0.5 ? 0.3 : 0.45) : s.isPlayer || o.isPlayer ? 0.8 : 0.6, dx = s.x - o.x, dz = s.z - o.z, d = Math.hypot(dx, dz);   // (a man pressed to the wall for him: the player squeezes by)
          if (d >= MIN) continue;
          let ux = dx, uz = dz; if (d < 1e-4) { ux = x0 - s.x; uz = z0 - s.z; if (Math.hypot(ux, uz) < 1e-6) { ux = Math.cos(o.id); uz = Math.sin(o.id); } }
          const L = Math.hypot(ux, uz); ux /= L; uz /= L;
          if (s.isPlayer && !o.isPlayer && !(o.climb > 0) && !o.giveWay) {   // the AI man steps aside (or, if he can't, the player stops)
            const ox = s.x - ux * MIN, oz = s.z - uz * MIN;
            if (okAt(o, ox, oz)) { o.x = ox; o.z = oz; o.y = Math.max(o.y, T.height(ox, oz)); continue; }
          }
          const nx2 = o.x + ux * MIN, nz2 = o.z + uz * MIN;
          if (okAt(s, nx2, nz2)) { s.x = nx2; s.z = nz2; } else if (Math.hypot(x0 - o.x, z0 - o.z) > d) { s.x = x0; s.z = z0; }
          // still pressed together against a wall (the player dropping in beside him): the AI man steps off whichever way is clear
          if ((s.isPlayer || o.isPlayer) && Math.hypot(s.x - o.x, s.z - o.z) < MIN) {
            const pl = s.isPlayer ? s : o, ai = s.isPlayer ? o : s;
            if (!(ai.climb > 0) && !ai.giveWay) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + ai.id, ax = pl.x + Math.cos(a) * MIN, az = pl.z + Math.sin(a) * MIN; if (okAt(ai, ax, az)) { ai.x = ax; ai.z = az; ai.y = Math.max(ai.y, T.height(ax, az)); break; } }
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
        for (const r of [R, R * 0.6]) if (T.height(s.x + cx * r, s.z + cz * r) - s.y > STEP_UP) { px -= cx * (R - r + 0.05); pz -= cz * (R - r + 0.05); hit++; break; }
      }
      if (!hit) return;
      const L = Math.hypot(px, pz); if (L < 1e-6) return;
      const step = Math.min(s.onGround ? 0.06 : 0.12, L / hit + 0.01), nx = s.x + px / L * step, nz = s.z + pz / L * step;
      if (s.onGround && T.height(nx, nz) - s.y > STEP_UP) return;   // nowhere better to go (falling, he is always pushed clear)
      s.x = nx; s.z = nz;
    }
  }
  // climb the wall ahead: its top no more than maxH above his feet, the wall starting within reach, somewhere to stand beyond
  _tryClimb(s, mx, mz, maxH = 3.6, reach = 3.3) {
    const T = this.T;
    let start = -1;
    for (let d = 0.3; d <= reach + 2.2; d += 0.15) {
      const x = s.x + mx * d, z = s.z + mz * d, h = T.height(x, z);
      if (h - s.y < STEP_UP) { start = -1; continue; }   // below a step (or back down off a fire-step): keep looking
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
    // the end: the British holding all three lines (every stretch of A, B and C) at once win; the British with no one left
    // to send have lost (and so the Germans, the other way)
    if (!this.over && this.flags.zero) {
      const held = this.objectives.every(o => o.owner === 'BRI');
      const end = held ? { winner: 'BRI', reason: 'The British have taken and hold the German front, support and reserve lines' }
        : this.tally('BRI').left <= 0 ? { winner: 'GER', reason: 'The British have no one left to send' }
        : this.tally('GER').left <= 0 ? { winner: 'BRI', reason: 'The German garrison is gone' } : null;
      if (end) { this.over = { ...end, at: this.clock() }; this.events.push({ t: 'gameover', ...this.over }); }
    }
    // who is in each stretch of trench (within its r of the trench line)
    for (const o of this.objectives) { o.b = 0; o.g = 0; if (!o.box) { const xs = o.pts.map(q => q[0]), zs = o.pts.map(q => q[1]); o.box = [Math.min(...xs) - o.r, Math.min(...zs) - o.r, Math.max(...xs) + o.r, Math.max(...zs) + o.r]; } }
    for (const s of this.soldiers) {
      if (!s.alive || s.emerge > 0) continue;
      for (const o of this.objectives) { const B = o.box; if (s.x < B[0] || s.x > B[2] || s.z < B[1] || s.z > B[3] || this._dObj(o, s.x, s.z) >= o.r) continue; if (s.side === 'BRI') o.b++; else o.g++; break; }
    }
    const before = Object.fromEntries(this.lines.map(L => [L.id, this.lineHeld(L.id)]));
    for (const o of this.objectives) {
      // taking a stretch means clearing it: British in it (three or more) and not one German left, for about 40 s (from German hands); and
      // only once the line in front is wholly British (the lines are taken in order). The Germans win it back the same
      // way, faster (they know it). Contested, it stays as it is; empty, it drifts back to whoever holds it.
      const li = this.lines.findIndex(L => L.id === o.line), open = li === 0 || this.lineHeld(this.lines[li - 1].id), b = o.b, g = o.g, old = o.progress;
      if (b >= 3 && g === 0) { if (open || o.progress < 0) o.progress = Math.min(open ? 1 : 0, o.progress + 1 / 40); }
      else if (g > 0 && b === 0) o.progress = Math.max(-1, o.progress - 1 / 30);
      else if (!b && !g) o.progress += (o.owner === 'BRI' ? 1 : -1) * (1 / 240) * (o.progress > -1 && o.progress < 1 ? 1 : 0);
      o.progress = Math.max(-1, Math.min(1, o.progress)); if (o.progress === old) continue;
      const owner = o.progress >= 1 ? 'BRI' : o.progress <= -1 ? 'GER' : o.owner;
      if (owner !== o.owner) { o.owner = owner; this.events.push({ t: 'captured', id: o.id, name: o.name, line: o.line, lineName: o.lineName, side: owner }); this.stats.captures.push({ at: this.clock(), id: o.id, name: o.name, side: owner }); }
    }
    // a whole line taken (or lost again)
    for (const L of this.lines) { const now = this.lineHeld(L.id); if (now !== before[L.id]) this.events.push({ t: 'line', id: L.id, name: L.name, side: now ? 'BRI' : 'GER' }); }
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
    const near = l => l.length ? l.reduce((b, o) => this._dObj(o, x, z) < this._dObj(b, x, z) ? o : b) : null;
    return near(this._wanted(side)) || near(this.objectives);
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
  // line). Each time a fresh cluster: men of his side round the objective he is attacking (within 450 m of it, wider if
  // there are too few), one of them at random as its seed and his 9 nearest comrades; one of those 10 at random, never one
  // of the last six he has been (so it can't flick back and forth between two men), never one about to be overrun.
  switchCandidates(p) {
    const g = this.target(p.side, p.x, p.z), gx = g ? g.c[0] : p.x, gz = g ? g.c[1] : p.z, recent = p.switchHist || [];
    const mine = this.soldiers.filter(o => o.alive && !o.isPlayer && o.side === p.side && !(o.climb > 0) && !(o.emerge > 0) && !(o.gun >= 0) && !(o.throw > 0) && !(o.strike > 0) && !recent.includes(o.id));
    let pool = [];
    for (const R of [450, 900, Infinity]) { pool = mine.filter(o => Math.hypot(o.x - gx, o.z - gz) < R); if (pool.length >= 10) break; }
    if (!pool.length) return [];
    // the seed: of four dozen men drawn at random, one of the four with his nine nearest comrades closest round him (a
    // real knot of men, not a straggler and whoever happens to be nearest him)
    const near10 = c => pool.map(o => [Math.hypot(o.x - c.x, o.z - c.z), o]).sort((a, b) => a[0] - b[0] || a[1].id - b[1].id).slice(0, 10);
    const tries = []; for (let i = 0; i < Math.min(48, pool.length); i++) { const c = pool[p.rng.int(pool.length)], n = near10(c); tries.push([n[n.length - 1][0], c]); }
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
        pick = fwd.length ? r.pick(fwd) : rear.length ? r.pick(rear) : r.pick(pts); if (pick.name !== 'Trench') this.fwd[s.side + pick.name] = (this.fwd[s.side + pick.name] || 0) - 1;
        // the rest come from behind: the British from the Tara-Usna line (and, later, Albert and Becourt Wood), the
        // Germans from the second position, in sections HQ sends up (docs/RESERVES.md)
        if (pick.name === 'Trench' && this.map.reserves) return this._fromRear(s); }
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
      if (near.length) { const b = near[r.int(near.length)], q = this._alongBay(b, r.range(-6, 6)); x = q[2]; z = q[3]; s.ai.newStyle = [b[2], q]; }
      else { const a = r() * Math.PI * 2, d = 4 + r() * 26; x += Math.cos(a) * d; z += Math.sin(a) * d; }   // (no trench there, a village strongpoint: spread through it, not all on its centre)
    } else { const snap = this._snapToTrench(x + r.range(-25, 25), z + r.range(-25, 25), s.side, 60, s.isPlayer || s.side === 'GER'); if (snap) [x, z] = snap; }
    if (s.isPlayer) s.weapon = s.side === 'BRI' ? 'smle' : 'g98';   // (a fresh man has his own rifle again)
    Object.assign(s, { x, z, y: this.T.height(x, z), vy: 0, hp: 100, alive: true, climb: 0, climbTo: null, stance: 1, stamina: 1, pickup: 0,
      mag: WEAPONS[s.weapon].mag, reserve: WEAPONS[s.weapon].reserve, reloading: 0, cool: 0, grenades: 3, throw: 0, lastHit: null, emerge: 0, emergeAt: null, gun: -1, gunRole: null, pinned: 0, role: s.role === 'mg' ? 'rifle' : s.role });
    if (s.ai) Object.assign(s.ai, { mode: s.side === 'BRI' ? 'advance' : s.role === 'mg' ? 'mg' : 'hold', target: -1, goal: null, post: [x, z], think: 30 + r.int(60), style: null, route: null, up: false, alertUntil: 0 });
    if (s.ai && s.ai.newStyle) { this._trenchStyle(s, s.ai.newStyle[0], s.ai.newStyle[1]); s.ai.newStyle = null; }
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
      objectives: this.objectives.map(o => ({ id: o.id, line: o.line, name: o.name, owner: o.owner, progress: +o.progress.toFixed(2), b: o.b || 0, g: o.g || 0 })),
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
