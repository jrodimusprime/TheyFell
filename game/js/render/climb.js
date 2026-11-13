// Climbing out of a trench (or up a shell-hole side): a procedural, height-adaptive climb, cosmetic only.
// The simulation keeps a man at the bottom for the climb's duration and then puts him on top; this works out, for any
// moment of the climb, where his hips are, how far he leans, and where his hands and boots are planted on the real
// ground (fire-step, a foothold in the revetment, the lip, the top), so the skinned soldier, the far figures and the
// player's camera all follow one path.
//
// A wall (a revetted trench side, near vertical):
//   step up  - from the trench floor onto the fire-step, if there is one in front of the wall
//   reach    - rifle slung, both hands up onto the parapet
//   hoist    - a boot into the revetment, a spring, the body hauled up the wall
//   press    - arms straight, chest over the parapet
//   knee     - a knee onto the top, hips coming over the lip
//   rise     - the other boot onto the top, up, and away
// A slope (a crater side): a crouched scramble up it, leaning in, the clip's own legs kept on the ground.
//
// Whatever the profile, the body is kept out of the earth: wherever the torso (hips to head, as a chain of balls)
// would be inside the ground, the hips are moved back from the wall until it is clear.
import * as THREE from 'three';

const ease = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the shape of the ground along the climb, worked out once per climb
export function climbPlan(s, T) {
  if (s._climbPlan && s._climbPlan.from === s.climbFrom) return s._climbPlan;
  const [x0, y0, z0] = s.climbFrom, [x1, z1] = s.climbTo, dx = x1 - x0, dz = z1 - z0, dl = Math.hypot(dx, dz) || 1;
  const f = new THREE.Vector3(dx / dl, 0, dz / dl), side = new THREE.Vector3(-f.z, 0, f.x);
  // the ground along the climb, the highest across the width of a man (a trench floor and its top can slope along the
  // trench, and a crater can cut into it: the uphill side is what an elbow or a knee would hit)
  // (sampled once into tables, every 2 cm from a metre behind him to a metre past the top: hundreds of men climb out at
  // zero hour, and every frame of every one of them reads these)
  const hAt = (d, l) => T.height(x0 + f.x * d + side.x * l, z0 + f.z * d + side.z * l);
  const S0 = -1.2, SD = 0.02, SN = Math.ceil((dl + 2.4) / SD) + 1, wide = new Float32Array(SN), mid = new Float32Array(SN);
  for (let i = 0; i < SN; i++) { const d = S0 + i * SD, c = hAt(d, 0); mid[i] = c - y0; wide[i] = Math.max(hAt(d, -0.22), c, hAt(d, 0.22)) - y0; }
  const look = (tab, d) => { const x = Math.min(SN - 1.001, Math.max(0, (d - S0) / SD)), i = x | 0, u = x - i; return tab[i] + (tab[i + 1] - tab[i]) * u; };
  const at = d => look(wide, d);
  // the lip: the top of the last steep rise (a revetted wall is near vertical); the ground past it may keep climbing
  // gently (a parapet bank, a hillside), which is walked, not climbed
  const D = 0.04, n = Math.max(2, Math.ceil(dl / D)), h = []; for (let i = 0; i <= n; i++) h.push(at(i * D));
  let lip = -1; for (let i = 0; i < n; i++) if ((h[i + 1] - h[i]) / D > 2.5 && h[i + 1] > 0.6) lip = (i + 1) * D;
  const plan = { from: s.climbFrom, x0, y0, z0, f, side, dl, at, hAt, leap: s.climbKind === 'leap' };
  // the profile's height over a stretch (for keeping a ball of the body out of the ground)
  plan.over = (d0, d1) => { let m = Math.max(at(d0), at(d1)); const i1 = Math.min(SN - 1, Math.floor((d1 - S0) / SD)); for (let i = Math.max(0, Math.ceil((d0 - S0) / SD)); i <= i1; i++) m = Math.max(m, wide[i]); return m; };
  if (lip < 0 || plan.leap) { plan.kind = plan.leap ? 'leap' : 'slope'; plan.H = at(dl); plan.lip = dl; return (s._climbPlan = plan); }
  while (lip < dl - D && (at(lip + D) - at(lip)) / D > 1.2) lip += D;   // to the very top of the cut
  // the wall's face: the foot of that last steep rise
  let face = lip; while (face > D && (at(face) - at(face - D)) / D > 1.2) face -= D;
  plan.kind = 'wall'; plan.lip = face; plan.H = at(Math.min(dl, lip + 0.08));
  // where he climbs from: the fire-step (or any ledge) in front of the wall, if he is below it; else the floor there
  const at0 = plan.at0 = d => look(mid, d), sh = Math.max(at0(face - 0.18), at0(face - 0.26), at0(face - 0.34));   // (the fire-step: on his own line, not the highest across him; its top, not its sloped edge)
  plan.step = sh > 0.3 && sh < plan.H - 0.45 && face - 0.24 > 0.05 ? { d: face - 0.26, h: sh } : null;
  // where the ledge starts, so he can step up onto it from the floor
  if (plan.step) { let e = face - 0.24; while (e > 0 && at0(e - D) > sh - 0.15) e -= D; plan.step.edge = e; }
  plan.base = plan.step ? { d: face - 0.3, h: sh } : { d: Math.max(Math.min(0, face - 0.34), face - 0.34), h: at0(Math.max(0, face - 0.4)) };
  return (s._climbPlan = plan);
}

// keyframed values, eased between keys: K = [[t, ...values], ...]; arrays are [d, h] pairs
function sample(K, t, feet = []) {
  let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], r = clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1), u = ease(r);
  return a.map((v, k) => {
    if (k === 0) return t;
    if (feet.includes(k) && b[k][1] > v[1] + 0.15) { const ud = ease(clamp((r - 0.3) / 0.7, 0, 1)), uh = ease(clamp(r / 0.7, 0, 1)); return [lerp(v[0], b[k][0], ud), lerp(v[1], b[k][1], uh) + Math.sin(Math.PI * r) * 0.09]; }   // a boot going up onto something: up first (toe clear of the edge), then over
    return Array.isArray(v) ? v.map((x, j) => lerp(x, b[k][j], u)) : lerp(v, b[k], u);
  });
}

// the pose at progress t (0..1): hips (world), lean (radians forward), hand and boot targets (world), weights
export function climbPose(s, T, t, hipH = 0.95) {
  const P = climbPlan(s, T), { f, side, dl } = P;
  const W = (d, h, lat = 0) => new THREE.Vector3(P.x0 + f.x * d + side.x * lat, P.y0 + h, P.z0 + f.z * d + side.z * lat);
  const ground = (d, lat) => { const v = W(d, 0, lat); v.y = T.height(v.x, v.z); return v; };
  if (P.kind === 'leap') {   // jumping a trench: a running leap, an arc over the gap
    const u = ease(t), d = dl * u, hip = W(d, lerp(0, P.at(dl), u) + hipH + Math.sin(u * Math.PI) * 0.45);
    return { kind: 'leap', hip, lean: 0.25, hands: null, feet: null, armW: 0, rifle: 'port' };
  }
  if (P.kind === 'slope') {  // up a crater side: crouched, leaning into the slope, the clip walking
    const d = dl * ease(t), g = P.at(d), steep = clamp((P.at(Math.min(dl, d + 0.4)) - g) / 0.4, 0, 1.2);
    const hip = W(d, g + hipH - lerp(0.1, 0.03, ease(clamp((t - 0.75) / 0.25, 0, 1))));
    return { kind: 'slope', hip, lean: (0.22 + steep * 0.55) * (1 - 0.7 * ease(clamp((t - 0.8) / 0.2, 0, 1))), hands: null, feet: null, armW: 0, rifle: 'port', walk: true };
  }
  const L = P.lip, H = P.H, st = P.step, b = P.base, hb = b.h;
  // time: a share for getting onto the fire-step (if he starts below it), the rest for the climb itself
  const tA = st && P.at0(0) < st.h - 0.3 ? 0.26 : 0;   // (standing heights on his own line: the ground can slope across him)
  // ---- stepping up onto the fire-step: a stride forward, a boot up on the step, up onto it ----
  if (t < tA) {
    const u = t / tA, d0 = 0, e = st.edge, h0 = P.at0(0);
    const K = [
      // t, hip [d, h], lean, footR [d, h], footL [d, h]
      [0.00, [d0, h0 + (hipH - 0.03)], 0.06, [d0 + 0.02, h0], [d0 - 0.06, h0]],
      [0.30, [Math.min(e - 0.32, d0 + 0.15), h0 + (hipH - 0.03) - 0.04], 0.12, [e + 0.14, st.h + 0.02], [Math.min(e - 0.3, d0 + 0.05), h0]],
      [0.70, [e - 0.02, st.h + (hipH - 0.03) - 0.28], 0.3, [e + 0.16, st.h], [e - 0.15, h0 + 0.25]],
      [1.00, [b.d, hb + (hipH - 0.03)], 0.08, [b.d + 0.05, hb], [b.d - 0.07, hb]],
    ];
    const k = sample(K, u, [3, 4]);
    return finish(P, T, W, ground, { kind: 'wall', hipD: k[1][0], hipH_: k[1][1], lean: k[2], footR: k[3], footL: k[4], plantR: u > 0.32, plantL: u < 0.3 || u > 0.95, armW: 0, rifle: 'slung', hands: null, poleUp: 0.35, baseH: h0 });
  }
  // ---- the climb from the base (fire-step or floor) ----
  // (the figure: pelvis to shoulders 0.475 m, an arm 0.52 m to the wrist, a leg 0.89 m hip joint to ankle)
  // (time warped so the push up off the knee and standing up get their share: the last 30% of the climb, not 16%)
  const u0 = tA ? (t - tA) / (1 - tA) : t, u = u0 < 0.7 ? u0 * (0.84 / 0.7) : 0.84 + (u0 - 0.7) * (0.16 / 0.3), d0 = tA ? b.d : 0, h0 = tA ? hb : P.at0(0), stood = hipH - 0.03;
  const hold = H - h0 < 1.4 ? h0 : clamp(H - 1.05, h0 + 0.3, H - 0.5);    // a boot into the revetment, below the lip (a wall no higher than his chest: his feet stay where they are)
  // catching the lip: the shoulders must come within an arm of it; from the floor of a deep trench that takes a spring
  const catchHip = Math.max(h0 + stood - 0.04, H + 0.05 - 0.3 - 0.475 * Math.cos(0.3));
  const fl = d => tA ? hb : P.at0(Math.max(0, Math.min(d, L - 0.3)));   // the floor (or the fire-step) under his boots in front of the wall
  const stand = P.at(Math.min(dl, L + 0.5)), top = d => P.at(d), gH = (P.hAt(L + 0.48, 0.21) + P.hAt(L + 0.48, -0.21)) / 2 - P.y0;   // the top where his hands go down for the crawl over (between them)
  const K = [
    // t, hip [d, h], lean, footR [d, h], footL [d, h]
    [0.00, [d0, h0 + stood], 0.06, [d0 + 0.05, h0], [d0 - 0.07, h0]],
    [0.10, [L - 0.36, fl(L - 0.36) + stood - 0.12], 0.16, [L - 0.3, fl(L - 0.3)], [L - 0.42, fl(L - 0.42)]],                 // a dip, arms going up
    [0.24, [L - 0.33, catchHip], 0.3, [L - 0.2, Math.min(hold, catchHip - 0.62)], [L - 0.36, Math.max(h0, catchHip - stood)]],   // hands catch the lip (a spring, if need be)
    [0.42, [L - 0.32, Math.max(catchHip + 0.02, H - 0.42)], 0.4, [L - 0.2, hold], [L - 0.3, Math.max(h0, H - 1.25)]],          // hoist: shoulders up to the lip
    [0.58, [L - 0.22, H + 0.16], 0.95, [L - 0.2, Math.min(H - 0.55, hold + 0.4)], [L - 0.26, Math.max(h0, H - 0.72)]],        // press: arms straight, chest over the top
    [0.66, [L - 0.07, Math.max(H, gH) + 0.3], 1.15, [L - 0.2, H - 0.4], [L - 0.25, H - 0.6]],                                // the right knee coming up and over
    [0.76, [L + 0.48 - 0.475 * Math.sin(1.35), gH + 0.52 - 0.475 * Math.cos(1.35)], 1.35, [L - 0.06, gH + 0.12], [L - 0.3, H - 0.45]],   // on the knee, on straight arms: crawling over
    [0.84, [L + 0.48 - 0.475 * Math.sin(1.2), gH + 0.52 - 0.475 * Math.cos(1.2)], 1.2, [L - 0.02, gH + 0.14], [L - 0.06, gH + 0.1]],      // the left boot coming up
    [0.885, [L + 0.3, Math.max(gH + 0.45, stand + stood - 0.42)], 0.95, [L + 0.3, gH + 0.08], [L + 0.12, gH + 0.12]],         // pushing up off the hands, a boot under him
    [0.93, [L + 0.46, stand + stood - 0.18], 0.55, [L + 0.52, top(L + 0.52)], [L + 0.24, top(L + 0.24)]],                     // up off the knee, both boots on the top
    [1.00, [dl, P.at(dl) + stood], 0.1, [dl + 0.06, P.at(dl + 0.06)], [dl - 0.1, P.at(dl - 0.1)]],                            // standing on the top, away
  ];
  const k = sample(K, u, [3, 4]);
  // the knees from the press to getting up: each one's direction from the hip joint, keyed (so it is always a thigh's
  // length away): down and out on the wall hold, up and out like a frog, then forward and down onto the top
  let knee = null, kneeL = null;
  if (u > 0.76 && u < 0.97) {   // the left (trailing) knee: up and out past the lip, onto the top, and standing
    const KL = [[0.76, -0.3, -0.95, -0.2, 0.25], [0.82, 0.45, -0.05, -0.6, 1.1], [0.88, 0.6, -0.8, -0.12, 1.7], [0.93, 0.4, -0.9, -0.1, -0.05], [0.97, 0.15, -1, -0.1, 0]];
    const q = sample(KL, u), n = Math.hypot(q[1], q[2], q[3]);
    kneeL = { dir: [q[1] / n, q[2] / n, q[3] / n], shin: q[4], w: u < 0.79 ? ease((u - 0.76) / 0.03) : u < 0.92 ? 1 : 1 - ease((u - 0.92) / 0.05) };
  }
  if (u > 0.58 && u < 0.97) {   // the right (leading) knee
    // t, fw, up, out, shin angle (from hanging straight down, swinging back): on the wall hold, frog, on the top,
    // then up off it: the knee lifting forward as the boot comes through under him, and the leg straightening to stand
    const KN = [[0.58, 0.25, -0.75, 0.5, 0.35], [0.64, 0.4, -0.1, 0.6, 1.05], [0.72, 0.6, -0.8, 0.12, 1.75], [0.84, 0.6, -0.8, 0.12, 1.75],
      [0.89, 0.8, 0.05, 0.12, 0.6], [0.935, 0.4, -0.9, 0.1, -0.05], [0.97, 0.15, -1, 0.1, 0]];
    const q = sample(KN, u), n = Math.hypot(q[1], q[2], q[3]);
    knee = { dir: [q[1] / n, q[2] / n, q[3] / n], shin: q[4], w: u < 0.92 ? 1 : 1 - ease((u - 0.92) / 0.05) };
  }
  // hands: up from the reach, on the lip through the press, then each in turn put further forward for the crawl over
  // (a short lift between), and let go as he gets up
  const armW = u < 0.06 ? 0 : u < 0.26 ? ease((u - 0.06) / 0.2) : u < 0.8 ? 1 : u < 0.88 ? 1 - ease((u - 0.8) / 0.08) : 0;
  // (re-planted 0.45 m past the lip, where the crawl's straight arms come down; on the parapet's bags, a little proud of the earth)
  const hand = (lat, t0) => { const m = ease(clamp((u - t0) / 0.07, 0, 1)), d = lerp(L + 0.12, L + 0.48, m), v = ground(d, lat); v.y += 0.06 + Math.sin(m * Math.PI) * 0.12; return v; };
  const hs = { r: hand(0.21, 0.55), l: hand(-0.21, 0.6) };
  return finish(P, T, W, ground, { kind: 'wall', hipD: k[1][0], hipH_: k[1][1], lean: k[2], footR: k[3], footL: k[4], knee, kneeL,
    plantR: u < 0.08 || (u > 0.36 && u < 0.57) || u > 0.95, plantL: u < 0.12 || u > 0.95, armW,
    hands: hs, handsOn: { r: u > 0.27 && (u < 0.55 || u > 0.63) && u < 0.8, l: u > 0.27 && (u < 0.6 || u > 0.68) && u < 0.8 }, rifle: u > 0.93 ? 'port' : 'slung', poleUp: u < 0.6 ? 0.2 : 0, baseH: h0, L });
}

// the torso as balls up from the hips (distance along the spine, radius); keep every one out of the earth
const TORSO = [[0, 0.12], [0.24, 0.13], [0.46, 0.14]];   // (hips, belly, chest: the head looks up over the top on its own)
function finish(P, T, W, ground, k) {
  let d = k.hipD; const sl = Math.sin(k.lean), cl = Math.cos(k.lean);
  // planted hands within reach of the shoulders (pelvis to shoulder 0.475 m, an arm 0.49 m with the elbow just soft):
  // a hand put down past the lip comes back under its shoulder (the hips are never moved for it: no jumps)
  let h2 = k.hipH_;
  if (k.hands && k.armW > 0.5) for (const q of ['r', 'l']) {
    const hv = k.hands[q], lat = q === 'r' ? 0.17 : -0.17, sd = d + sl * 0.475, shH = h2 + cl * 0.475;
    const hd = (hv.x - P.x0) * P.f.x + (hv.z - P.z0) * P.f.z, hl = (hv.x - P.x0) * P.side.x + (hv.z - P.z0) * P.side.z;
    let dist = Math.hypot(hd - sd, hv.y - P.y0 - shH, hl - lat);
    if (dist > 0.49 && hd > (k.L ?? P.lip) + 0.2 && hd > sd) { const nd = Math.max((k.L ?? P.lip) + 0.15, sd - 0.04), g = ground(nd, hl); g.y += hv.y - T.height(hv.x, hv.z); hv.copy(g); dist = Math.hypot(nd - sd, hv.y - P.y0 - shH, hl - lat); }
  }
  // keep the torso out of the earth: hips back from the wall until every ball of it is clear (and, over the top, up)
  for (let it = 0; it < 40; it++) {
    let worst = 0;
    for (const [a, r] of TORSO) { const pd = d + sl * a, ph = h2 + cl * a; worst = Math.max(worst, P.over(pd - r, pd + r) - (ph - r)); }
    if (worst <= 0.005) break;
    if (P.at(d) > h2 - 0.3) h2 += Math.min(0.03, worst + 0.005); else d -= Math.min(0.03, worst + 0.005);
  }
  const hipW = W(d, h2);
  const lat = 0.11, feet = { r: W(k.footR[0], k.footR[1], lat), l: W(k.footL[0], k.footL[1], -lat) };   // (side is his right)
  // a boot that is down is on the real ground there (the profile is sampled on the line; the boots are either side)
  for (const [q, on] of [['r', k.plantR], ['l', k.plantL]]) { const g = T.height(feet[q].x, feet[q].z); if (on && Math.abs(feet[q].y - g) < 0.15) feet[q].y = g; if (feet[q].y < g) feet[q].y = g; }
  // the knees, when keyed (going up onto the top): a direction from the hip joint, a shin angle, and how far the boot is
  // given over to them from its planted place; the renderer works them out from the real hip joint and bone lengths
  let knees = null;
  for (const [q, kk] of [['r', k.knee], ['l', k.kneeL]]) if (kk) { knees = knees || { dir: {}, shin: {}, w: {} }; knees.dir[q] = kk.dir; knees.shin[q] = kk.shin; knees.w[q] = kk.w; }
  return { kind: 'wall', hip: hipW, baseY: P.y0 + (k.baseH ?? 0), lean: k.lean, hands: k.hands, handsOn: k.handsOn, armW: k.armW, feet, knees,
    plant: { r: k.plantR, l: k.plantL }, rifle: k.rifle, poleUp: k.poleUp };
}

// progress of a man's climb (0..1), or -1 if he isn't climbing
export function climbT(s) { return s.climb > 0 && s.climbTo && s.climbFrom && s.climbDur ? Math.min(1, Math.max(0, 1 - s.climb / s.climbDur)) : -1; }
