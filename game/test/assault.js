// Regression run: an agent assaults the German lines. After zero hour it climbs out, makes for the nearest German
// soldier, fights whatever it can see on the way, and must kill KILLS men once it is in the German lines (in a German
// trench or within 40 m of one: kills made from the British side don't count). When it is killed it respawns and fights its way back in. Same inputs a human has (TF.step). Prints PASS/FAIL, the tally and the final hash.
const KILLS = 3, BUDGET_MIN = 20;
const cfg = `const BUDGET_MIN = ${BUDGET_MIN}, KILLS = ${KILLS};`;
const r = await ev(`(() => { ${cfg}
  const S = TF.sim, T = TF.T, P = () => S.player, H = TF.HZ, log = [];
  const step = (a, n = 1) => TF.step(a, n);
  const yawTo = (x, z) => Math.atan2(-(x - P().x), -(z - P().z));
  // wait in the trench through the mines to zero hour, as the battalions did
  while (S.time < 7 * 3600 + 30 * 60 + 2) step({ yaw: P().yaw, pitch: 0 }, 30);
  const z0 = S.tick, end = S.tick + BUDGET_MIN * 60 * H;
  let deaths = 0, respawns = 0, shots = 0, stuck = 0, last = [P().x, P().z], target = null, retarget = 0, inKills = 0, firstIn = null, entries = 0, wasIn = false;
  const gerFire = S.trenchPts.GER;
  const inGerman = () => { const p = P(), g = T.inTrench(p.x, p.z); if (g && g.side === 'GER') return true;
    for (const q of gerFire) if (Math.abs(q[0] - p.x) < 40 && Math.abs(q[1] - p.z) < 40 && Math.hypot(q[0] - p.x, q[1] - p.z) < 40) return true; return false; };
  const visible = () => { const p = P(); let best = null, bd = 260;
    for (const o of S.soldiers) { if (!o.alive || o.side === p.side) continue; const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd && S._canSee(p, o, d)) { bd = d; best = o; } } return best; };
  const nearestGerman = () => { const p = P(); let best = null, bd = 1e9;
    for (const o of S.soldiers) { if (!o.alive || o.side === p.side) continue; const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; best = o; } } return best; };
  while (S.tick < end && inKills < KILLS) {
    const p = P();
    const isIn = p.alive && inGerman(); if (isIn && !wasIn) { entries++; if (!firstIn) firstIn = S.clock(); log.push(['in the German lines', S.clock()]); } wasIn = isIn;
    if (!p.alive) {   // killed: back in from the nearest trench or taken objective, and go again
      step({ respawn: true }, 1);
      if (P().alive) { deaths++; respawns++; log.push(['respawn', S.clock(), Math.round(P().x), Math.round(P().z), 'kills', P().kills]); target = null; }
      continue;
    }
    // fight anything in sight: aim down the sights at the head and shoulders showing over the parapet, and fire
    const o = S.tick % 4 === 0 ? visible() : null;
    if (o) {
      const before = P().kills, there = inGerman() || (firstIn && wasIn);
      for (let k = 0; k < 150 && o.alive && P().alive; k++) {
        const q = P(), d = Math.hypot(o.x - q.x, o.z - q.z), aimY = o.y + [1.5, 1.05, 0.3][o.stance];
        const pitch = Math.atan2(aimY - (q.y + [1.62, 1.1, 0.35][q.stance]), d);
        const fire = q.cool <= 0 && q.reloading <= 0 && k > 6;
        if (fire && q.mag > 0 && !(q.jam > 0)) shots++;
        step({ yaw: yawTo(o.x, o.z), pitch, ads: true, fire: fire && !(q.jam > 0), reload: q.mag === 0 || q.jam > 0 }, 1);   // (a jam: R clears it)
        if (k % 30 === 29 && !S._canSee(P(), o, d)) break;   // he ducked: move on
      }
      if (there || inGerman()) inKills += P().kills - before;
      continue;
    }
    // otherwise make for the nearest German, over the top and through the wire, climbing anything in the way
    if (!target || !target.alive || S.tick > retarget) { target = nearestGerman(); retarget = S.tick + 5 * H; if (!target) break; }
    const d = Math.hypot(target.x - p.x, target.z - p.z);
    step({ forward: 1, run: d > 25 && d < 160, vault: true, yaw: yawTo(target.x, target.z) + Math.sin(S.tick / 40) * 0.15, pitch: 0 }, 1);
    if (S.tick % (2 * H) === 0) { const m = Math.hypot(P().x - last[0], P().z - last[1]); stuck = m < 0.6 ? stuck + 1 : 0; last = [P().x, P().z];
      if (stuck >= 2) { step({ forward: 1, side: (S.tick / H) % 2 < 1 ? 1 : -1, vault: true, jump: true, yaw: yawTo(target.x, target.z) + 0.9 }, 60); stuck = 0; } }
  }
  const p = P();
  return { kills: p.kills, inKills, firstIn, entries, deaths, respawns, shots, time: S.clock(), minutes: +((S.tick - z0) / H / 60).toFixed(1), log: log.slice(0, 20), hash: S.hash(), score: S.score };
})()`);
log('[assault]', JSON.stringify({ killsInGermanLines: r.inKills, killsTotal: r.kills, firstInGermanTrench: r.firstIn, entries: r.entries, deaths: r.deaths, shots: r.shots, time: r.time, minutes: r.minutes, score: r.score }));
log('[respawns]', JSON.stringify(r.log));
const ok = (n, v, x = '') => log(v ? 'PASS' : 'FAIL', n, x);
ok('the agent reached the German lines', !!r.firstIn, `first there at ${r.firstIn}, ${r.entries} time(s)`);
ok(`it killed ${KILLS} in the German lines`, r.inKills >= KILLS, `${r.inKills} there (${r.kills} in all) in ${r.minutes} min, ${r.shots} shots`);
ok('it respawned and went again after every death', r.respawns === r.deaths, `deaths ${r.deaths}, back in ${r.respawns} times`);   // (counted, not from the log, which is cut at 20 lines)
await ev('TF.render(0.03); TF.settle(); for (let i = 0; i < 10; i++) TF.render(0.033); true'); await shot('assault_end', 85);
log('[end]', r.time, 'hash', r.hash);
