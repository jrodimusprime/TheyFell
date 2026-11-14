// The end, in the headless sim: the lines are taken in order (B not before A is wholly British); the British holding all
// three lines (A, B, C) win; the British with no one left to send lose.
// node test/gameover_test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const G = fileURLToPath(new URL('..', import.meta.url));
const { Terrain } = await import(G + 'js/world/terrain.js'); const { Features } = await import(G + 'js/world/features.js'); const { Sim, HZ } = await import(G + 'js/sim/sim.js');
const meta = JSON.parse(readFileSync(G + 'data/dem.json')), b = readFileSync(G + 'data/dem.bin'), map = JSON.parse(readFileSync(G + 'data/map_laboisselle.json'));
const T = new Terrain(meta, new Uint16Array(b.buffer, b.byteOffset, b.length / 2), map), F = new Features(T);
let fail = 0; const ok = (n, v, x = '') => { console.log(v ? 'PASS' : 'FAIL', n, x); if (!v) fail++; };
{ const S = new Sim(T, F, { seed: 1 }); for (let i = 0; i < 40 * HZ; i++) { S.step({}); S.events.length = 0; }
  ok('no end before anything is decided', !S.over);
  ok('three lines: the front (A, 5 stretches), support (B, 4) and reserve (C, 4) lines', S.lines.map(L => L.id + S.objectives.filter(o => o.line === L.id).length).join() === 'A5,B4,C4', S.objectives.map(o => o.id + ' ' + Math.round(o.len) + ' m').join(', '));
  // British in a stretch of B with no German left in it, the front line not yet theirs: it cannot be taken
  const b2 = S.objectives.find(o => o.id === 'B2'), hold = (o, n) => { const men = S.soldiers.filter(s => s.alive && s.side === 'BRI' && !s.isPlayer).slice(0, n); men.forEach((s, k) => { const q = S._alongObj(o, () => 0.2 + k * 0.05); Object.assign(s, { x: q[0], z: q[1], y: T.height(q[0], q[1]), hp: 1e9 }); s.ai.mode = 'hold'; s.ai.post = q; }); for (const g of S.soldiers) if (g.alive && g.side === 'GER' && S._dObj(o, g.x, g.z) < 40) { g.alive = false; g.deadAt = S.tick; } };
  hold(b2, 6); for (let i = 0; i < 60 * HZ; i++) { hold(b2, 0); S.step({}); S.events.length = 0; }
  ok('a stretch of the support line cannot be taken while the front line is not wholly British', b2.owner === 'GER' && b2.progress <= 0, JSON.stringify({ owner: b2.owner, progress: b2.progress, b: b2.b, g: b2.g }));
  for (const o of S.objectives) if (o.line === 'A') { o.owner = 'BRI'; o.progress = 1; }
  let lineEv = null; for (let i = 0; i < 50 * HZ && b2.owner !== 'BRI'; i++) { hold(b2, 0); for (const o of S.objectives) if (o.line === 'A') { o.owner = 'BRI'; o.progress = 1; } S.step({}); lineEv = lineEv || S.events.find(e => e.t === 'captured' && e.id === 'B2'); S.events.length = 0; }
  ok('with the front line British, the cleared stretch of the support line is taken (in about 40 s)', b2.owner === 'BRI' && lineEv, JSON.stringify({ owner: b2.owner, progress: b2.progress }));
  ok('no end with A and part of B', !S.over);
  for (const o of S.objectives) { o.owner = 'BRI'; o.progress = 1; }
  let ev = null; for (let i = 0; i < 40 && !ev; i++) { for (const o of S.objectives) { o.owner = 'BRI'; o.progress = 1; } S.step({}); ev = S.events.find(e => e.t === 'gameover'); S.events.length = 0; }
  ok('the British holding all three lines win', S.over && S.over.winner === 'BRI' && ev, JSON.stringify(S.over));
  ok('the statistics are kept: kills by cause, the captures', Object.keys(S.stats.kills.GER).length > 0, JSON.stringify(S.stats.kills)); }
{ const S = new Sim(T, F, { seed: 2 }); for (let i = 0; i < 40 * HZ; i++) { S.step({}); S.events.length = 0; }
  S.reserve.BRI = 0; for (const s of S.soldiers) if (s.side === 'BRI') { s.alive = false; s.deadAt = S.tick; }
  for (let i = 0; i < 40; i++) S.step({});
  ok('the British with no one left to send have lost', S.over && S.over.winner === 'GER', JSON.stringify(S.over)); }
process.exit(fail ? 1 : 0);
