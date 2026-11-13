// Machine guns in the headless sim: placed, crewed, firing traversing bursts that kill and pin down the attack; the
// loader takes over when the gunner falls; empty guns are crewed again between waves; men take abandoned guns.
// node test/mg_test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const G = fileURLToPath(new URL('..', import.meta.url));
const { Terrain } = await import(G + 'js/world/terrain.js'); const { Features } = await import(G + 'js/world/features.js'); const { Sim, HZ } = await import(G + 'js/sim/sim.js');
const meta = JSON.parse(readFileSync(G + 'data/dem.json')), b = readFileSync(G + 'data/dem.bin'), map = JSON.parse(readFileSync(G + 'data/map_laboisselle.json'));
const T = new Terrain(meta, new Uint16Array(b.buffer, b.byteOffset, b.length / 2), map), S = new Sim(T, new Features(T), { seed: 1 });
let fail = 0; const ok = (n, v, x = '') => { console.log(v ? 'PASS' : 'FAIL', n, x); if (!v) fail++; };
const ger = S.guns.filter(g => g.side === 'GER'), bri = S.guns.filter(g => g.side === 'BRI');
ok('16 MG 08s in the German line and 3 Vickers in the British, each with a gunner and a loader', ger.length === 16 && bri.length === 3 && S.guns.every(g => g.gunner >= 0 && g.loader >= 0));
const sees = S.guns.map(g => { let n = 0; for (let k = -4; k <= 4; k++) { const M = S.gunMuzzle(g, g.yaw0 + k * g.arc / 4, 0); if (T.raycast(M.ox, M.oy, M.oz, M.dx, M.dy, M.dz, 60) < 0) n++; } return n; });
ok('every gun can fire out over its parapet across at least a third of its arc', sees.every(n => n >= 3), sees.join(' '));
ok('no gun in a mine crater', S.guns.every(g => (map.mines || []).every(m => Math.hypot(g.x - m.c[0], g.z - m.c[1]) > m.craterR)));
const st = { rounds: 0, kills: 0, bursts: 0, pinned: 0, taken: 0 }; let last = -1, gap = 0, loaderTook = null, test = null;
for (let i = 0; i < 300 * HZ; i++) {
  S.step({});
  for (const e of S.events) {
    if (e.t === 'shot' && e.gun !== undefined && S.guns[e.gun].side === 'GER') { st.rounds++; if (e.gun === 0) { if (S.tick - last > 12) st.bursts++; last = S.tick; } }
    if (e.t === 'death' && e.kind === 'bullet' && e.by >= 0 && S.soldiers[e.by].gun >= 0 && S.soldiers[e.by].side === 'GER') st.kills++;
    if (e.t === 'gun_taken') st.taken++;
  }
  S.events.length = 0;
  if (i % 60 === 0) st.pinned = Math.max(st.pinned, S.soldiers.filter(o => o.alive && o.side === 'BRI' && S.tick < o.pinned && o.stance === 2).length);
  // at 3 min: shoot the gunner of a firing German gun and watch his loader
  if (i === 180 * HZ) { test = ger.find(g => S._manned(g) && g.loader >= 0 && S.soldiers[g.loader].alive && !S.soldiers.some(o => o.alive && o.side === 'BRI' && Math.hypot(o.x - g.x, o.z - g.z) < 60)); /* (one with no British at it, who might take it first) */ if (test) { test.was = test.loader; S._damage(S.soldiers[test.gunner], 1e4, null, { dir: [0, -1, 0], zone: 'body', point: [0, 0, 0], kind: 'shell' }); } }
  if (test && i === 184 * HZ) loaderTook = test.gunner === test.was && !!S._manned(test);
}
ok('the German guns fire thousands of rounds at the attack, in bursts', st.rounds > 5000 && st.bursts > 10, JSON.stringify(st));
ok('and cut men down (a good share of the British dead)', st.kills > 80, `${st.kills} of ${S.score.BRI.deaths}`);
ok('their fire pins men down: flat on the ground (the covering men and one in four of the rest go down)', st.pinned > 5, st.pinned);
ok('the loader takes over when the gunner falls', loaderTook === true, loaderTook);
ok('guns stay manned (crews replaced between waves, abandoned guns taken)', S.guns.filter(g => S._manned(g)).length >= 10, `${S.guns.filter(g => S._manned(g)).length} of ${S.guns.length} manned at 5 min; ${st.taken} taken`);
process.exit(fail ? 1 : 0);
