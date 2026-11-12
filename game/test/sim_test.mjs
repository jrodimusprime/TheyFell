// Headless regression test of the simulation (no browser): determinism, tick cost, and the battle actually happening.
// node test/sim_test.mjs [seconds=360]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const G = fileURLToPath(new URL('..', import.meta.url));
const { Terrain } = await import(G + 'js/world/terrain.js'); const { Features } = await import(G + 'js/world/features.js'); const { Sim, HZ } = await import(G + 'js/sim/sim.js');
const meta = JSON.parse(readFileSync(G + 'data/dem.json')), b = readFileSync(G + 'data/dem.bin'), map = JSON.parse(readFileSync(G + 'data/map_laboisselle.json'));
const secs = +(process.argv[2] || 360);
function run(seed) {
  const T = new Terrain(meta, new Uint16Array(b.buffer, b.byteOffset, b.length / 2), map), F = new Features(T), S = new Sim(T, F, { seed });
  const counts = {}; let worst = 0; const t0 = performance.now();
  for (let i = 0; i < secs * HZ; i++) { const a = performance.now(); S.step({}); worst = Math.max(worst, performance.now() - a); for (const e of S.events) counts[e.t] = (counts[e.t] || 0) + 1; S.events.length = 0; }
  return { hash: S.hash(), ms: (performance.now() - t0) / S.tick, worst, counts, score: S.score, inTrench: S.soldiers.length, T, S };
}
const a = run(1), c = run(1), d = run(2);
let fail = 0; const ok = (n, v, x = '') => { console.log(v ? 'PASS' : 'FAIL', n, x); if (!v) fail++; };
ok('deterministic: same seed, same final hash', a.hash === c.hash, a.hash);
ok('a different seed plays out differently', a.hash !== d.hash, d.hash);
ok('tick cost under 1 ms average (60 Hz needs < 16.7)', a.ms < 1, a.ms.toFixed(3) + ' ms avg, worst ' + a.worst.toFixed(1));
ok('both mines fired', a.counts.mine === 2); ok('zero hour', a.counts.zero === 1);
ok('the British went over the top', (a.counts.climb || 0) > 50, a.counts.climb);
ok('men fell on both sides', a.score.BRI.deaths > 0 && a.score.GER.deaths > 0, JSON.stringify(a.score));
ok('the fallen were sent back in (respawns)', (a.counts.respawn || 0) > 0, a.counts.respawn);
const map0 = a.T.map.world; ok('map is 6 km at true scale', a.T.size === 6000 && a.T.res === 2.5 && map0.size === 6000);
process.exit(fail ? 1 : 0);
