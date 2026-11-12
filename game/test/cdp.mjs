// Headless Chrome driver (after Cimmerian's test/cdp.mjs): node test/cdp.mjs <url> <script.js> <outdir>
// The script is an async function body with ev(expr), shot(name), sleep(ms), log(...) in scope.
// CHROME overrides the browser path; TF_GPU=1 uses the real GPU (Metal) instead of SwiftShader, for performance runs.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [url, scriptPath, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 500), W = +(process.env.TF_W || 1280), H = +(process.env.TF_H || 720);
const chrome = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, ...(process.env.TF_GPU ? ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${outDir}/profile`, `--window-size=${W},${H}`, '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { chrome.kill('SIGKILL'); } catch {} process.exit(1); });
let ws, id = 0; const pending = new Map();
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {} }
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', m => { const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.consoleAPICalled') console.log('[console.' + msg.params.type + ']', msg.params.args.map(a => a.value ?? a.description).join(' '));
    else if (msg.method === 'Runtime.exceptionThrown') console.log('[EXCEPTION]', msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text); });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error'); return r.result?.result?.value; };
  const shot = async (name, q) => { await sleep(150); const r = await send('Page.captureScreenshot', q ? { format: 'jpeg', quality: q } : { format: 'png' }); writeFileSync(`${outDir}/${name}.${q ? 'jpg' : 'png'}`, Buffer.from(r.result.data, 'base64')); console.log('[shot]', name); };
  for (let i = 0; i < 300; i++) { if (await ev('!!(window.TF && TF.sim)').catch(() => false)) break; await sleep(100); }
  const body = readFileSync(scriptPath, 'utf8');
  const fn = new Function('ev', 'shot', 'sleep', 'log', 'writeFileSync', `return (async () => { ${body} })();`);
  await fn(ev, shot, sleep, (...a) => console.log(...a), writeFileSync);
} catch (e) { console.log('[harness error]', e.stack || e); }
finally { try { ws && ws.close(); } catch {} chrome.kill('SIGKILL'); process.exit(0); }
