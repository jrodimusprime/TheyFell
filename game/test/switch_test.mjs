// N: going on as another man in the fight. 20 presses: each into a man of a fresh cluster of ~10 near the objective, the
// man you were carries on under the AI (no one vanishes), and it never flicks back and forth between the same men.
// node test/switch_test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const G = fileURLToPath(new URL('..', import.meta.url));
const { Terrain } = await import(G + 'js/world/terrain.js'); const { Features } = await import(G + 'js/world/features.js'); const { Sim, HZ } = await import(G + 'js/sim/sim.js');
const meta = JSON.parse(readFileSync(G + 'data/dem.json')), b = readFileSync(G + 'data/dem.bin'), map = JSON.parse(readFileSync(G + 'data/map_laboisselle.json'));
const T = new Terrain(meta, new Uint16Array(b.buffer, b.byteOffset, b.length / 2), map), S = new Sim(T, new Features(T), { seed: 3 });
let fail = 0; const ok = (n, v, x = '') => { console.log(v ? 'PASS' : 'FAIL', n, x); if (!v) fail++; };
const p = S.player; S.god = true;
for (let i = 0; i < 150 * HZ; i++) { S.step({}); S.events.length = 0; }
const picks = [], spreads = [], goalD = []; let lost = 0;
for (let k = 0; k < 20; k++) {
  const was = [p.x, p.z];
  let q = 12345 + k * 7919; const rr = () => ((q = (q * 16807) % 2147483647) / 2147483647); rr.int = n => Math.floor(rr() * n);
  const c = S.switchCandidates({ ...p, rng: rr });   // (a look at a cluster, without using up his rng)
  if (c.length > 1) { const cx = c.reduce((a, o) => a + o.x, 0) / c.length, cz = c.reduce((a, o) => a + o.z, 0) / c.length; spreads.push(Math.max(...c.map(o => Math.hypot(o.x - cx, o.z - cz)))); }
  S.step({ switchMan: true }); const e = S.events.find(q => q.t === 'switch'); S.events.length = 0;
  if (!e) { picks.push(null); continue; }
  const o = S.soldiers[e.from]; picks.push(e.from);
  if (!(o.alive && Math.hypot(o.x - was[0], o.z - was[1]) < 0.5)) lost++;   // (he has had this tick to move)
  const g = S.target(p.side, p.x, p.z); goalD.push(Math.hypot(g.c[0] - p.x, g.c[1] - p.z));
  for (let i = 0; i < HZ; i++) { S.step({}); S.events.length = 0; }
}
const got = picks.filter(x => x !== null), distinct = new Set(got).size;
let repeat = 0; for (let i = 0; i < got.length; i++) for (let j = Math.max(0, i - 6); j < i; j++) if (got[j] === got[i]) repeat++;
ok('every press puts you in another man', got.length === 20, `${got.length}/20`);
ok('the man you were carries on where you left him (no one vanishes)', lost === 0, lost);
ok('many different men, not two in turn', distinct >= 15, `${distinct} different in ${got.length}`);
ok('never back into one of the last six', repeat === 0, repeat);
ok('in the fight: near the objective', Math.max(...goalD) < 650, goalD.map(Math.round).join(' '));
ok('each cluster is men together (all within 60 m of its middle)', spreads.length && Math.max(...spreads) < 60, spreads.map(Math.round).join(' '));
process.exit(fail ? 1 : 0);
