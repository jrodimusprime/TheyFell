// Men who fire at you show on the minimap as red dots (where they fired from) until they are dead or you have moved away.
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
const r = await ev(`(() => { const S = TF.sim, p = S.player; TF.god(true); TF.step({ yaw: p.yaw }, 60 * 45);   // after zero hour
  // out into no man's land in front of the Germans, facing them
  const o = S.objectives[0].c; let x = p.x, z = p.z; for (let k = 0; k < 400; k++) { x += (o[0] - x) * 0.004; z += (o[1] - z) * 0.004; }
  const goTo = (X, Z) => { Object.assign(p, { x: X, z: Z, y: TF.T.height(X, Z), vy: 0 }); };
  const toward = (X, Z) => { const d = Math.hypot(o[0] - X, o[1] - Z); return [X + (o[0] - X) / d * (d - 140), Z + (o[1] - Z) / d * (d - 140)]; };
  const [ax, az] = toward(p.x, p.z); goTo(ax, az);
  let n = 0; for (let i = 0; i < 60 * 20 && n === 0; i++) { TF.step({ yaw: Math.atan2(-(o[0] - p.x), -(o[1] - p.z)) }, 1); goTo(ax, az); if (i % 10 === 0) TF.render(1 / 60); n = TF.shooters.size; }
  TF.render(1 / 60); const first = TF.shooters.size;
  for (let i = 0; i < 60 * 4; i++) { TF.step({ yaw: Math.atan2(-(o[0] - p.x), -(o[1] - p.z)) }, 1); goTo(ax, az); } TF.render(1 / 60);
  const dots = [...TF.shooters].map(([id, f]) => ({ id, alive: S.soldiers[id].alive, side: S.soldiers[id].side, d: Math.round(Math.hypot(f.x - p.x, f.z - p.z)) }));
  return { first, dots, at: [Math.round(ax), Math.round(az)] }; })()`);
ok('men firing at you appear as red dots on the map', r.first > 0 && r.dots.every(d => d.side === 'GER' && d.alive), JSON.stringify(r));
await sleep(300); await shot('shooters_minimap', 88);
const r2 = await ev(`(() => { const S = TF.sim, p = S.player; const [x, z] = [p.x - 80, p.z]; Object.assign(p, { x, z, y: TF.T.height(x, z) }); for (let i = 0; i < 8; i++) TF.render(1 / 60); return TF.shooters.size; })()`);
ok('and go when you have moved away', r2 === 0, `${r2} left after moving 80 m`);
