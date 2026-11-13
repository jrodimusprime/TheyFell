// The end: the British holding A to D at once win; the end card says who won and why, with the battle in numbers and the
// player's own war, and offers to begin again.
const ok = (n, v, x) => log(v ? 'PASS' : 'FAIL', n, x ?? '');
const r = await ev(`(() => { const S = TF.sim, p = S.player; TF.god(true); for (let i = 0; i < 40; i++) { TF.step({ yaw: p.yaw }, 60); TF.render(1 / 60); }
  for (const o of S.objectives) if ('ABCD'.includes(o.id)) { o.owner = 'BRI'; o.progress = 1; }
  for (let i = 0; i < 40; i++) { TF.step({ yaw: p.yaw }, 1); } TF.render(1 / 60); TF.render(1 / 60); TF.hold = true;
  const el = id => document.getElementById(id); return { over: S.over, shown: !el('over').hidden, title: el('overTitle').textContent, why: el('overWhy').textContent, rows: el('overSides').querySelectorAll('tr').length, you: el('overYou').querySelectorAll('tr').length, caps: el('overCaps').querySelectorAll('li').length }; })()`);
await shot('gameover_british', 90); await ev('TF.hold = false; true');
ok('holding A, B, C and D ends the battle: a British victory, with the reason', r.over && r.over.winner === 'BRI' && r.shown && /British victory/.test(r.title), JSON.stringify(r));
ok("the end card has both sides in numbers, the player's own war and the objectives as they fell", r.rows >= 8 && r.you >= 6 && r.caps >= 1, JSON.stringify(r));
