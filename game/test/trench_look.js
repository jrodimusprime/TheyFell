// Close-up review shots of trench construction: first person, a traverse corner, from above, a communication trench, a German trench.
// TF_LOOP names the output files.
const L = typeof process !== 'undefined' && process.env && process.env.TF_LOOP || 'x';
const tag = (await ev(`location.search`)).match(/loop=(\w+)/)?.[1] || 'x';
const setup = await ev(`(() => { const S = TF.sim, T = TF.T, p = S.player;
  // find a fire-trench bay near the player, a communication trench, and a German fire trench
  const near = (pred, x, z) => { let b = -1, bd = 1e9; T.segs.forEach((s, i) => { if (!pred(s)) return; const d = Math.hypot((s.ax + s.bx) / 2 - x, (s.az + s.bz) / 2 - z); if (d < bd) { bd = d; b = i; } }); return T.segs[b]; };
  const bay = near(s => s.side === 'BRI' && s.kind === 0 && Math.hypot(s.bx - s.ax, s.bz - s.az) > 8, p.x, p.z);
  const comm = near(s => s.side === 'BRI' && s.kind === 1 && Math.hypot(s.bx - s.ax, s.bz - s.az) > 4, p.x - 80, p.z);
  const ger = near(s => s.side === 'GER' && s.kind === 0 && Math.hypot(s.bx - s.ax, s.bz - s.az) > 8, 3290, 3177);
  return { bay, comm, ger }; })()`);
const H = (x, z) => ev(`TF.T.height(${x}, ${z})`);
const view = async (name, pos, look, fp) => {
  await ev(`(() => { ${fp ? `TF.view = null; const p = TF.sim.player; Object.assign(p, { x: ${pos[0]}, z: ${pos[2]}, y: TF.T.height(${pos[0]}, ${pos[2]}), yaw: ${pos[3]}, pitch: ${pos[4]} });` : `TF.view = { pos: ${JSON.stringify(pos)}, look: ${JSON.stringify(look)} };`}
    TF.render(0.03); TF.settle(); for (let i = 0; i < 12; i++) TF.render(0.033); return true; })()`);
  await shot(`${tag}_${name}`, 85);
};
const seg = (s, t, o) => { const L = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L; return [s.ax + ux * t * L + s.nx * o, s.az + uz * t * L + s.nz * o, Math.atan2(-ux, -uz)]; };
const b = setup.bay, c = setup.comm, g = setup.ger;
{ const [x, z, yaw] = seg(b, 0.15, -0.2); await view('fp_bay', [x, 0, z, yaw, -0.05], null, true); }
{ const [x, z, yaw] = seg(b, 0.95, 0); const y = await H(x, z); await view('corner', [x - Math.sin(yaw) * -2.5, y + 1.5, z - Math.cos(yaw) * -2.5], [x, y + 0.6, z]); }
{ const [x, z] = seg(b, 0.5, 0); const y = await H(x, z); await view('above', [x + b.nx * -9 + 6, y + 9, z + b.nz * -9 + 6], [x, y, z]); }
{ const [x, z, yaw] = seg(c, 0.3, 0); await view('fp_comm', [x, 0, z, yaw, -0.08], null, true); }
{ const [x, z] = seg(g, 0.5, 0); const y = await H(x, z); await view('german', [x - 7, y + 4, z + 5], [x, y - 0.5, z]); }
log('[counts]', JSON.stringify(await ev(`(() => { const P = TF.props; return P ? Object.fromEntries(['duck','bags','floor','step','core','boards','posts','beams','iron','wattle'].map(k => [k, P[k].count + '/' + P[k].instanceMatrix.count])) : null; })()`)));
