import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const candidates = [process.env.BENCHMARK_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let browser;
for (const candidate of candidates) { try { await fs.access(candidate); browser = candidate; break; } catch { /* Try another browser. */ } }
if (!browser) throw Error('Set BENCHMARK_BROWSER to an installed Chromium browser.');
const output = path.resolve('work/tests/cell-brush');
await fs.mkdir(output, { recursive: true });
const profile = await fs.mkdtemp(path.join(output, 'browser-'));
const server = await createServer({ configFile: 'tools/cell-brush/vite.config.ts', server: { host: '127.0.0.1', port: 1435, open: false } });
let child, ws;
try {
  await server.listen();
  child = spawn(browser, ['--headless=new', '--no-first-run', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'http://127.0.0.1:1435/'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  assert.ok(port, 'Browser debugging endpoint');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(t => t.type === 'page');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const pending = new Map(), errors = []; let id = 0;
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
    const request = pending.get(message.id);
    if (request) { pending.delete(message.id); if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => { const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:1435/' });
  for (let i = 0; i < 100; i++) { if (await evaluate('!!document.querySelector("#paint")?.width')) break; await new Promise(r => setTimeout(r, 100)); }
  const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await settle();
  assert.equal(await evaluate('document.querySelectorAll("#profiles canvas").length'), 32, 'All 32 base profiles are inspectable');
  let box = await evaluate('(()=>{const b=document.querySelector("#paint").getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()');
  const stroke = async (a, b, color) => {
    await evaluate(`document.querySelector('[data-slot="${color}"]').click()`);
    const x = box.x + a[0] * box.w, y = box.y + a[1] * box.h;
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 18; i++) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + (b[0] - a[0]) * box.w * i / 18, y: y + (b[1] - a[1]) * box.h * i / 18, buttons: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + b[0] * box.w, y: box.y + b[1] * box.h, button: 'left', buttons: 0, clickCount: 1 }); await settle();
  };
  await stroke([.15, .2], [.8, .7], 2);
  await stroke([.2, .75], [.8, .25], 5);
  assert.ok(Number(await evaluate('document.querySelector("#painted").textContent')) > 500);
  assert.equal(await evaluate(`(() => {
    const canvas = document.querySelector('#paint'), ctx = canvas.getContext('2d');
    const image = ctx.getImageData(Math.floor(canvas.width * .51), Math.floor(canvas.height * .475), 8, 8).data;
    return Array.from(image).filter((_, i) => i % 4 === 3).every(alpha => alpha === 255);
  })()`), true, 'Crossing stroke interior has no transparent seams');
  assert.equal(await evaluate('document.querySelector("#scratch").textContent'), '0.00 KiB', 'Stroke buffers released on pointer up');
  await evaluate('document.querySelector("#show-grid").click()');
  assert.equal(await evaluate('document.querySelector("#grid").hidden'), true);
  await evaluate('document.querySelector("#show-grid").click()');
  const image = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'desktop.png'), Buffer.from(image.data, 'base64'));
  await stroke([.5, .5], [.55, .5], 0);
  assert.equal(await evaluate('(()=>{const c=document.querySelector("#paint");return c.getContext("2d").getImageData(Math.floor(c.width*.52),Math.floor(c.height*.5),1,1).data[3]})()'), 0, 'Paper brush erases to transparency');
  await evaluate('document.querySelector("#example").click()'); await settle();
  assert.ok(Number(await evaluate('document.querySelector("#painted").textContent')) > 800);
  assert.equal(await evaluate('document.querySelector("#scratch").textContent'), '0.00 KiB');
  const expandedExample = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'profiles-32.png'), Buffer.from(expandedExample.data, 'base64'));
  await evaluate('(()=>{const select=document.querySelector("#library");select.value="8";select.dispatchEvent(new Event("change"));})()'); await settle();
  assert.equal(await evaluate('document.querySelector("#painted").textContent'), '0', 'Library change explicitly clears canvas');
  await evaluate('document.querySelector("#example").click()'); await settle();
  const legacyExample = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'profiles-8.png'), Buffer.from(legacyExample.data, 'base64'));
  await evaluate('(()=>{const select=document.querySelector("#library");select.value="32";select.dispatchEvent(new Event("change"));})()'); await settle();
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await settle();
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'No mobile horizontal overflow');
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
  box = await evaluate('(()=>{const b=document.querySelector("#paint").getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()');
  await evaluate('document.querySelector("#clear").click()'); await settle();
  await evaluate('document.querySelector(\'[data-slot="5"]\').click()');
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.w * .2, y: box.y + box.h * .3 }] });
  await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.w * .8, y: box.y + box.h * .6 }] });
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle();
  assert.ok(Number(await evaluate('document.querySelector("#painted").textContent')) > 200, 'Touch paints a connected stroke');
  const mobile = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'mobile.png'), Buffer.from(mobile.data, 'base64'));
  await evaluate('document.querySelector("#clear").click()'); await settle();
  assert.equal(await evaluate('document.querySelector("#painted").textContent'), '0');
  assert.equal(await evaluate('document.querySelector("#paint").getContext("2d").getImageData(10,10,1,1).data[3]'), 0, 'Paper is transparent');
  assert.deepEqual(errors, []);
  console.log('Cell demo: mouse strokes, palette, grid, resize, touch, clear and runtime checks passed. Screenshots: work/tests/cell-brush/');
} finally { ws?.close(); child?.kill(); await server.close(); }
