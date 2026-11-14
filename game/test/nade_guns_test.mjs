// Bombs and machine guns: an AI man never bombs a machine gun of his own side's make, even with the enemy on it (it is
// wanted back), but bombs the enemy's own guns freely. A German 20 m from a British soldier at an MG 08, then at a Vickers.
// node test/nade_guns_test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const G = fileURLToPath(new URL('..', import.meta.url));
const { Terrain } = await import(G + 'js/world/terrain.js'); const { Features } = await import(G + 'js/world/features.js'); const { Sim } = await import(G + 'js/sim/sim.js');
const meta = JSON.parse(readFileSync(G + 'data/dem.json')), b = readFileSync(G + 'data/dem.bin'), map = JSON.parse(readFileSync(G + 'data/map_laboisselle.json'));
const T = new Terrain(meta, new Uint16Array(b.buffer, b.byteOffset, b.length / 2), map), S = new Sim(T, new Features(T), { seed: 1 });
let fail = 0; const ok = (n, v, x = '') => { console.log(v ? 'PASS' : 'FAIL', n, x); if (!v) fail++; };
S.step({});   // (the grids)
// how many of 400 thinks end in a bomb thrown by thrower (side) at a man of the other side standing at gun g
function trial(g, side) {
  const thrower = S.soldiers.find(o => o.alive && o.side === side && !(o.gun >= 0) && !o.isPlayer), target = S.soldiers.find(o => o.alive && o.side !== side && !(o.gun >= 0) && !o.isPlayer);
  for (const o of S.soldiers) if (o !== thrower && o !== target && Math.hypot(o.x - g.x, o.z - g.z) < 60) { o.x += 400; o.y = T.height(o.x, o.z); }
  // the thrower 20 m off on open ground, round the gun
  let tx = g.x, tz = g.z;
  for (let a = 0; a < 16; a++) { const x = g.x + Math.cos(a * Math.PI / 8) * 20, z = g.z + Math.sin(a * Math.PI / 8) * 20; if (!T.inTrench(x, z)) { tx = x; tz = z; break; } }
  Object.assign(thrower, { x: tx, z: tz, y: T.height(tx, tz), climb: 0, reloading: 0, gun: -1 });
  Object.assign(target, { x: g.x + 0.6, z: g.z, y: T.height(g.x + 0.6, g.z) });
  let n = 0;
  for (let i = 0; i < 400; i++) { thrower.grenades = 3; thrower.throw = 0; thrower.ai.nadeAt = 0; if (S._considerThrow(thrower, [[Math.hypot(target.x - tx, target.z - tz), target]], target.id)) n++; }
  return n;
}
const mg08 = S.guns.find(g => g.kind === 'mg08'), vickers = S.guns.find(g => g.kind === 'vickers');
const gerAtMg08 = trial(mg08, 'GER'), gerAtVickers = trial(vickers, 'GER'), briAtVickers = trial(vickers, 'BRI'), briAtMg08 = trial(mg08, 'BRI');
ok('a German never bombs an MG 08, even with a British soldier at it (to be retaken)', gerAtMg08 === 0, `${gerAtMg08} of 400`);
ok('a British soldier never bombs a Vickers with a German at it', briAtVickers === 0, `${briAtVickers} of 400`);
ok('but each bombs the other side\'s make of gun', gerAtVickers > 20 && briAtMg08 > 20, `German at a Vickers ${gerAtVickers}, British at an MG 08 ${briAtMg08} of 400`);
process.exit(fail ? 1 : 0);
