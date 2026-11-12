// First-person review: hip, aiming, mid bolt cycle (lift, back), reloading. Renders frames deterministically through TF.
const tag = (await ev(`location.search`)).match(/rev=(\w+)/)?.[1] || 'fp';
await ev(`(() => { const p = TF.sim.player; TF.view = null; p.pitch = 0.0; TF.render(0.03); TF.settle(); return true; })()`);
const frame = async (name, setup) => { await ev(`(() => { const p = TF.sim.player; ${setup}; for (let i = 0; i < 25; i++) TF.render(1 / 60); return true; })()`); await shot(`${tag}_${name}`, 90); };
await frame('hip', `p.ads = false; p.cool = 0; p.reloading = 0`);
await frame('aim', `p.ads = true`);
for (const [n, c] of [['bolt_lift', 0.78], ['bolt_back', 0.58], ['bolt_fwd', 0.43]]) await frame(n, `p.ads = false; p.cool = ${c} * 0.95; TF.fp.update(0, TF.camera, p, { cycle: 0.95 }, 0, 0, false)`);
await frame('reload', `p.ads = false; p.cool = 0; TF.fp.relLast = 0; p.reloading = 4.0; TF.fp.update(0, TF.camera, p, { cycle: 0.95 }, 0, 0, false); p.reloading = 2.6`);
