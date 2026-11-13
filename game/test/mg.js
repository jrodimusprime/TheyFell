// Machine guns: German MG 08s on their sledges and British Vickers on tripods, each with a gunner and a loader, firing
// traversing bursts at the attack; the player can take over a gun (E), fire it, change the belt (R), and turn a German
// gun round on its own side. Filmed: a German nest firing, a Vickers, the player on a gun.
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
const g0 = await ev(`(() => { const S = TF.sim; TF.god(true); return S.guns.map(g => ({ id: g.id, kind: g.kind, side: g.side, crew: [g.gunner, g.loader] })); })()`);
ok('German MG 08s and British Vickers, each with a gunner and a loader', g0.filter(g => g.kind === 'mg08').length >= 12 && g0.filter(g => g.kind === 'vickers').length >= 2 && g0.every(g => g.crew[0] >= 0 && g.crew[1] >= 0), JSON.stringify(g0.map(g => g.kind[0] + g.side[0])));
// 1. the attack under way: a German gun firing, filmed from beside and behind it
const firing = await ev(`(() => { const S = TF.sim, p = S.player; const n = {}; for (let i = 0; i < 60 * 60; i++) { TF.step({ yaw: p.yaw }, 1); for (const e of S.events) if (e.t === 'shot' && e.gun !== undefined) n[e.gun] = (n[e.gun] || 0) + 1; S.events.length = 0; }
  const ger = Object.entries(n).filter(([g]) => S.guns[g].side === 'GER').sort((a, b) => b[1] - a[1]); return { n, best: ger.length ? +ger[0][0] : -1 }; })()`);
log('[rounds by gun in the first minute]', JSON.stringify(firing.n));
ok('the German guns open up on the attack', firing.best >= 0, firing.best);
// a camera with a clear sight of the gun: from behind its crew (front = false) or from the field in front of it
// filmed from above and behind the crew (front = false), or from the field in front of the gun, high enough to see over
// everything round it
const film = (id, front, fov = 40, n = 0) => `(() => { const S = TF.sim, g = S.guns[${id}], T = TF.T, P = S.player; for (let i = 0; i < ${n}; i++) TF.step({ yaw: P.yaw }, 1);
  { const fx0 = -Math.sin(g.yaw0), fz0 = -Math.cos(g.yaw0); const bx = g.crew[0] - fz0 * 4, bz = g.crew[1] + fx0 * 4; Object.assign(P, { x: bx, z: bz, y: T.height(bx, bz), vy: 0 }); TF.step({ yaw: P.yaw }, 1); }   // (the player beside it: the ground there drawn in full detail)
  const fx = -Math.sin(g.aimYaw), fz = -Math.cos(g.aimYaw), k = ${front} ? 1 : -1, px = g.x + fx * k * 3.2 - fz * 1.6, pz = g.z + fz * k * 3.2 + fx * 1.6;
  const py = Math.max(g.by + (${front} ? 1.1 : 1.7), T.height(px, pz) + 1.0);
  TF.view = { fov: ${fov}, pos: [px, py, pz], look: [g.x - fx * 0.2, g.by - 0.35, g.z - fz * 0.2] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 4; j++) TF.render(1 / 60); TF.hold = true; return JSON.stringify(TF.view); })()`;
log('[view]', await ev(film(firing.best, false))); await shot('mg_1_german_nest', 88); await ev('TF.hold = false; true');
await ev(film(firing.best, true, 45, 3)); await shot('mg_2_german_nest_front', 88); await ev('TF.hold = false; true');
const vk = g0.find(g => g.kind === 'vickers').id;
await ev(film(vk, false)); await shot('mg_3_vickers', 88); await ev('TF.hold = false; true'); await ev(film(vk, true, 45)); await shot('mg_3_vickers_front', 88); await ev('TF.hold = false; TF.view = null; true');
// 2. the player takes over the Vickers: its gunner moves over to load
const m1 = await ev(`(() => { const S = TF.sim, p = S.player, g = S.guns[${vk}]; const [x, z] = g.crew; Object.assign(p, { x: x - Math.sin(g.yaw0) * 0.6 + 0.3, z: z - Math.cos(g.yaw0) * 0.6, y: TF.T.height(x, z), vy: 0, alive: true, hp: 100, climb: 0, emerge: 0 });
  const near = S.nearGun(p), gunner0 = g.gunner; TF.step({ yaw: g.yaw0, pitch: 0, pickup: true }, 1);
  return { near, onGun: p.gun, gunner: g.gunner, was: gunner0, loader: g.loader, prompt: (TF.render(1 / 60), document.getElementById('prompt').textContent) }; })()`);
ok('E beside a gun: you take it over (its gunner stands down; he loads if the loader is gone)', m1.onGun === vk && m1.gunner === 0 && m1.was !== 0, JSON.stringify(m1));
const f1 = await ev(`(() => { const S = TF.sim, p = S.player, g = S.guns[${vk}], b0 = g.belt; for (let i = 0; i < 120; i++) { TF.step({ yaw: g.yaw0 + 0.1, pitch: 0.02, fire: true }, 1); if (i === 60) { for (let j = 0; j < 3; j++) TF.render(1 / 60); TF.hold = true; } } TF.hold = false; return { fired: b0 - g.belt }; })()`);
await ev(`(() => { const S = TF.sim, g = S.guns[${vk}]; TF.step({ yaw: g.yaw0 + 0.1, pitch: 0.02, fire: true }, 1); for (let j = 0; j < 3; j++) TF.render(1 / 60); TF.hold = true; return true; })()`);
await shot('mg_4_player_on_vickers_firing', 88); await ev('TF.hold = false; true');
ok('holding the trigger: ~8 rounds a second', f1.fired >= 13 && f1.fired <= 17, JSON.stringify(f1));
const t1 = await ev(`(() => { const S = TF.sim, p = S.player, g = S.guns[${vk}]; TF.step({ yaw: g.yaw0 + 2.5, pitch: 0.9 }, 2); return { off: +Math.abs(((p.yaw - g.yaw0 + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI).toFixed(2), arc: g.arc, pitch: +p.pitch.toFixed(2) }; })()`);
ok('it traverses only through its arc and elevates within limits', t1.off <= t1.arc + 1e-6 && t1.pitch <= 0.35, JSON.stringify(t1));
const r1 = await ev(`(() => { const S = TF.sim, p = S.player, g = S.guns[${vk}]; const belts = g.belts; TF.step({ yaw: g.yaw0, reload: true }, 1); const ch = g.change; TF.step({ yaw: g.yaw0 }, 60 * 6); return { change: ch, belt: g.belt, belts0: belts, belts: g.belts }; })()`);
ok('R: a fresh belt (4.5 s with the loader)', r1.change > 4 && r1.change < 5 && r1.belt === 250 && r1.belts === r1.belts0 - 1, JSON.stringify(r1));
const l1 = await ev(`(() => { const S = TF.sim, p = S.player; TF.step({ yaw: p.yaw, pickup: true }, 1); return { onGun: p.gun }; })()`);
ok('E again: you leave the gun', l1.onGun === -1, JSON.stringify(l1));
// 3. a German gun: its crew shot down, the player turns it on them
const m2 = await ev(`(() => { const S = TF.sim, p = S.player, g = S.guns[${firing.best}]; for (const id of [g.gunner, g.loader]) if (id >= 0 && S.soldiers[id].alive) S._damage(S.soldiers[id], 1e4, null, { dir: [0, -1, 0], zone: 'body', point: [0, 0, 0], kind: 'shell' });
  const [x, z] = g.crew; Object.assign(p, { x: x - Math.sin(g.yaw0) * 0.5, z: z - Math.cos(g.yaw0) * 0.5, y: TF.T.height(x, z), vy: 0 }); const back = g.yaw0 + Math.PI;
  TF.step({ yaw: back, pitch: 0, pickup: true }, 1); for (let i = 0; i < 30; i++) TF.step({ yaw: back, pitch: 0, fire: true }, 1); for (let j = 0; j < 3; j++) TF.render(1 / 60); TF.hold = true;
  return { onGun: p.gun, side: g.side, yaw0: +g.yaw0.toFixed(2), back: +(((back + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI).toFixed(2) }; })()`);
await shot('mg_5_player_turns_german_gun', 88); await ev('TF.hold = false; true');
ok('a German gun with its crew down: E turns it round to face where you look, and it is yours', m2.onGun === firing.best && m2.side === 'BRI' && Math.abs(((m2.yaw0 - m2.back + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.01, JSON.stringify(m2));
