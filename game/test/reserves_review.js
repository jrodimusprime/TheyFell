// Reserves, filmed: a German section marching up from the second position, the British coming on from the Tara-Usna
// line, and the immediate reserve waiting in the intermediate line.
await ev(`(() => { const S = TF.sim; TF.god(true); for (let i = 0; i < 240; i++) { TF.step({ yaw: S.player.yaw }, 60); if (i % 10 === 0) TF.render(1 / 60); } return true; })()`);
const film = (pick, name, side = 1) => ev(`(() => { const S = TF.sim, T = TF.T, P = S.player; const g = (${pick})(S); if (!g.length) return null;
  const cx = g.reduce((a, s) => a + s.x, 0) / g.length, cz = g.reduce((a, s) => a + s.z, 0) / g.length, s0 = g[0], fx = -Math.sin(s0.yaw), fz = -Math.cos(s0.yaw);
  const px = cx + fz * 22 * ${side} + fx * 10, pz = cz - fx * 22 * ${side} + fz * 10;
  Object.assign(P, { x: px, z: pz, y: T.height(px, pz), vy: 0 }); TF.step({ yaw: P.yaw }, 1);
  TF.view = { fov: 50, pos: [px, T.height(px, pz) + 3, pz], look: [cx, T.height(cx, cz) + 1, cz] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 4; j++) TF.render(1 / 60); TF.hold = true; return { n: g.length, at: [Math.round(cx), Math.round(cz)] }; })()`);
log('[german section]', JSON.stringify(await film(`S => { const m = S.soldiers.filter(s => s.alive && s.side === 'GER' && s.ai && s.ai.mode === 'march' && s.ai.route && s.ai.route.task === 'hold'); if (!m.length) return []; const k = m[0].ai.section; return m.filter(s => s.ai.section === k); }`, 'ger')));
await shot('res_1_german_section', 88); await ev('TF.hold = false; TF.view = null; true');
log('[british from tara-usna]', JSON.stringify(await film(`S => S.soldiers.filter(s => s.alive && s.side === 'BRI' && !s.isPlayer && s.ai.mode === 'advance' && s.x < 2300).sort((a, b) => a.x - b.x).slice(0, 25)`, 'bri', -1)));
await shot('res_2_british_from_tara_usna', 88); await ev('TF.hold = false; TF.view = null; true');
log('[immediate reserve]', JSON.stringify(await film(`S => S.soldiers.filter(s => s.alive && s.side === 'GER' && s.ai && s.ai.mode === 'reserve').slice(0, 20)`, 'res')));
await shot('res_3_immediate_reserve', 88); await ev('TF.hold = false; TF.view = null; true');
