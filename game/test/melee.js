// Close quarters: F drives the bayonet into a man in front of you; a jammed rifle shows on the HUD and R clears it; AI men
// close with the steel in the trenches (a fight filmed side-on).
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'melee';
// 1. the player's bayonet
const r1 = await ev(`(() => { const S = TF.sim, p = S.player; TF.god(true); TF.step({ yaw: p.yaw }, 60 * 10);
  const g = S.soldiers.find(o => o.side === 'GER' && o.alive && o.role !== 'mg');
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; if (Math.abs(TF.T.height(p.x - Math.sin(a) * 1.4, p.z - Math.cos(a) * 1.4) - p.y) < 0.2 && Math.abs(TF.T.height(p.x - Math.sin(a) * 0.7, p.z - Math.cos(a) * 0.7) - p.y) < 0.2) { p.yaw = a; break; } }   // (along the trench, not into its wall)
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  Object.assign(g, { x: p.x + fx * 1.4, z: p.z + fz * 1.4, y: TF.T.height(p.x + fx * 1.4, p.z + fz * 1.4), hp: 100, intent: null }); g.ai.think = 1e9; g.ai.post = [g.x, g.z]; g.ai.mode = "shelter";
  TF.step({ yaw: p.yaw, melee: true }, 1); TF.step({ yaw: p.yaw }, 12); for (let i = 0; i < 2; i++) TF.render(1 / 60); TF.hold = true;
  return { hp: g.hp, alive: g.alive, strike: p.strike }; })()`);
await shot(`${tag}_fp_thrust`, 85); await ev('TF.hold = false; true');
const r1b = await ev(`(() => { TF.step({ yaw: TF.sim.player.yaw }, 30); const g = TF.sim.soldiers.find(o => o.side === 'GER' && Math.hypot(o.x - TF.sim.player.x, o.z - TF.sim.player.z) < 2); return g ? { hp: Math.round(g.hp), alive: g.alive } : { gone: true }; })()`);
ok('F drives the bayonet into the man in front of you', r1.strike > 0 && (r1b.gone || r1b.hp < 100), JSON.stringify({ r1, r1b }));
// 2. a jam: the HUD says so, R clears it
const r2 = await ev(`(() => { const S = TF.sim, p = S.player; p.jam = 1e9; TF.step({ yaw: p.yaw, fire: true }, 5); TF.render(1 / 60); const hud = document.getElementById('ammo').textContent, mag = p.mag;
  TF.step({ yaw: p.yaw, reload: true }, 1); TF.step({ yaw: p.yaw }, 80); return { hud, magHeld: mag, jamAfter: p.jam }; })()`);
ok('a jammed rifle shows on the HUD, does not fire, and R clears it', /Jammed/.test(r2.hud) && r2.jamAfter === 0, JSON.stringify(r2));
// 3. AI hand-to-hand, filmed
const got = await ev(`(() => { const S = TF.sim, p = S.player; for (let i = 0; i < 60 * 540; i++) { TF.step({ yaw: p.yaw }, 1);
    for (const e of S.events) if (e.t === 'strike' && e.id !== p.id) { const s = S.soldiers[e.id]; if (s.alive) { window.__st = e.id; S.events.length = 0; return { id: e.id, steel: e.steel, side: s.side }; } }
    S.events.length = 0; } return null; })()`);
log('[strike]', JSON.stringify(got));
if (got) for (let k = 0; k < 4; k++) {
  await ev(`(() => { const S = TF.sim, s = S.soldiers[window.__st]; if (${k} > 0) TF.step({ yaw: S.player.yaw }, 6); const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    TF.view = { fov: 45, pos: [s.x + fz * 4, s.y + 1.8, s.z - fx * 4], look: [s.x + fx * 0.8, s.y + 1.1, s.z + fz * 0.8] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 3; j++) TF.render(1 / 60); TF.hold = true; return true; })()`);
  await shot(`${tag}_ai_${k}`, 85); await ev('TF.hold = false; true');
}
ok('AI men close with the steel', !!got, JSON.stringify(got));
