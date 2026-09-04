// True mobile screenshot via Chrome DevTools Protocol (device metrics override).
// Usage: node scripts/shot.mjs <url> <out.png> [width] [height]
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [url, out, width = '390', height = '844'] = process.argv.slice(2);
const W = Number(width), H = Number(height);
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9333', '--remote-debugging-address=127.0.0.1',
  'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9333/json');
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error('no devtools target');
}

async function main() {
  const wsUrl = await getTarget();
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
    if (msg.method) waiters.forEach(w => w(msg));
  });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const waitEvent = name => new Promise(res => { const w = m => { if (m.method === name) { const idx = waiters.indexOf(w); if (idx >= 0) waiters.splice(idx, 1); res(m.params); } }; waiters.push(w); });

  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  const loaded = waitEvent('Page.loadEventFired');
  await send('Page.navigate', { url });
  await Promise.race([loaded, sleep(6000)]);
  await sleep(1500); // let JS modules render

  const { cssContentSize } = await send('Page.getLayoutMetrics');
  const fullH = Math.min(Math.ceil(cssContentSize?.height || H), 6000);
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: W, height: fullH, scale: 1 },
  });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('wrote', out, W + 'x' + fullH);
  ws.close();
  chrome.kill();
}
main().catch(e => { console.error(e); chrome.kill(); process.exit(1); });
