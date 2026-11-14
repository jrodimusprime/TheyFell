// Reserves (docs/RESERVES.md) in the headless sim: the fallen come back from behind (the British on the Tara-Usna line
// or from Albert and Becourt Wood, the Germans at the second position), German sections march up to where HQ sends
// them and take posts; British inside a German zone bring a bombing counter-thrust from the immediate reserve; an
// objective lost for 3 minutes brings a deliberate counter-attack (assembly, bombardment, assault); no two men overlap.
// node test/reserves_test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const G = fileURLToPath(new URL('..', import.meta.url));
const { Terrain } = await import(G + 'js/world/terrain.js'); const { Features } = await import(G + 'js/world/features.js'); const { Sim, HZ } = await import(G + 'js/sim/sim.js');
const meta = JSON.parse(readFileSync(G + 'data/dem.json')), b = readFileSync(G + 'data/dem.bin'), map = JSON.parse(readFileSync(G + 'data/map_laboisselle.json'));
const T = new Terrain(meta, new Uint16Array(b.buffer, b.byteOffset, b.length / 2), map), S = new Sim(T, new Features(T), { seed: 1 });
let fail = 0; const ok = (n, v, x = '') => { console.log(v ? 'PASS' : 'FAIL', n, x); if (!v) fail++; };
const R = map.reserves, near = (p, list, r) => list.some(q => Math.hypot(p[0] - q[0], p[2] - q[1]) < r);
ok('the immediate reserve is in the intermediate line at the start', S.soldiers.filter(s => s.ai && s.ai.mode === 'reserve').length >= 50);
ok('a quarter of the British start on the Tara-Usna line', S.soldiers.filter(s => s.side === 'BRI' && near([s.x, 0, s.z], R.BRI.line, 260)).length > 150);
const st = { gerRear: 0, gerRearNear: 0, gerFwd: 0, briRear: 0, briRearNear: 0, sections: 0, posts: 0, overlaps: 0, checks: 0, thrust: null, gather: null, bombard: null, assault: null };
const born = new Map(), travel = [];
let forced = false, thrustSet = false;
for (let i = 0; i < 14 * 60 * HZ; i++) {
  S.step({});
  for (const e of S.events) {
    if (e.t === 'respawn' && e.rear) { const s = S.soldiers[e.id]; if (s.side === 'GER') { st.gerRear++; if (near(e.p, R.GER.deep.concat([R.GER.deepFallback]), 120)) st.gerRearNear++; born.set(e.id, S.tick); } else { st.briRear++; if (near(e.p, R.BRI.line.concat(R.BRI.deep), 250)) st.briRearNear++; } }
    if (e.t === 'respawn' && e.dugout && S.soldiers[e.id].side === 'GER') st.gerFwd++;
    if (e.t === 'section') { st.sections++; st.tasks = st.tasks || {}; st.tasks[e.task] = (st.tasks[e.task] || 0) + 1; }
    if (e.t === 'counter') { if (e.kind === 'thrust' && st.thrust === null) st.thrust = S.tick; if (e.kind === 'gather' && st.gather === null) st.gather = S.tick; if (e.kind === 'bombard' && st.bombard === null) st.bombard = S.tick; if (e.kind === 'assault' && st.assault === null) st.assault = S.tick; }
  }
  S.events.length = 0;
  if (i % HZ === 0) for (const [id, t0] of born) { const s = S.soldiers[id]; if (!s.alive) { born.delete(id); continue; } if (s.ai.mode === 'hold' && (s.ai.style || s.ai.seg !== undefined)) { travel.push((S.tick - t0) / HZ); born.delete(id); st.posts++; } else if (s.ai.mode === 'reserve') { travel.push((S.tick - t0) / HZ); born.delete(id); st.toReserve = (st.toReserve || 0) + 1; } else if ((s.ai.route && s.ai.route.task === 'counter' && Math.hypot(s.x - s.ai.route.pts[0][0], s.z - s.ai.route.pts[0][1]) < 40) || (s.ai.mode === 'advance' && s.ai.counter >= 0)) { travel.push((S.tick - t0) / HZ); born.delete(id); st.toCounter = (st.toCounter || 0) + 1; } }
  // a few British inside a German zone that still has men: the counter-thrust must come
  if (i === 200 * HZ && !thrustSet) { thrustSet = true; const o = S.objectives.find(q => q.owner === 'GER' && q.id === 'A3'); const bri = S.soldiers.filter(s => s.alive && s.side === 'BRI' && !s.isPlayer).slice(0, 6); bri.forEach((s, k) => { s.x = o.c[0] + (k - 3) * 1.5; s.z = o.c[1] + 2; s.y = T.height(s.x, s.z); s.hp = 1e9; s.ai.mode = 'hold'; s.ai.post = [s.x, s.z]; }); st.thrustFrom = S.tick; st.thrustObj = o.id; }
  // an objective falls and stays British: a deliberate counter-attack must gather, shell it and go in
  if (i === 240 * HZ && !forced) { forced = true; const o = ['A4', 'A2', 'A3', 'A5'].map(id => S.objectives.find(q => q.id === id)).find(q => q.owner === 'GER') || S.objectives.find(q => q.id === 'A4'); o.owner = 'BRI'; o.progress = 1; st.lostObj = o.id; const z = S.hq.zones && S.hq.zones[S.objectives.indexOf(o)]; if (z) z.lostAt = S.tick - 175 * HZ; }
  if (i % (10 * HZ) === 0) { const p = S.player, live = S.soldiers.filter(s => s.alive && !s.climb && !(s.emerge > 0) && Math.abs(s.x - p.x) + Math.abs(s.z - p.z) < 350);
    for (let a = 0; a < live.length; a++) for (let c = a + 1; c < live.length; c++) { const u = live[a], v = live[c]; if (Math.abs(u.x - v.x) > 0.5 || Math.abs(u.z - v.z) > 0.5 || Math.abs(u.y - v.y) > 1.6 || (u.gun >= 0 && u.gun === v.gun)) continue; st.checks++; if (Math.hypot(u.x - v.x, u.z - v.z) < 0.45) st.overlaps++; } }
}
travel.sort((a, b) => a - b);
{ const c = {}; for (const s of S.soldiers) if (s.alive && s.side === 'GER' && s.ai) { const k = s.ai.mode + (s.ai.route ? ':' + s.ai.route.task : ''); c[k] = (c[k] || 0) + 1; }
  const mm = S.soldiers.filter(s => s.alive && s.side === 'GER' && s.ai && s.ai.mode === 'march'), dist = mm.map(s => { const R = s.ai.route, w = R.pts[R.pts.length - 1]; return Math.round(Math.hypot(w[0] - s.x, w[1] - s.z)); }).sort((a, b) => a - b);
  console.log('[census]', JSON.stringify(c), 'marching: metres to go', JSON.stringify(dist.slice(0, 5)), '...', JSON.stringify(dist.slice(-5))); }
console.log(JSON.stringify({ ...st, travelMedian: travel[travel.length >> 1], travelN: travel.length, reserveLeft: S.reserve }));
ok('fallen Germans come back at the second position (not in the front trench)', st.gerRear > 30 && st.gerRearNear / st.gerRear > 0.95, `${st.gerRearNear}/${st.gerRear} there; ${st.gerFwd} up the strongpoint dugouts`);
ok('fallen British come back on the Tara-Usna line or from Albert and Becourt', st.briRear > 30 && st.briRearNear / st.briRear > 0.95, `${st.briRearNear}/${st.briRear}`);
ok('German sections form up and march where HQ sends them, and get there (posts, the reserve, a counter-attack)', st.sections >= 3 && st.posts + (st.toReserve || 0) + (st.toCounter || 0) >= 30, `${st.sections} sections ${JSON.stringify(st.tasks)}; arrived: ${st.posts} at posts, ${st.toReserve || 0} to the reserve, ${st.toCounter || 0} at a counter-attack`);
ok('the march up takes minutes (2 to 14)', travel.length && travel[travel.length >> 1] > 120 && travel[travel.length >> 1] < 840, `median ${Math.round(travel[travel.length >> 1] || 0)} s`);
ok('British inside a German zone bring a bombing counter-thrust', st.thrust !== null, `zone ${st.thrustObj}: after ${st.thrust === null ? '-' : ((st.thrust - st.thrustFrom) / HZ).toFixed(1) + ' s'}`);
st.retaken = S.stats.captures.some(c => c.id === st.lostObj && c.side === 'GER');
ok('an objective lost for 3 minutes brings a counter-attack: assembly, bombardment, assault (or the Germans retake it first)', st.gather !== null && ((st.bombard !== null && st.assault !== null) || st.retaken), `objective ${st.lostObj}: gather ${st.gather !== null}, bombard ${st.bombard !== null}, assault ${st.assault !== null}, retaken ${st.retaken}`);
ok('no two men in one place near the player', st.overlaps === 0, `${st.overlaps} of ${st.checks} close pairs under 0.45 m`);
process.exit(fail ? 1 : 0);
