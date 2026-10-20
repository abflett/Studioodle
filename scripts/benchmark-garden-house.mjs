import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'vite';

const libraryMode = process.argv.includes('--library');
if (libraryMode) execFileSync(process.execPath, ['scripts/capture-svg-baseline.mjs'], { stdio: 'inherit' });
const benchmarkPath = libraryMode ? 'svg-migration' : 'garden-house';
const runFunction = libraryMode ? 'runLibraryBenchmark' : 'runHouseBenchmark';
const browserCandidates = [process.env.BENCHMARK_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let browser;
for (const candidate of browserCandidates) { try { await fs.access(candidate); browser = candidate; break; } catch { /* Try next installed browser. */ } }
if (!browser) throw new Error('Set BENCHMARK_BROWSER to a Chromium browser executable.');
await fs.mkdir('work/garden-house', { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'studioodle-house-benchmark-'));
const server = await createServer({ configFile: 'vite/config.dev.ts', server: { host: '127.0.0.1', port: 1433, strictPort: true, open: false } });
let child, ws, cdp;
try {
  await server.listen();
  child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `http://127.0.0.1:1433/experiments/${benchmarkPath}/index.html`], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  if (!port) throw new Error('Browser did not expose its benchmark endpoint');
  let target;
  for (let i = 0; i < 100; i++) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = targets.find(t => t.type === 'page' && t.url.includes(`/experiments/${benchmarkPath}/`));
    if (target) break; await new Promise(r => setTimeout(r, 100));
  }
  if (!target) throw new Error('Benchmark page did not open');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (!message.id) return; const request = pending.get(message.id); pending.delete(message.id); if (message.error) request?.reject(Error(JSON.stringify(message.error))); else request?.resolve(message.result); });
  cdp = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => { const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  for (let i = 0; i < 100; i++) { if (await evaluate(`typeof window.${runFunction} === "function"`)) break; await new Promise(r => setTimeout(r, 100)); }
  console.log('Browser loaded; comparing both implementations with the same paint engine.');
  const result = await evaluate(`window.${runFunction}()`);
  result.browser = await cdp('Browser.getVersion');
  if (libraryMode) {
    const baseline = JSON.parse(await fs.readFile('experiments/svg-migration/baseline.json', 'utf8'));
    const files = await Promise.all(baseline.assets.map(async asset => {
      const bytes = await fs.readFile(`src/assets/vector/${asset.id}.svg`);
      return { id: asset.id, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }));
    result.files = { beforeCommit: baseline.commit, beforeBytes: baseline.assets.reduce((n,a)=>n+a.jsonBytes+a.svgBytes,0), beforeGzipBytes: baseline.assets.reduce((n,a)=>n+a.gzipBytes,0), afterBytes: files.reduce((n,a)=>n+a.bytes,0), afterGzipBytes: files.reduce((n,a)=>n+a.gzipBytes,0), assets: files };
  } else {
  const baseline = JSON.parse(await fs.readFile('experiments/garden-house/baseline.json', 'utf8'));
  const svgBytes = await fs.readFile('src/assets/vector/garden-house.svg');
  result.files = {
    beforeCommit: baseline.commit,
    before: { bytes: baseline.files.json.bytes + baseline.files.svg.bytes, gzipBytes: baseline.files.json.gzipBytes + baseline.files.svg.gzipBytes },
    after: { bytes: svgBytes.length, gzipBytes: gzipSync(svgBytes).length, sha256: createHash('sha256').update(svgBytes).digest('hex') },
  };
  }
  result.memory = {};
  for (const mode of libraryMode ? [] : ['none', 'before', 'direct', 'after', 'none']) {
    await evaluate(`window.retainHouseDefinitions(${JSON.stringify(mode)}, 10)`);
    await cdp('HeapProfiler.collectGarbage');
    const key = mode === 'none' && result.memory.none ? 'cleanup' : mode;
    result.memory[key] = await cdp('Runtime.getHeapUsage');
  }
  result.memory.note = libraryMode ? 'Typed-array bytes are reported per asset; full-process/native graphics memory and peak allocation are not measured.' : 'Ten retained definitions per method after forced GC; JS/backing-storage values do not include all native graphics memory. The second none sample is the cleanup baseline.';
  await fs.writeFile(`experiments/${benchmarkPath}/results.json`, JSON.stringify(result, null, 2) + '\n');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
  const shotHeight = libraryMode ? await evaluate('Math.ceil(document.querySelector("#gallery").getBoundingClientRect().bottom + 16)') : 720;
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1600, height: shotHeight, scale: 1 } });
  await fs.writeFile('work/garden-house/comparison.png', Buffer.from(shot.data, 'base64'));
  await fs.writeFile(`experiments/${benchmarkPath}/comparison.png`, Buffer.from(shot.data, 'base64'));
  if (libraryMode && result.failures.length) process.exitCode = 1;
  console.log(JSON.stringify(libraryMode ? {totalAssets:result.totalAssets,totalRegions:result.totalRegions,failures:result.failures,files:result.files,rows:result.rows.map(r=>({id:r.id,missing:r.comparison.missingIds,inkDifference:r.inkPixelDifferences,interior:r.comparison.interiorDifferences,checks:r.checks}))} : result, null, 2));
} finally {
  if (cdp) { try { await cdp('Browser.close'); } catch { /* Browser may already have closed. */ } }
  ws?.close(); child?.kill(); await server.close();
  // Leave the isolated temporary browser profile for diagnostics; never touch user profiles.
}
