// The end, in the headless sim: the British holding A-D win; the British with no one left to send lose.
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
  for (const o of S.objectives) if ('ABCD'.includes(o.id)) { o.owner = 'BRI'; o.progress = 1; }
  let ev = null; for (let i = 0; i < 40 && !ev; i++) { S.step({}); ev = S.events.find(e => e.t === 'gameover'); S.events.length = 0; }
  ok('the British holding A, B, C and D win (E need not fall)', S.over && S.over.winner === 'BRI' && ev, JSON.stringify(S.over));
  ok('the statistics are kept: kills by cause, the captures', Object.keys(S.stats.kills.GER).length > 0, JSON.stringify(S.stats.kills)); }
{ const S = new Sim(T, F, { seed: 2 }); for (let i = 0; i < 40 * HZ; i++) { S.step({}); S.events.length = 0; }
  S.reserve.BRI = 0; for (const s of S.soldiers) if (s.side === 'BRI') { s.alive = false; s.deadAt = S.tick; }
  for (let i = 0; i < 40; i++) S.step({});
  ok('the British with no one left to send have lost', S.over && S.over.winner === 'GER', JSON.stringify(S.over)); }
process.exit(fail ? 1 : 0);
