// Forward spawns: at a strongpoint his side holds, a man comes up the dugout stairs out of the dark (not out of the air);
// two at most from each per wave, the rest from the rear. Filmed: the entrance, a man coming up, and the player's own view.
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
const dg = await ev(`TF.sim.dugouts.map(d => ({ name: d.name, x: d.x, z: d.z, y: d.y, yaw: d.yaw }))`);
ok('every strongpoint has a dugout entrance', dg.length === 5, '');
// 1. the entrance at La Boisselle, from the front
const look = (d, back, up, side = 0) => `(() => { const d = TF.sim.dugouts.find(q => q.name === ${JSON.stringify(d.name)}), fx = -Math.sin(d.yaw), fz = -Math.cos(d.yaw);
  TF.view = { fov: 45, pos: [d.x + fx * ${back} + fz * ${side}, d.y + ${up}, d.z + fz * ${back} - fx * ${side}], look: [d.x - fx * 0.5, d.y + 0.6, d.z - fz * 0.5] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 3; j++) TF.render(1 / 60); TF.hold = true; return true; })()`;
const LB = dg[1];
await ev(look(LB, 7, 2.2, 2)); await shot('dugout_1_entrance', 88); await ev('TF.hold = false; true');
// 2. a man sent up there (the player's next respawn put there by hand: a German, as the Germans hold it at the start)
const r = await ev(`(() => { const S = TF.sim; TF.god(true); TF.step({}, 60 * 5);
  const s = S.soldiers.find(o => !o.isPlayer && o.side === 'GER' && o.alive && o.role !== 'mg'); s.alive = false; s.deadAt = S.tick - 1000;
  S.fwd['GER' + ${JSON.stringify(LB.name)}] = 1; for (const k of Object.keys(S.fwd)) if (k !== 'GER' + ${JSON.stringify(LB.name)}) S.fwd[k] = 0;
  const reserve0 = S.reserve.GER; S._respawn(s); window.__m = s.id; return { emerge: s.emerge, y: s.y, ground: TF.T.height(s.x, s.z), at: S.events.filter(e => e.t === 'respawn' && e.id === s.id).map(e => e.dugout) }; })()`);
ok('a man sent to a forward spawn starts down the dugout stairs, below ground', r.emerge > 0 && r.y < r.ground - 1.5 && r.at[0] === LB.name, JSON.stringify(r));
const ys = [];
for (const [k, n] of [[0, 30], [1, 25], [2, 20], [3, 25]]) {
  ys.push(await ev(`(() => { const s = TF.sim.soldiers[window.__m]; TF.step({}, ${n}); return { y: +(s.y - TF.T.height(s.x, s.z)).toFixed(2), emerge: s.emerge }; })()`));
  await ev(look(LB, 5.5, 1.7, 2.5)); await shot(`dugout_2_coming_up_${k}`, 88); await ev('TF.hold = false; true');
}
const done = await ev(`(() => { const s = TF.sim.soldiers[window.__m]; TF.step({}, 40); const d = TF.sim.dugouts[1]; return { emerge: s.emerge, onGround: Math.abs(s.y - TF.T.height(s.x, s.z)) < 0.05, fromMouth: +Math.hypot(s.x - d.x, s.z - d.z).toFixed(2) }; })()`);
log('[up]', JSON.stringify(ys));
ok('he climbs up out of it and steps out into the open', done.emerge === 0 && done.onGround && done.fromMouth > 1 && ys[0].y < ys[2].y, JSON.stringify(done));
// 3. coming up yourself: dark, then the doorway
await ev(`(() => { TF.view = null; const S = TF.sim, p = S.player; const d = S.dugouts[1]; Object.assign(p, { emerge: 110, emergeWait: 0, emergeAt: d }); S._emerge(p); TF.step({ yaw: d.yaw, pitch: 0.1 }, 20); for (let i = 0; i < 4; i++) TF.render(1 / 60); TF.hold = true; return true; })()`);
await shot('dugout_3_player_below', 85); await ev('TF.hold = false; true');
await ev(`(() => { const S = TF.sim, p = S.player; TF.step({ yaw: S.dugouts[1].yaw, pitch: 0.05 }, 52); for (let i = 0; i < 4; i++) TF.render(1 / 60); TF.hold = true; return true; })()`);
await shot('dugout_4_player_doorway', 85); await ev('TF.hold = false; true');
