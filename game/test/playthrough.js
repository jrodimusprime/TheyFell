// Golden playthrough (run by test/run.sh through cdp.mjs): an agent plays the opening of La Boisselle with the same
// inputs a human has (TF.step). It waits for zero hour, goes over the top, advances on the Schwabenhöhe, fights,
// dies and redeploys as often as it takes, then checks the map edge. Prints PASS/FAIL lines and the final hash.
const SHOTS = typeof process === 'undefined' ? true : true;
await ev(`
window.__bot = (() => {
  const S = TF.sim, P = () => S.player, H = TF.HZ;
  const log = [];
  const yawTo = (x, z) => { const p = P(); return Math.atan2(-(x - p.x), -(z - p.z)); };
  // the nearest German the player can actually see
  const enemy = () => { const p = P(); let best = null, bd = 260;
    for (const o of S.soldiers) { if (!o.alive || o.side === p.side) continue; const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd && S._canSee(p, o, d)) { bd = d; best = o; } } return best; };
  const fight = (o) => { const p = P(), d = Math.hypot(o.x - p.x, o.z - p.z), dy = o.y + 1.2 - (p.y + 1.62);
    return TF.step({ yaw: yawTo(o.x, o.z), pitch: Math.atan2(dy, d), ads: true, fire: p.cool <= 0 && p.reloading <= 0, reload: p.mag === 0 }, 1); };
  return {
    log,
    wait(ticks) { for (let i = 0; i < ticks; i++) { const p = P(); TF.step({ yaw: p.yaw, pitch: 0, crouch: false }, 1); } },
    advance(x, z, maxTicks) {
      let stuck = 0, last = [P().x, P().z], deaths = 0;
      for (let i = 0; i < maxTicks; i++) {
        const p = P();
        if (!p.alive) { const o = TF.step({ respawn: true }, 1); if (P().alive) { deaths++; log.push(['respawn', S.clock(), Math.round(P().x), Math.round(P().z)]); } continue; }
        if (Math.hypot(x - p.x, z - p.z) < 8) return { arrived: true, deaths, tick: S.tick };
        const o = i % 6 === 0 ? enemy() : null;
        if (o && Math.hypot(o.x - p.x, o.z - p.z) < 200) { for (let k = 0; k < 40 && o.alive && P().alive; k++) fight(o); continue; }
        TF.step({ forward: 1, run: Math.hypot(x - p.x, z - p.z) < 120, jump: true, yaw: yawTo(x, z) + Math.sin(i / 50) * 0.25, pitch: 0 }, 1);
        if (i % 120 === 0) { const m = Math.hypot(P().x - last[0], P().z - last[1]); stuck = m < 0.5 ? stuck + 1 : 0; last = [P().x, P().z]; if (stuck > 3) TF.step({ forward: 1, side: 1, jump: true, yaw: yawTo(x, z) + 1.2 }, 90); }
      }
      return { arrived: false, deaths, tick: S.tick };
    },
  };
})(); true`);
const obs = () => ev('TF.obs()');
let o = await obs();
log('[start]', o.time, 'player', o.player.x, o.player.z, 'inTrench', o.player.inTrench);
const ok = (name, cond, extra = '') => log(cond ? 'PASS' : 'FAIL', name, extra);
ok('starts in a British trench', o.player.inTrench);
// 1. wait in the trench through the mines (07:28) to zero hour (07:30)
await ev('while (!TF.sim.flags.zero) __bot.wait(30); __bot.wait(60); true');   // zero hour comes ~30 s in
o = await obs();
ok('mines fired at 07:28', o.mine, o.time); ok('zero hour reached', o.zero, o.time);
if (SHOTS) { await ev('TF.render(0.03); TF.settle(); for (let i = 0; i < 10; i++) TF.render(0.033); true'); await shot('p1_zero_hour', 85); }
// 2. over the top and on to the Schwabenhöhe (Lochnagar crater lip), up to 8 minutes of game time
const loch = await ev(`(() => { const o = TF.sim.objectives.find(o => o.id === 'A'); return o.c; })()`);
const r = await ev(`JSON.stringify(__bot.advance(${loch[0]}, ${loch[1]}, 60 * 60 * 8))`);
o = await obs();
log('[advance]', r, o.time, 'kills', o.player.kills, 'deaths', o.player.deaths);
log('[respawns]', await ev('JSON.stringify(__bot.log.slice(0, 12))'));
ok('climbed out of the trench and crossed no man\'s land', JSON.parse(r).arrived || Math.hypot(o.player.x - loch[0], o.player.z - loch[1]) < 200, `${Math.round(Math.hypot(o.player.x - loch[0], o.player.z - loch[1]))} m from the crater`);
ok('respawned after dying', o.player.deaths === 0 || o.player.alive, `deaths ${o.player.deaths}`);
if (SHOTS) { await ev('TF.render(0.03); TF.settle(); for (let i = 0; i < 10; i++) TF.render(0.033); true'); await shot('p2_schwabenhohe', 85); }
const battle = await ev(`(() => { const s = TF.sim; return { bri: s.soldiers.filter(x => x.side === 'BRI' && x.alive).length, ger: s.soldiers.filter(x => x.side === 'GER' && x.alive).length, score: s.score, obj: s.objectives.map(o => o.id + ':' + o.owner + ':' + o.progress.toFixed(2)).join(' '), corpses: TF.men.corpses.length }; })()`);
log('[battle]', JSON.stringify(battle));
ok('the battle is being fought (both sides have dead)', battle.score.BRI.deaths > 0 && battle.score.GER.deaths > 0);
// 3. the map edge: walk west from the play area; the game must tell the player, and must not let him off the map
const edge = await ev(`(() => { const s = TF.sim, p = s.player; if (!p.alive) TF.step({ respawn: true }, 200);
  Object.assign(p, { x: 190, z: 3000, y: TF.T.height(190, 3000), hp: 100 });
  const r = []; for (let i = 0; i < 60 * 150 && p.alive; i++) { const ob = TF.step({ forward: 1, run: false, yaw: Math.PI / 2, pitch: 0 }, 1); if (i % 600 === 0) r.push([Math.round(ob.player.x), ob.player.oob]); }
  return { trail: r, x: p.x, oob: s.outOfBounds() }; })()`);
log('[edge]', JSON.stringify(edge.trail));
ok('out-of-bounds warning shown past the play area', edge.oob === true, `x=${edge.x.toFixed(1)}`);
ok('cannot leave the map', edge.x >= 5, `x=${edge.x.toFixed(1)}`);
if (SHOTS) { await ev('TF.render(0.03); TF.settle(); for (let i = 0; i < 10; i++) TF.render(0.033); true'); await shot('p3_out_of_bounds', 85); }
o = await obs();
log('[end]', o.time, 'tick', o.tick, 'hash', o.hash);
