// The German garrison in its trenches: a man popping up over the parapet to fire and ducking again (filmed from no man's
// land, as an attacker sees him), a patrol walking his trench (from inside it), a man waiting crouched on the floor.
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
await ev(`(() => { const S = TF.sim; TF.god(true); for (let i = 0; i < 45; i++) { TF.step({ yaw: S.player.yaw }, 60); TF.render(1 / 60); } return true; })()`);
const pick = st => ev(`(() => { const S = TF.sim, p = S.player; const c = S.soldiers.filter(s => s.alive && s.ai && s.ai.style === '${st}' && s.ai.mode === 'hold' && !(s.gun >= 0) && TF.T.segs[s.ai.seg].kind === ('${st}' === 'popup' ? 0 : TF.T.segs[s.ai.seg].kind) && !TF.T.segs[s.ai.seg].gone).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); return c.length ? c[0].id : -1; })()`);
const film = (id, how, k, n) => ev(`(() => { const S = TF.sim, s = S.soldiers[${id}], T = TF.T, P = S.player; for (let i = 0; i < ${n}; i++) { TF.step({ yaw: P.yaw }, 1); }
  const seg = T.segs[s.ai.seg], nx = seg.nx, nz = seg.nz, ux = (seg.bx - seg.ax) / seg.len, uz = (seg.bz - seg.az) / seg.len; let pos, look;
  if ('${how}' === 'front') { if (window.__fy === undefined) window.__fy = s.yaw; const fx = -Math.sin(window.__fy), fz = -Math.cos(window.__fy); pos = [s.x + fx * 6 + fz * 1.5, s.y + 2.6, s.z + fz * 6 - fx * 1.5]; look = [s.x, s.y + 1.3, s.z]; }
  else if ('${how}' === 'along') { pos = [s.x + ux * 7, s.y + 1.5, s.z + uz * 7]; look = [s.x, s.y + 1.0, s.z]; }
  else { pos = [s.x - nx * 2.5 + ux * 3, s.y + 2.4, s.z - nz * 2.5 + uz * 3]; look = [s.x, s.y + 0.6, s.z]; }
  if (Math.hypot(P.x - s.x, P.z - s.z) > 60) { Object.assign(P, { x: s.x + nx * 30, z: s.z + nz * 30, y: T.height(s.x + nx * 30, s.z + nz * 30), vy: 0 }); }
  TF.view = { fov: 50, pos, look }; TF.render(0.03); TF.settle(); for (let j = 0; j < 4; j++) TF.render(1 / 60); TF.hold = true; return { alive: s.alive, stance: s.stance, up: s.ai.up, style: s.ai.style, pos, at: [s.x, s.y, s.z], seg: s.ai.seg, n: [nx, nz], cam: TF.camera.position.toArray() }; })()`);
const pu = await pick('popup'); log('[popup]', pu);
// (his facing when he is up: towards the enemy)
await ev(`(() => { const S = TF.sim, s = S.soldiers[${pu}]; s.hp = 1e9; for (let i = 0; i < 600 && !(s.ai.up && s.ai.target >= 0); i++) TF.step({ yaw: S.player.yaw }, 1); window.__fy = s.yaw; return true; })()`);
const seq = [];
for (let k = 0; k < 6; k++) { if (k === 3) { await film(pu, 'along', k, 0); await shot('ger_popup_along', 88); await ev('TF.hold = false; true'); } const r = await film(pu, 'front', k, k ? 40 : 0); seq.push(r.alive ? r.stance : 'dead'); if (!k) log('[front]', JSON.stringify(r)); await shot(`ger_popup_${k}`, 88); await ev('TF.hold = false; true'); }
log('[popup stances]', seq.join(' '));
ok('a pop-up man is seen to rise over the parapet and duck again', seq.includes(0) && seq.includes(1), seq.join(' '));
const pa = await pick('patrol'); log('[patrol]', pa);
for (let k = 0; k < 3; k++) { await film(pa, 'along', k, k ? 60 : 0); await shot(`ger_patrol_${k}`, 88); await ev('TF.hold = false; true'); }
const wa = await pick('wait'); log('[wait]', wa);
await film(wa, 'along', 0, 0); await shot('ger_wait', 88); await ev('TF.hold = false; true');
