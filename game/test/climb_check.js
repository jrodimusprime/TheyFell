// Climb-out check, by numbers: one soldier climbs out from five kinds of position (floor->parapet, fire-step->parapet,
// floor->parados, communication trench, shell hole). At every 4% of the climb it measures the skinned figure:
//  - nothing of him inside the earth (head, chest, hips, knees, boots, hands, each with its own thickness)
//  - planted hands on their marks while they carry him, planted boots on theirs
//  - no bone flips: frame-to-frame turn of the head and chest stays small
//  - he finishes standing on the top
// Run: node test/cdp.mjs "http://localhost:8642/index.html?agent" test/climb_check.js <outdir>
const scen = await ev(`(() => { const S = TF.sim, T = TF.T, p = S.player;
  const empty = (x, z) => S.soldiers.every(o => o.isPlayer || !o.alive || Math.hypot(o.x - x, o.z - z) > 3.5);
  const segs = k => T.segs.filter(s => s.side === 'BRI' && s.kind === k && s.len > 6 && !s.gone && Math.hypot(s.ax - p.x, s.az - p.z) < 2500 && empty((s.ax + s.bx) / 2, (s.az + s.bz) / 2));
  const out = []; const F0 = segs(0), C0 = segs(1), fire = F0[Math.min(3, F0.length - 1)], comm = C0[Math.min(2, C0.length - 1)];
  const mid = s => [(s.ax + s.bx) / 2, (s.az + s.bz) / 2];
  { const [mx, mz] = mid(fire); out.push({ name: 'floor_parapet', x: mx - fire.nx * 0.3, z: mz - fire.nz * 0.3, dir: [fire.nx, fire.nz] });
    out.push({ name: 'step_parapet', x: mx + fire.nx * 0.45, z: mz + fire.nz * 0.45, dir: [fire.nx, fire.nz] });
    out.push({ name: 'floor_parados', x: mx - fire.nx * 0.1, z: mz - fire.nz * 0.1, dir: [-fire.nx, -fire.nz] }); }
  // more fire bays where the trench runs level (most of the line): from the floor, over the parapet
  { const lv = F0.filter(f => Math.abs(T.height(f.ax + f.nx * 0.1, f.az + f.nz * 0.1) - T.height(f.bx + f.nx * 0.1, f.bz + f.nz * 0.1)) / f.len < 0.06).slice(0, 2);
    lv.forEach((f, i) => { const [mx, mz] = mid(f), ux = (f.bx - f.ax) / f.len, uz = (f.bz - f.az) / f.len; out.push({ name: 'level_bay_' + (i + 1), x: mx - f.nx * 0.3, z: mz - f.nz * 0.3, dir: [f.nx, f.nz], u: [ux, uz], co: 0.3 }); }); }
  { const [mx, mz] = mid(comm); out.push({ name: 'comm_trench', x: mx, z: mz, dir: [comm.nx, comm.nz] }); }
  { const c = T.craters.find(c => !c.mine && c.r > 3.5 && Math.hypot(c.x - p.x, c.z - p.z) < 500 && !T.inTrench(c.x, c.z) && empty(c.x, c.z));
    out.push({ name: 'shell_hole', x: c.x + 0.8, z: c.z, dir: [1, 0] }); }
  return out; })()`);
let bad = 0;
for (const sc of scen) {
  const r = await ev(`(() => { const S = TF.sim, T = TF.T, sc = ${JSON.stringify(sc)}, V = TF.camera.position.constructor;
    const s = S.soldiers.find(o => !o.isPlayer && o.side === 'BRI' && o.alive && o.id === (window.__climber ?? o.id)); window.__climber = s.id;
    Object.assign(s, { x: sc.x, z: sc.z, y: T.height(sc.x, sc.z), vy: 0, onGround: true, climb: 0, climbTo: null, stance: 0, yaw: Math.atan2(-sc.dir[0], -sc.dir[1]) });
    s.ai.mode = 'hold'; s.ai.goal = null; s.ai.think = 1e9; s.ai.target = -1; s.intent = null;
    if (!S._tryClimb(s, sc.dir[0], sc.dir[1])) return { ok: false };
    const dur = s.climbDur, by = s.y;
    TF.view = { pos: [sc.x - sc.dir[0] * 3, by + 3, sc.z - sc.dir[1] * 3], look: [sc.x, by + 1, sc.z] };
    const R = { head: ['Head', 0.11], neck: ['neck_01', 0.07], chest: ['spine_03', 0.13], belly: ['spine_01', 0.12], hips: ['pelvis', 0.11],
      kneeR: ['calf_r', 0.06], kneeL: ['calf_l', 0.06], bootR: ['foot_r', 0.05], bootL: ['foot_l', 0.05], handR: ['hand_r', 0.025], handL: ['hand_l', 0.025],
      elbowR: ['lowerarm_r', 0.04], elbowL: ['lowerarm_l', 0.04] };
    // how far a ball of radius r round p is inside the ground (the highest ground under its footprint)
    const inside = (p, r) => { let g = T.height(p.x, p.z); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g = Math.max(g, T.height(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r)); } return g - (p.y - r); };
    const worst = {}, err = { hand: [0, 0], foot: [0, 0] }; let turn = [0, 0], turnAt = [0, 0], prevQ = null, end = null, plan = null;
    const N = 50; for (let i = 0; i <= N; i++) {
      const t = i / N; s.climb = Math.max(1e-4, dur * (1 - t)); TF.render(1 / 60);
      const e = TF.skinned.byId.get(s.id); if (!e || !e.cp) return { ok: false, why: 'not skinned' };
      const P = n => e.bones[n].getWorldPosition(new V()), cp = e.cp; plan = s._climbPlan || plan;
      for (const [k, [b, rad]] of Object.entries(R)) { const pen = inside(P(b), rad); if (!worst[k] || pen > worst[k][0]) worst[k] = [+pen.toFixed(3), t]; }
      if (cp.hands && cp.handsOn) for (const k of ['r', 'l']) if (cp.handsOn[k]) { const f = plan.f, tg = cp.hands[k].clone(); tg.y += 0.045; tg.x -= f.x * 0.04; tg.z -= f.z * 0.04; /* the wrist over the palm */ const d = P('hand_' + k).distanceTo(tg); if (d > err.hand[0]) err.hand = [+d.toFixed(3), t, k]; }
      if (cp.feet && cp.plant) for (const k of ['r', 'l']) if (cp.plant[k]) { const d = P('foot_' + k).distanceTo(cp.feet[k].clone().setY(cp.feet[k].y + 0.085)); /* the ankle stands 8.5 cm over the sole */ if (d > err.foot[0]) err.foot = [+d.toFixed(3), t]; }
      const q = [e.bones.Head.getWorldQuaternion(new TF.camera.quaternion.constructor()), e.bones.spine_03.getWorldQuaternion(new TF.camera.quaternion.constructor())];
      if (prevQ) for (let j = 0; j < 2; j++) { const a = q[j].angleTo(prevQ[j]); if (a > turn[j]) { turn[j] = a; turnAt[j] = t; } }
      prevQ = q;
      if (i === N) end = { headUp: +(P('Head').y - T.height(P('Head').x, P('Head').z)).toFixed(2) };
    }
    s.climb = 0; s.climbTo = null;
    return { ok: true, H: +plan.H.toFixed(2), lip: +plan.lip.toFixed(2), step: plan.step && [+plan.step.d.toFixed(2), +plan.step.h.toFixed(2)], dl: +plan.dl.toFixed(2), worst, err, turn: turn.map(v => +(v * 180 / Math.PI).toFixed(0)), turnAt, end }; })()`);
  log(sc.name, JSON.stringify(r));
  if (!r.ok) { bad++; continue; }
  // (limits: the body 5 cm, a limb 9 cm; a planted hand within 14 cm of its mark. The worst spot on the line, a fire bay
  // on a 35-degree hillside with a crater in it, comes within those; a level bay is exact)
  const LIMB = /^(boot|knee|elbow|hand)/, deep = Object.entries(r.worst).filter(([k, [p]]) => p > (LIMB.test(k) ? 0.09 : 0.05));
  if (deep.length) { bad++; log('  FAIL inside the earth:', deep.map(([k, [p, t]]) => `${k} ${p} m @${t}`).join(', ')); }
  if (r.err.hand[0] > 0.14) { bad++; log('  FAIL hands off the lip', r.err.hand); }
  if (r.err.foot[0] > 0.08) { bad++; log('  FAIL boots off their holds', r.err.foot); }
  if (r.turn[0] > 20 || r.turn[1] > 20) { bad++; log('  FAIL a flip: head/chest turned', r.turn, 'deg in one step, at', r.turnAt); }
  if (r.end.headUp < 1.42) { bad++; log('  FAIL not standing at the end', r.end); }
}
log(bad ? `FAIL climbing out: ${bad} problems` : 'PASS climbing out of trenches and shell holes at every height: body out of the earth, hands and boots on their holds, no flips, standing at the end');
