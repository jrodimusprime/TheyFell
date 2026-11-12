// In the running game: the player charges eight soldiers, British in his own trench and Germans in theirs, from close by.
// He must never get closer than 0.75 m to any of them (bodies are solid; around the player the gap is 0.8 m).
const r = await ev(`(() => { const S = TF.sim, p = S.player, out = [];
  const pick = side => S.soldiers.filter(x => !x.isPlayer && x.side === side && x.alive).slice(0, 4);
  TF.step({ yaw: p.yaw }, 60 * 35);   // past zero hour: the Germans are on their fire-step, the British on the move
  for (const o of [...pick('BRI'), ...pick('GER')]) {
    if (!o.alive) continue;
    const a = o.id * 1.7; let x = o.x + Math.cos(a) * 1.5, z = o.z + Math.sin(a) * 1.5;
    if (Math.abs(TF.T.height(x, z) - o.y) > 0.6) { x = o.x; z = o.z + 0.3; }
    Object.assign(p, { x, z, y: TF.T.height(x, z), vy: 0, onGround: true, alive: true, hp: 100, climb: 0, climbTo: null }); S.god = true;
    let minD = 99;
    for (let i = 0; i < 240 && o.alive; i++) { const yaw = Math.atan2(-(o.x - p.x), -(o.z - p.z)); TF.step({ forward: 1, run: true, yaw, pitch: 0 }, 1); if (Math.abs(o.y - p.y) < 1.6) minD = Math.min(minD, Math.hypot(o.x - p.x, o.z - p.z)); }
    out.push([o.side, +minD.toFixed(2)]); }
  S.god = false; return out; })()`);
log('[bump]', JSON.stringify(r));
const worst = Math.min(...r.map(q => q[1]));
log(worst >= 0.75 ? 'PASS' : 'FAIL', 'the player cannot get into another soldier, British or German', `closest ${worst} m over ${r.length} men`);
