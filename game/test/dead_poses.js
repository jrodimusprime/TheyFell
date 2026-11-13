// The dead not given a ragdoll (far off, or too many at once) lie in one of ten poses, laid on the ground's slope: all
// ten in a row on open ground, filmed from above and from eye level; and none floating or sunk.
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
const r = await ev(`(async () => { const { layDead, DEAD_POSES } = await import('/js/render/ragdoll.js'); const S = TF.sim, p = S.player, T = TF.T; TF.god(true); TF.step({ yaw: p.yaw }, 60 * 3);
  // open ground: out of the trench, the row running across
  let x0 = p.x, z0 = p.z; for (let r = 15; r < 300; r += 5) { let found = false; for (let k = 0; k < 8 && !found; k++) { const a = k * Math.PI / 4, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; let flat = true; for (let i = -2; i <= 12; i++) if (TF.T.trenchAt(x + i * 2.4, z, {}).d < 4 || Math.abs(T.height(x + i * 2.4, z) - T.height(x, z)) > 1.2) flat = false; if (flat) { x0 = x; z0 = z; found = true; } } if (found) break; }
  Object.assign(p, { x: x0 - 3, z: z0 + 5, y: T.height(x0 - 3, z0 + 5), vy: 0 });
  const out = [], men = S.soldiers.filter(o => !o.isPlayer && o.alive).slice(0, 10);
  DEAD_POSES.forEach((P, k) => { const s = men[k], c = TF.men.addCorpse(s); c.x = x0 + k * 2.4; c.z = z0; layDead(c, T, k, Math.PI); 
    let worst = 1e9, high = -1e9; for (let i = 0; i < c.mats.length; i++) { const e = c.mats[i].elements; const g = T.height(e[12], e[14]); worst = Math.min(worst, e[13] - g); high = Math.max(high, e[13] - g); }
    out.push({ k, name: P.name, lowest: +worst.toFixed(2), highest: +high.toFixed(2) }); });
  window.__row = [x0, z0]; return out; })()`);
for (const q of r) log(q.k, q.name, 'joints from', q.lowest, 'to', q.highest, 'm over the ground');
ok('every pose lies on the ground (no joint sunk more than 15 cm, none lifted over 1 m)', r.every(q => q.lowest > -0.15 && q.highest < 1.0), '');
const view = (pos, look, fov = 50) => `(() => { const [x0, z0] = window.__row, T = TF.T; TF.view = { fov: ${fov}, pos: [${pos}], look: [${look}] }; TF.render(0.03); TF.settle(); for (let j = 0; j < 4; j++) TF.render(1 / 60); TF.hold = true; return true; })()`;
await ev(view('x0 + 10.8, T.height(x0 + 10.8, z0) + 13, z0 + 7', 'x0 + 10.8, T.height(x0 + 10.8, z0), z0', 55)); await shot('dead_1_from_above', 88); await ev('TF.hold = false; true');
await ev(view('x0 - 2, T.height(x0 - 2, z0 + 4) + 1.7, z0 + 4', 'x0 + 6, T.height(x0 + 6, z0) + 0.2, z0', 55)); await shot('dead_2_eye_level_first5', 88); await ev('TF.hold = false; true');
await ev(view('x0 + 10, T.height(x0 + 10, z0 + 4) + 1.7, z0 + 4', 'x0 + 18, T.height(x0 + 18, z0) + 0.2, z0', 55)); await shot('dead_3_eye_level_last5', 88); await ev('TF.hold = false; true');
await ev(view('x0 + 4.8, T.height(x0 + 4.8, z0 + 7) + 1.6, z0 + 7', 'x0 + 4.8, T.height(x0 + 4.8, z0) + 0.1, z0', 62)); await shot('dead_4_side_first5', 88); await ev('TF.hold = false; true');
await ev(view('x0 + 16.8, T.height(x0 + 16.8, z0 + 7) + 1.6, z0 + 7', 'x0 + 16.8, T.height(x0 + 16.8, z0) + 0.1, z0', 62)); await shot('dead_5_side_last5', 88); await ev('TF.hold = false; true');
