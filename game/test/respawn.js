// Respawn choice, in the game as a player has it (not agent mode): after a fall the card shows a map of the front; a man of
// your side can be picked on it (you go in as him: his place, facing the objective) or, left alone for 10 s, one is picked at random
// near the objective. Also: the tally of fallen and left adds up, and the minimap is drawn north-up.
// Run: node test/cdp.mjs "http://localhost:8642/index.html" test/respawn.js <outdir>
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
await ev(`new Promise(r => { const w = () => (window.TF && !document.getElementById('play').disabled) ? r(true) : setTimeout(w, 200); w(); })`);
await ev(`document.getElementById('play').click(); true`);
// let the attack start, so men are out in no man's land
await ev(`(() => { TF.step({ yaw: TF.sim.player.yaw }, 60 * 40); return true; })()`);
await sleep(500);
await shot('respawn_0_minimap', 85);
const tally = await ev(`(() => { const S = TF.sim, t = S.tally('BRI'), alive = S.soldiers.filter(o => o.side === 'BRI' && o.alive).length; return { t, alive, html: document.getElementById('tally').textContent }; })()`);
ok('the tally: men left = men standing in the field + the reserve still to come', tally.t.left === tally.alive + tally.t.reserve && tally.t.reserve > 0, JSON.stringify(tally));
ok('the tally is on screen', /British.*fallen.*left.*German.*fallen.*left/.test(tally.html), tally.html);

// 1. fall, then pick a man on the map
const kill = `(() => { const S = TF.sim, p = S.player; S._damage(p, 1e4, null, { dir: [0, -1, 0], zone: 'chest', point: [p.x, p.y + 1, p.z], kind: 'shell' }); return p.alive; })()`;
await ev(kill);
await sleep(2600);
const card = await ev(`(() => ({ shown: getComputedStyle(document.getElementById('dead')).display, count: document.getElementById('spawnCount').textContent }))()`);
ok('after a fall the card with the map comes up, counting down from 10 s', card.shown === 'grid' && /random in (9|10|8) s/.test(card.count), JSON.stringify(card));
await shot('respawn_1_choose', 88);
// click across the middle of the map until one of the men is under the pointer
const before = await ev(`TF.sim.soldiers.filter(o => o.alive && !o.isPlayer && o.side === 'BRI').map(o => [o.id, o.x, o.z, o.yaw])`);
await ev(`(() => { const cv = document.getElementById('spawnmap'); let n = 0; const r = cv.getBoundingClientRect();
  for (let y = 0.2; y <= 0.8 && n === 0; y += 0.004) for (let x = 0.2; x <= 0.8 && n === 0; x += 0.004) { cv.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width * x, clientY: r.top + r.height * y, bubbles: true })); if (document.getElementById('spawnCount').textContent === 'Going in…') n++; }
  return n; })()`);
await sleep(300);
await shot('respawn_2_picked', 88);
await sleep(1500);
const after = await ev(`(() => { const p = TF.sim.player; return { alive: p.alive, x: p.x, z: p.z, yaw: p.yaw, card: getComputedStyle(document.getElementById('dead')).display }; })()`);
const was = before.find(b => Math.hypot(b[1] - after.x, b[2] - after.z) < 3);
ok('clicking a man on the map puts you in as him (his place, facing the objective)', after.alive && was && after.card === 'none', JSON.stringify({ after, was }));
await sleep(800);
await shot('respawn_3_in', 85);

// 2. fall again and leave it: at random, near the objective, after ~10 s
await ev(kill);
const t0 = Date.now();
let r2 = null;
for (let i = 0; i < 40; i++) { await sleep(500); r2 = await ev(`(() => { const S = TF.sim, p = S.player, g = S.target(p.side, p.x, p.z); return { alive: p.alive, d: g ? Math.hypot(g.c[0] - p.x, g.c[1] - p.z) : 0 }; })()`); if (r2.alive) break; }
const secs = (Date.now() - t0) / 1000;
const nearest = await ev(`(() => { const S = TF.sim, p = S.player, g = S.target(p.side, p.x, p.z); const ds = S.soldiers.filter(o => o.alive && !o.isPlayer && o.side === p.side).map(o => Math.hypot(g.c[0] - o.x, g.c[1] - o.z)).sort((a, b) => a - b); return { tenth: ds[10], median: ds[ds.length >> 1] }; })()`);
ok('left alone, you go in at random after about 10 s', r2.alive && secs > 10 && secs < 15, `${secs.toFixed(1)} s`);
ok('the random man is near the objective, not far down the line', r2.alive && r2.d <= Math.max(nearest.tenth * 1.5, 60) && r2.d < nearest.median, JSON.stringify({ d: Math.round(r2.d), nearest }));

// 3. K: give up this man and go straight to the choice (the map up at once), and back in quickly
await ev(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyK' })); return true; })()`);
await sleep(400);
const k1 = await ev(`(() => ({ alive: TF.sim.player.alive, card: getComputedStyle(document.getElementById('dead')).display, why: document.getElementById('deadwhy').textContent }))()`);
ok('K drops this man and brings up the respawn map at once', !k1.alive && k1.card === 'grid', JSON.stringify(k1));
await ev(`document.getElementById('spawnRandom').click(); true`);
await sleep(1200);
const k2 = await ev(`TF.sim.player.alive`);
ok('and you can go straight back in (no 3 s wait)', k2 === true, k2);

// 4. the same from the Esc menu's button
await sleep(800);
await ev(`(() => { document.getElementById('menu').style.display = 'grid'; const b = document.getElementById('giveup'); b.hidden = false; b.click(); return true; })()`);
await sleep(400);
const b1 = await ev(`(() => ({ alive: TF.sim.player.alive, card: getComputedStyle(document.getElementById('dead')).display, menu: document.getElementById('menu').style.display }))()`);
ok('the Esc menu has a Respawn now button that does the same', !b1.alive && b1.card === 'grid' && b1.menu === 'none', JSON.stringify(b1));

// 5. the map zooms (wheel, buttons) and pans, out to the whole front
const z0 = await ev(`(() => { const cv = document.getElementById('spawnmap'), r = cv.getBoundingClientRect(); const s0 = TF.respawnView().span;
  cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, clientX: r.left + r.width * 0.3, clientY: r.top + r.height * 0.3, bubbles: true, cancelable: true }));
  const s1 = TF.respawnView().span; document.getElementById('spawnAll').click(); const s2 = TF.respawnView().span; return { s0, s1, s2 }; })()`);
await sleep(300); await shot('respawn_4_whole_front', 88);
ok('the respawn map zooms in with the wheel and out to the whole front', z0.s1 < z0.s0 && z0.s2 === 6000, JSON.stringify(z0));
