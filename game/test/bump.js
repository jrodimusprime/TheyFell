// In the running game: the player charges eight soldiers, British in his own trench and Germans in theirs, from close by.
// He must never get closer than 0.75 m to any of them (bodies are solid; around the player the gap is 0.8 m), except a
// comrade who has stepped aside to let him by: side-on against the wall, the player squeezes past at 0.45 m.
const r = await ev(`(() => { const S = TF.sim, p = S.player, out = [];
  const pick = side => S.soldiers.filter(x => !x.isPlayer && x.side === side && x.alive).slice(0, 4);
  TF.step({ yaw: p.yaw }, 60 * 35);   // past zero hour: the Germans are on their fire-step, the British on the move
  for (const o of [...pick('BRI'), ...pick('GER')]) {
    if (!o.alive) continue;
    // (a start 1.5 m from him at his own level, whichever way there is one; never placed inside him)
    let x = null, z = null; for (let k = 0; k < 8 && x === null; k++) { const a = o.id * 1.7 + k * Math.PI / 4, tx = o.x + Math.cos(a) * 1.5, tz = o.z + Math.sin(a) * 1.5; if (Math.abs(TF.T.height(tx, tz) - o.y) < 0.6) { x = tx; z = tz; } }
    if (x === null) continue;
    Object.assign(p, { x, z, y: TF.T.height(x, z), vy: 0, onGround: true, alive: true, hp: 100, climb: 0, climbTo: null }); S.god = true;
    let minD = 99, gave = false;
    for (let i = 0; i < 240 && o.alive; i++) { const yaw = Math.atan2(-(o.x - p.x), -(o.z - p.z)); TF.step({ forward: 1, run: true, yaw, pitch: 0 }, 1); if (o.giveWay) gave = true; if (Math.abs(o.y - p.y) < 1.6) minD = Math.min(minD, Math.hypot(o.x - p.x, o.z - p.z)); }
    out.push([o.side, +minD.toFixed(2), gave]); }
  S.god = false; return out; })()`);
log('[bump]', JSON.stringify(r));
const worst = Math.min(...r.filter(q => !q[2]).map(q => q[1])), worstGave = Math.min(9, ...r.filter(q => q[2]).map(q => q[1]));
log(worst >= 0.75 && worstGave >= 0.42 ? 'PASS' : 'FAIL', 'the player cannot get into another soldier, British or German (a comrade giving way: squeezed past, never into)', `closest ${worst} m over ${r.filter(q => !q[2]).length} men; ${worstGave} m past ${r.filter(q => q[2]).length} who gave way`);
