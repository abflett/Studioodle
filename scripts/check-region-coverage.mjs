import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const browserCandidates = [process.env.BENCHMARK_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let browser;
for (const candidate of browserCandidates) { try { await fs.access(candidate); browser = candidate; break; } catch { /* Try next installed browser. */ } }
if (!browser) throw new Error('Set BENCHMARK_BROWSER to a Chromium browser executable.');
await fs.mkdir('work', { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'studioodle-region-coverage-'));
const server = await createServer({ configFile: 'vite/config.dev.ts', server: { host: '127.0.0.1', port: 1433, strictPort: true, open: false } });
let child, ws, cdp;
try {
  await server.listen();
  child = spawn(browser, ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `http://127.0.0.1:1433/`], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  if (!port) throw new Error('Browser did not expose its benchmark endpoint');
  let target;
  for (let i = 0; i < 100; i++) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = targets.find(t => t.type === 'page' && t.url.startsWith(`http://127.0.0.1:1433/`));
    if (target) break; await new Promise(r => setTimeout(r, 100));
  }
  if (!target) throw new Error('Benchmark page did not open');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map(), runtimeErrors=[];
  ws.addEventListener('message', event => { const message = JSON.parse(event.data);
    if(message.method==='Target.attachedToTarget')void (async()=>{
      const sessionId=message.params.sessionId;
      await cdp('Debugger.enable',{},sessionId);
      await cdp('Debugger.setAsyncCallStackDepth',{maxDepth:32},sessionId);
      await cdp('Runtime.runIfWaitingForDebugger',{},sessionId);
    })().catch(error=>runtimeErrors.push(String(error)));
    if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails);
    if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')runtimeErrors.push(message.params.args);
    if (!message.id) return; const request = pending.get(message.id); pending.delete(message.id); if (message.error) request?.reject(Error(JSON.stringify(message.error))); else request?.resolve(message.result); });
  cdp = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params, sessionId })); });
  const evaluate = async expression => { const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  if(process.argv.includes('--debugger')){
    await cdp('Debugger.enable');await cdp('Debugger.setAsyncCallStackDepth',{maxDepth:32});
    await cdp('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  }
  await cdp('Page.navigate', { url: 'http://127.0.0.1:1433/' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('location.origin === "http://127.0.0.1:1433" && document.readyState !== "loading"')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const firstFill = await evaluate("import('/experiments/vector-paint/first-fill.ts').then(m => m.checkFirstFill())");
  console.log('First fill:',JSON.stringify(firstFill));
  const result = await evaluate("import('/experiments/region-coverage/check.ts').then(m => m.checkRegionCoverage())");
  const vectorPaint = await evaluate("import('/experiments/vector-paint/check.ts').then(m => m.checkVectorPaint())");
  if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  if(vectorPaint.diagnosticPng){await fs.writeFile('work/moon-vector-paint.png',Buffer.from(vectorPaint.diagnosticPng.split(',')[1],'base64'));delete vectorPaint.diagnosticPng;}
  const seams=await evaluate("import('/experiments/vector-paint/seams.ts').then(m => m.checkPaintSeams())");
  await fs.writeFile('work/paint-seams.png',Buffer.from(seams.diagnosticPng.split(',')[1],'base64'));delete seams.diagnosticPng;
  console.log('Paint seams:',JSON.stringify(seams));
  if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  result.paintSeams=seams;
  result.vectorPaint=vectorPaint;
  result.firstFill=firstFill;
  if(result.diagnosticPng){await fs.writeFile('work/moon-belt-runtime.png',Buffer.from(result.diagnosticPng.split(',')[1],'base64'));delete result.diagnosticPng;}
  await fs.writeFile('work/region-coverage-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

} finally {
  if (cdp) { try { await Promise.race([cdp('Browser.close'),new Promise(resolve => setTimeout(resolve, 1000))]); } catch { /* Browser may already have closed. */ } }
  ws?.close(); child?.kill(); await server.close();
  // Leave the isolated temporary browser profile for diagnostics; never touch user profiles.
}

