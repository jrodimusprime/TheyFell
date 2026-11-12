// Builds game/data/map_laboisselle.json: every trench, road, village, wood, mine, objective and spawn
// for MAP-S02 La Boisselle & Lochnagar, 1 July 1916, in world metres (x east, z south; origin = Lambert-93 675000, 6994000).
// Sources: vectorised German trench network (trenches_1916.json), hand-traced front lines from the same 1916 sector map,
// IGN Plan / RGE ALTI for roads, villages and the Lochnagar crater. Lines south of the 1916 map's edge (z > 4355) are approximate.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path'; import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const V = JSON.parse(readFileSync(join(here, 'trenches_1916.json')));
const [AX, AZ] = [V.affine.AX, V.affine.AZ];
const W = ([u, v]) => [+(AX[0] * u + AX[1] * v + AX[2]).toFixed(1), +(AZ[0] * u + AZ[1] * v + AZ[2]).toFixed(1)];
const plan = ([px, py]) => [px * 4, py * 4];   // IGN Plan image (6 km, 4 m/px) -> world
const len = p => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
// ---- hand-traced front lines (hist px), then extended beyond the map sheet ----
const BRI_FRONT = [[1650, 0], [1700, 250], ...[[0,297],[40,300],[65,298],[100,305],[130,318],[148,325],[160,338],[145,355],[128,372],[118,392],[114,425],[125,445],[140,465],[150,480],[155,510],[160,545],[150,560],[140,575],[135,600],
  [132,620],[108,630],[100,645],[75,670],[55,695],[30,720],[32,745],[28,785],[65,825],[100,865],[138,910],[150,912],[165,920],[198,932],[215,945],[220,960],[232,970],[235,990],[238,1000],[260,1010],[272,1020],[282,1040],[300,1037],[312,1040],[320,1050],[330,1080],[345,1110],[350,1140],[360,1150],[372,1160],[372,1180],[350,1195],[340,1210],[345,1300]].map(W),
  [3650, 4700], [3900, 4950], [4100, 5150], [4200, 5450], [4500, 5700], [5200, 5800], [6000, 5850]];
const GER_FRONT = [[2350, 0], ...[[240,150],[240,235],[225,260],[230,300],[240,380],[238,410],[205,470],[218,545],[220,600],[240,640],[272,630],[282,675],[280,730],[260,765],[240,810],[215,860],[160,887],
  [215,903],[250,925],[262,955],[272,968],[300,982],[315,987],[330,990],[380,1000],[425,1015],[445,1030],[470,1050],[460,1080],[440,1110],[415,1115],[420,1140],[440,1170],[445,1200],[420,1250],[430,1300]].map(W),
  [3990, 4700], [4250, 4950], [4300, 5200], [4350, 5450], [4600, 5600], [5200, 5650], [6000, 5650]];
// offset a polyline sideways (positive = to the left of travel = west for a southward line)
function offset(p, d) { return p.map((q, i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [+(q[0] + dz / L * d).toFixed(1), +(q[1] - dx / L * d).toFixed(1)]; }); }
function smooth(p, n = 2) { for (let k = 0; k < n; k++) p = p.map((q, i) => i && i < p.length - 1 ? [(p[i - 1][0] + 2 * q[0] + p[i + 1][0]) / 4, (p[i - 1][1] + 2 * q[1] + p[i + 1][1]) / 4] : q); return p.map(q => q.map(v => +v.toFixed(1))); }
const clip = p => p.filter(q => q[0] >= 0 && q[0] <= 6000 && q[1] >= 0 && q[1] <= 6000);
// British front runs N->S, so the enemy (east) is on the travel-left... left of a southward (0,+z) line is +x (east). Support lines go west: negative offset.
const BRI_SUPPORT = clip(smooth(offset(smooth(BRI_FRONT, 3), -160), 3));
const BRI_RESERVE = clip(smooth(offset(smooth(BRI_FRONT, 4), -650), 4));    // the Tara-Usna line
const trenches = [];
const add = (side, kind, pts, name) => { pts = pts.filter((q, i) => !i || Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) > 0.5); if (pts.length > 1) trenches.push({ side, kind, name, pts }); };
add('BRI', 'fire', BRI_FRONT, 'British front line');
add('BRI', 'fire', BRI_SUPPORT, 'British support line');
add('BRI', 'fire', BRI_RESERVE, 'Tara-Usna line');
add('GER', 'fire', GER_FRONT, 'German front line (Schwabenhöhe, La Boisselle salient)');
// British communication trenches: reserve -> support -> front every ~320 m of front
{ const F = smooth(BRI_FRONT, 3); let acc = 0, n = 0;
  for (let i = 1; i < F.length; i++) { acc += Math.hypot(F[i][0] - F[i - 1][0], F[i][1] - F[i - 1][1]); if (acc < 320) continue; acc = 0; n++;
    const f = F[i], nearest = L => L.reduce((b, q) => Math.hypot(q[0] - f[0], q[1] - f[1]) < Math.hypot(b[0] - f[0], b[1] - f[1]) ? q : b, L[0]);
    const s = nearest(BRI_SUPPORT), r = nearest(BRI_RESERVE);
    if (f[1] > 5900 || f[1] < 40) continue;
    add('BRI', 'comm', [r, s, f], 'Communication trench ' + n); } }
// German network: every vectorised blue line, gaps under 14 m joined, stubs under 12 m dropped
{ const L = V.lines.filter(l => l.side === 'GER').map(l => l.pts);
  // join endpoints that nearly touch
  const ends = []; L.forEach((p, i) => { ends.push([i, 0]); ends.push([i, p.length - 1]); });
  const links = [];
  for (let a = 0; a < ends.length; a++) for (let b = a + 1; b < ends.length; b++) { if (ends[a][0] === ends[b][0]) continue;
    const p = L[ends[a][0]][ends[a][1]], q = L[ends[b][0]][ends[b][1]], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > 2 && d < 14) links.push([p, q]); }
  for (const p of L) if (len(p) >= 12) add('GER', 'minor', p);
  for (const [p, q] of links) add('GER', 'minor', [p, q]); }
// ---- features ----
const villages = [
  { name: 'La Boisselle', c: W([255, 857]), r: 140, ruin: 0.9 },
  { name: 'Ovillers', c: W([345, 530]), r: 130, ruin: 0.8 },
  { name: 'Contalmaison', c: W([855, 785]), r: 150, ruin: 0.4 },
  { name: 'Pozières', c: plan([1330, 150]), r: 220, ruin: 0.5 },
  { name: 'Fricourt', c: plan([1110, 1250]), r: 200, ruin: 0.6 },
  { name: 'Bécourt', c: W([168, 1287]), r: 70, ruin: 0.2 },
];
const woods = [
  { name: 'Bécourt Wood', c: W([160, 1255]), r: 120, density: 0.9, shattered: 0.1 },
  { name: 'Authuille Wood', c: W([20, 470]), r: 160, density: 0.8, shattered: 0.2 },
  { name: 'Shelter Wood', c: W([720, 1110]), r: 90, density: 0.7, shattered: 0.6 },
  { name: 'Bailiff Wood', c: W([735, 785]), r: 45, density: 0.6, shattered: 0.6 },
  { name: 'Contalmaison Wood', c: W([765, 660]), r: 55, density: 0.6, shattered: 0.5 },
  { name: 'Bois de Fricourt', c: plan([1250, 900]), r: 150, density: 0.7, shattered: 0.6 },
];
const roads = [
  { name: 'Albert–Bapaume road', w: 7, pts: [[0, 4600], [880, 4160], [1400, 3800], [2800, 2760], [5360, 560], [5800, 180], [5990, 10]] },
  { name: 'La Boisselle–Contalmaison road', w: 4, pts: [plan([790, 635]), plan([960, 590]), plan([1210, 552]), plan([1395, 590])] },
  { name: 'La Boisselle–Bécourt track', w: 3, pts: [plan([740, 690]), plan([735, 800]), plan([720, 950]), plan([700, 1070])] },
  { name: 'Ovillers–La Boisselle track', w: 3, pts: [plan([830, 350]), plan([805, 450]), plan([800, 560]), plan([780, 620])] },
];
const LOCH = [3290, 3177];                       // Lochnagar: 50.01551 N, 2.69738 E (IGN, crater centre in the DEM)
const mines = [
  { name: 'Lochnagar', c: LOCH, time: '07:28', craterR: 50, depth: 21, lip: 4.5, inDEM: true },
  { name: 'Y Sap', c: W([215, 822]), time: '07:28', craterR: 30, depth: 12, lip: 3, inDEM: false },
];
const objectives = [
  { id: 'A', name: 'Schwabenhöhe (Lochnagar)', c: [LOCH[0] + 40, LOCH[1]], r: 70 },
  { id: 'B', name: 'La Boisselle', c: villages[0].c, r: 110 },
  { id: 'C', name: 'Sausage Redoubt (Heligoland)', c: W([405, 1060]), r: 70 },
  { id: 'D', name: 'Scots Redoubt', c: W([520, 1100]), r: 70 },
  { id: 'E', name: 'Contalmaison', c: villages[2].c, r: 130 },
];
const spawns = {
  BRI: [W([282, 1040]), W([240, 990]), W([340, 1150]), W([100, 865]), W([30, 740]), W([160, 545])],
  GER: [W([300, 982]), W([330, 940]), W([255, 870]), W([440, 1110]), W([280, 730]), W([520, 1000])],
};
// German machine-gun posts that enfiladed Mash & Sausage valleys (approximate)
const mgs = [W([216, 900]), W([262, 770]), W([445, 1030]), W([440, 1170]), W([238, 410]), W([300, 980])];
const map = { id: 'MAP-S02', name: 'La Boisselle & Lochnagar', date: '1 July 1916', zeroHour: '07:30', start: '07:26:30',
  world: { size: 6000, playMin: 150, playMax: 5850, originL93: [675000, 6994000], north: '-z' },
  playerStart: { side: 'BRI', pos: W([282, 1040]) },
  trenches, roads, villages, woods, mines, objectives, spawns, mgs };
writeFileSync(join(here, '../../game/data/map_laboisselle.json'), JSON.stringify(map));
const km = k => (trenches.filter(t => t.side === k).reduce((s, t) => s + len(t.pts), 0) / 1000).toFixed(1);
console.log('trenches', trenches.length, 'BRI km', km('BRI'), 'GER km', km('GER'), 'player', map.playerStart.pos, 'Y Sap', mines[1].c);
