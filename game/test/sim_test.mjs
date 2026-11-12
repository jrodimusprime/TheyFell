// Headless regression test of the simulation (no browser): determinism, tick cost, and the battle actually happening.
// node test/sim_test.mjs [seconds=360]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const G = fileURLToPath(new URL('..', import.meta.url));
const { Terrain } = await import(G + 'js/world/terrain.js'); const { Features } = await import(G + 'js/world/features.js'); const { Sim, HZ, engageRange } = await import(G + 'js/sim/sim.js');
const meta = JSON.parse(readFileSync(G + 'data/dem.json')), b = readFileSync(G + 'data/dem.bin'), map = JSON.parse(readFileSync(G + 'data/map_laboisselle.json'));
const secs = +(process.argv[2] || 360);
function run(seed) {
  const T = new Terrain(meta, new Uint16Array(b.buffer, b.byteOffset, b.length / 2), map), F = new Features(T), S = new Sim(T, F, { seed });
  // every AI shot: was the target alive, in range and in sight at the moment he fired?
  // (a sight check holds for 0.1 s on the same man, so a target that dropped from view within that instant is allowed)
  const aiShots = { BRI: 0, GER: 0 }, blind = { BRI: 0, GER: 0 }, fire = S._fire.bind(S), seenAt = new Map();
  S._fire = (s, yaw, pitch, exact) => { if (!s.isPlayer && s.cool <= 0 && !s.reloading && s.mag > 0) { aiShots[s.side]++; const o = S.soldiers[s.ai.target]; const d = o ? Math.hypot(o.x - s.x, o.z - s.z) : 1e9;
    const k = s.id * 4096 + (o ? o.id : 0), sees = o && o.alive && d <= engageRange(s) && S._canSee(s, o, d); if (sees) seenAt.set(k, S.tick);
    if (!sees && !(o && o.alive && d <= engageRange(s) && S.tick - (seenAt.get(k) ?? -99) < 6)) blind[s.side]++; } return fire(s, yaw, pitch, exact); };
  const counts = {}; let worst = 0; const t0 = performance.now();
  for (let i = 0; i < secs * HZ; i++) { const a = performance.now(); S.step({}); worst = Math.max(worst, performance.now() - a); for (const e of S.events) counts[e.t] = (counts[e.t] || 0) + 1; S.events.length = 0; }
  return { hash: S.hash(), ms: (performance.now() - t0) / S.tick, worst, counts, score: S.score, inTrench: S.soldiers.length, T, S, aiShots, blind };
}
const a = run(1), c = run(1), d = run(2);
let fail = 0; const ok = (n, v, x = '') => { console.log(v ? 'PASS' : 'FAIL', n, x); if (!v) fail++; };
ok('deterministic: same seed, same final hash', a.hash === c.hash, a.hash);
ok('a different seed plays out differently', a.hash !== d.hash, d.hash);
ok(`tick cost under 4 ms average for ${a.S.soldiers.length} soldiers (60 Hz needs < 16.7)`, a.ms < 4, a.ms.toFixed(3) + ' ms avg, worst ' + a.worst.toFixed(1));
for (const side of ['BRI', 'GER']) ok(`${side === 'BRI' ? 'British' : 'German'} AI only fires at men it can see and that are in range`, a.aiShots[side] > 200 && a.blind[side] === 0, `${a.blind[side]} of ${a.aiShots[side]} shots blind or out of range`);
ok('both mines fired', a.counts.mine === 2); ok('zero hour', a.counts.zero === 1);
ok('the British went over the top', (a.counts.climb || 0) > 50, a.counts.climb);
ok('men fell on both sides', a.score.BRI.deaths > 0 && a.score.GER.deaths > 0, JSON.stringify(a.score));
ok('the fallen were sent back in (respawns)', (a.counts.respawn || 0) > 0, a.counts.respawn);
const map0 = a.T.map.world; ok('map is 6 km at true scale', a.T.size === 6000 && a.T.res === 2.5 && map0.size === 6000);
process.exit(fail ? 1 : 0);
