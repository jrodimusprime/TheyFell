// Climb-out review: one soldier climbs out from five kinds of position, eight moments of each, filmed from along the
// trench (profile). Writes <tag>_<scenario>_<n>.jpg. Scenarios: floor->parapet, fire-step->parapet, floor->parados,
// communication trench, shell hole.
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'cl';
await ev(`window.__bare = /bare/.test(location.search); true`);   // &bare: trench props hidden, the climber against the bare cut
const scen = await ev(`(() => { const S = TF.sim, T = TF.T, p = S.player;
  const empty = (x, z) => S.soldiers.every(o => o.isPlayer || !o.alive || Math.hypot(o.x - x, o.z - z) > 3.5);
  const segs = k => T.segs.filter(s => s.side === 'BRI' && s.kind === k && s.len > 6 && !s.gone && Math.hypot(s.ax - p.x, s.az - p.z) < 2500 && empty((s.ax + s.bx) / 2, (s.az + s.bz) / 2));
  const out = []; const F0 = segs(0), C0 = segs(1), fire = F0[Math.min(3, F0.length - 1)], comm = C0[Math.min(2, C0.length - 1)];
  const mid = s => [(s.ax + s.bx) / 2, (s.az + s.bz) / 2], along = s => [(s.bx - s.ax) / s.len, (s.bz - s.az) / s.len];
  { const [mx, mz] = mid(fire), [ux, uz] = along(fire); out.push({ name: 'floor_parapet', x: mx - fire.nx * 0.3, z: mz - fire.nz * 0.3, dir: [fire.nx, fire.nz], u: [ux, uz], co: 0.3 });
    out.push({ name: 'step_parapet', x: mx + fire.nx * 0.45, z: mz + fire.nz * 0.45, dir: [fire.nx, fire.nz], u: [ux, uz], co: -0.45 });
    out.push({ name: 'floor_parados', x: mx - fire.nx * 0.1, z: mz - fire.nz * 0.1, dir: [-fire.nx, -fire.nz], u: [ux, uz], co: -0.1 }); }
  // more fire bays where the trench runs level (most of the line): from the floor, over the parapet
  { const lv = F0.filter(f => Math.abs(T.height(f.ax + f.nx * 0.1, f.az + f.nz * 0.1) - T.height(f.bx + f.nx * 0.1, f.bz + f.nz * 0.1)) / f.len < 0.06).slice(0, 2);
    lv.forEach((f, i) => { const [mx, mz] = mid(f), [ux, uz] = along(f); out.push({ name: 'level_bay_' + (i + 1), x: mx - f.nx * 0.3, z: mz - f.nz * 0.3, dir: [f.nx, f.nz], u: [ux, uz], co: 0.3 }); }); }
  { const [mx, mz] = mid(comm), [ux, uz] = along(comm); out.push({ name: 'comm_trench', x: mx, z: mz, dir: [comm.nx, comm.nz], u: [ux, uz] }); }
  { const c = T.craters.find(c => !c.mine && c.r > 3.5 && Math.hypot(c.x - p.x, c.z - p.z) < 500 && !T.inTrench(c.x, c.z) && empty(c.x, c.z));
    out.push({ name: 'shell_hole', x: c.x + 0.8, z: c.z, dir: [1, 0], u: [0, 1], depth: T.height(c.x + c.r * 1.2, c.z) - T.height(c.x, c.z) }); }
  return out; })()`);
log('[scenarios]', JSON.stringify(scen.map(s => s.name + (s.depth ? ' depth ' + s.depth.toFixed(2) : ''))));
for (const sc of scen) {
  const info = await ev(`(() => { const S = TF.sim, T = TF.T, sc = ${JSON.stringify(sc)};
    const s = S.soldiers.find(o => !o.isPlayer && o.side === 'BRI' && o.alive && o.id === (window.__climber ?? o.id)); window.__climber = s.id;
    Object.assign(s, { x: sc.x, z: sc.z, y: T.height(sc.x, sc.z), vy: 0, onGround: true, climb: 0, climbTo: null, stance: 0, yaw: Math.atan2(-sc.dir[0], -sc.dir[1]) });
    s.ai.mode = 'hold'; s.ai.goal = null; s.ai.think = 1e9; s.ai.target = -1; s.intent = null;
    for (let i = 0; i < 30; i++) { S.step({ yaw: S.player.yaw }); s.intent = null; s.x = sc.x; s.z = sc.z; s.y = T.height(sc.x, sc.z); s.climb = 0; }
    const ok = S._tryClimb(s, sc.dir[0], sc.dir[1]); window.__cs = s;
    return { ok, dur: s.climbDur, H: s.climbTo ? +(T.height(s.climbTo[0], s.climbTo[1]) - s.y).toFixed(2) : null }; })()`);
  log(sc.name, JSON.stringify(info));
  if (!info.ok) continue;
  for (let k = 0; k < 8; k++) {
    const t = k / 7;
    await ev(`(() => { const S = TF.sim, s = window.__cs, sc = ${JSON.stringify(sc)}, T = TF.T;
      const want = ${t} * s.climbDur, done = s.climbDur - s.climb, n = Math.max(0, Math.round((want - done) * 60) - (${k} === 7 ? 1 : 0));
      for (let i = 0; i < n; i++) { S.step({ yaw: S.player.yaw }); if (s.ai) { s.ai.think = 1e9; s.intent = null; } }
      TF.view = { pos: [sc.x, T.height(sc.x, sc.z) + 3, sc.z], look: [sc.x + 1, T.height(sc.x, sc.z), sc.z] }; TF.render(0);   // pose him first (the camera follows)
      const by = T.height(sc.x, sc.z), u = sc.u, d = sc.dir, e = TF.skinned.byId.get(s.id), hp = e && e.cp ? e.cp.hip : { x: sc.x, y: by + 1, z: sc.z };
      // along the trench inside the bay (a profile; a long lens so it reads flat), following his hips; and from high behind
      const tt = ${t}, cy = by + 1.5 + Math.min(1, tt * 1.3) * 1.6, co = sc.co || 0, cx = sc.x + d[0] * co, cz = sc.z + d[1] * co;   // (cx, cz: the trench's centre line)
      const H = s._climbPlan ? s._climbPlan.H : 2;
      window.__views = [   // along the trench inside the bay (a profile; a long lens so it reads flat), following his hips;
        // and from the top he is climbing onto, looking back down at him coming over
        { fov: 38, pos: [cx + u[0] * 3.6 - d[0] * 0.42, cy, cz + u[1] * 3.6 - d[1] * 0.42], look: [hp.x - d[0] * 0.1, hp.y + 0.15, hp.z - d[1] * 0.1] },
        (() => {   // the first of a fan of spots out in front with a clear line over the ground to the lip
          const lx = cx + d[0] * 0.9, lz = cz + d[1] * 0.9, ly = by + H + 0.3;
          for (const [a, r, hh] of [[0.5, 4.6, 1.8], [-0.5, 4.6, 1.8], [0.9, 4.2, 2.2], [-0.9, 4.2, 2.2], [0.2, 5.5, 3], [1.2, 4, 2.6], [-1.2, 4, 2.6], [0, 4, 4]]) {
            const fx = d[0] * Math.cos(a) + u[0] * Math.sin(a), fz = d[1] * Math.cos(a) + u[1] * Math.sin(a), px = cx + fx * r, pz = cz + fz * r, py = Math.max(by + H + hh, T.height(px, pz) + 1.6);
            const vx = lx - px, vy = ly - py, vz = lz - pz, L = Math.hypot(vx, vy, vz);
            let clear = true; for (let q = 0.05; q < 0.92 && clear; q += 0.02) clear = py + vy * q > T.height(px + vx * q, pz + vz * q) + 0.25;   // (sampled: craters' rims count)
            if (clear) return { fov: 40, pos: [px, py, pz], look: [hp.x, hp.y + 0.1, hp.z] };
          }
          return { fov: 40, pos: [cx + d[0] * 4 , by + H + 4, cz + d[1] * 4], look: [hp.x, hp.y, hp.z] };
        })()];
      return true; })()`);
    for (const [vi, v] of ['', 'b'].entries()) {
      await ev(`(() => { TF.view = window.__views[${vi}]; for (const k in TF.props) { const o = TF.props[k]; if (o && o.isInstancedMesh) o.visible = !window.__bare; } TF.render(0.03); if (${k} === 0) TF.settle(); for (let i = 0; i < 3; i++) TF.render(1 / 60); TF.hold = true; return true; })()`);
      if (k === 0 && vi === 0) log('  cam->man', await ev(`(() => { const e = TF.skinned.byId.get(window.__cs.id); return e ? +TF.camera.position.distanceTo(e.o.position).toFixed(2) : 'not skinned'; })()`));
      await shot(`${tag}${v}_${sc.name}_${k}`, 85); await ev('TF.hold = false; true');
    }
  }
}
