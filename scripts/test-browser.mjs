import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const browserCandidates = [process.env.BENCHMARK_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let browser;
for (const candidate of browserCandidates) { try { await fs.access(candidate); browser = candidate; break; } catch { /* Try next installed browser. */ } }
if (!browser) throw new Error('Set BENCHMARK_BROWSER to a Chromium browser executable.');
await fs.mkdir('work/tests', { recursive: true });
const sceneProfile=process.argv.includes('--scene-profile');
const sceneBudget=Number(process.argv.find(arg=>arg.startsWith('--scene-cache-mib='))?.split('=')[1]??32);
if(![32,64,128].includes(sceneBudget))throw Error('Scene cache diagnostic budget must be 32, 64 or 128 MiB');
const sceneSuffix=sceneBudget===32?'':`-cache${sceneBudget}`;
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'studioodle-region-coverage-'));
const plugins=sceneProfile&&sceneBudget!==32?[{
  name:'diagnostic-cache-budget', enforce:'pre',
  transform(code,id){
    if(id.replaceAll('\\','/').endsWith('/src/editor/paintDisplayCache.ts'))
      return code.replace('const budget = 32 * 1024 * 1024;',`const budget = ${sceneBudget} * 1024 * 1024;`);
  },
}]:[];
const server = await createServer({ plugins, configFile: 'vite/config.dev.ts', server: { host: '127.0.0.1', port: 1433, strictPort: true, open: false } });
if (path.dirname(profile) !== os.tmpdir() || !path.basename(profile).startsWith('studioodle-region-coverage-')) throw Error('Unexpected test profile path');
let child, ws, cdp;
try {
  await server.listen();
  const graphics=sceneProfile?['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
  child = spawn(browser, ['--headless=new', ...graphics, '--no-first-run', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `http://127.0.0.1:1433/`], { windowsHide: true, stdio: 'ignore' });
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
    if(message.method==='Runtime.consoleAPICalled'&&String(message.params.args?.[0]?.value).startsWith('scene:'))console.log(...message.params.args.map(a=>a.value));
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
  if(sceneProfile){
    await cdp('Page.bringToFront');
    await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
    await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});
    const setup=await evaluate("import('/tests/browser/advanced-scene.ts').then(m=>m.prepareAdvancedScene())");
    console.log('Advanced scene setup:',JSON.stringify(setup));
    const runs=[];
    for(const [label,rate,dpr] of [['native',1,1],['high-dpi',1,2],['cpu-4x-high-dpi',4,2]]){
      await cdp('Emulation.setCPUThrottlingRate',{rate});
      const {diagnosticPng,document,...metrics}=await evaluate(`import('/tests/browser/advanced-scene.ts').then(m=>m.profileAdvancedScene(${dpr}))`);
      await fs.writeFile(`work/tests/advanced-scene${sceneSuffix}-${label}.png`,Buffer.from(diagnosticPng.split(',')[1],'base64'));
      await fs.writeFile('work/tests/advanced-scene-picture.json',JSON.stringify(document));
      runs.push({label,mainThreadCpuSlowdown:rate,...metrics});
      await fs.writeFile(`work/tests/advanced-scene${sceneSuffix}-results.json`,JSON.stringify({cacheBudgetMiB:sceneBudget,setup,runs},null,2));
      console.log('Advanced scene:',label,JSON.stringify({...metrics,phases:{...metrics.phases,worker:{...metrics.phases.worker,raw:undefined,fills:undefined}}}));
    }
    await cdp('Emulation.setCPUThrottlingRate',{rate:1});
    if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  }else{
  const firstFill = await evaluate("import('/tests/browser/first-fill.ts').then(m => m.checkFirstFill())");
  console.log('First fill:',JSON.stringify(firstFill));
  const result = await evaluate("import('/tests/browser/region-coverage.ts').then(m => m.checkRegionCoverage())");
  const vectorPaint = await evaluate("import('/tests/browser/vector-paint.ts').then(m => m.checkVectorPaint())");
  if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  if(vectorPaint.diagnosticPng){await fs.writeFile('work/tests/moon-vector-paint.png',Buffer.from(vectorPaint.diagnosticPng.split(',')[1],'base64'));delete vectorPaint.diagnosticPng;}
  const paintDisplay = await evaluate("import('/tests/browser/paint-display.ts').then(m => m.checkPaintDisplay())");
  result.paintDisplay=paintDisplay;
  console.log('Paint display:',JSON.stringify(paintDisplay));
  result.pictureStorage=await evaluate("import('/tests/browser/picture-storage.ts').then(m=>m.checkPictureStorage())");
  console.log('Picture storage:',JSON.stringify(result.pictureStorage));
  const canvasEditor = await evaluate("import('/tests/browser/canvas-editor.ts').then(m => m.checkCanvasEditor())");
  console.log('Canvas editor:', JSON.stringify(canvasEditor));
  result.canvasEditor = canvasEditor;
  const seams=await evaluate("import('/tests/browser/seams.ts').then(m => m.checkPaintSeams())");
  await fs.writeFile('work/tests/paint-seams.png',Buffer.from(seams.diagnosticPng.split(',')[1],'base64'));delete seams.diagnosticPng;
  console.log('Paint seams:',JSON.stringify(seams));
  if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  result.paintSeams=seams;
  result.vectorPaint=vectorPaint;
  result.firstFill=firstFill;
  if(result.diagnosticPng){await fs.writeFile('work/tests/moon-belt-runtime.png',Buffer.from(result.diagnosticPng.split(',')[1],'base64'));delete result.diagnosticPng;}
  // Real React composition and trusted browser input, including the touch router.
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error(`App interaction timed out: ${expression}`);
  };
  await waitFor('!!document.querySelector(".choice-blank")');
  await evaluate('document.querySelector(".choice-blank").click()');
  await waitFor('!!document.querySelector("dialog[open] .wizard-footer .go-button")');
  await evaluate('document.querySelector("dialog[open] .wizard-footer .go-button").click()');
  await waitFor('!!document.querySelector("[aria-label^=Canvas]")');
  await evaluate('document.querySelector("dialog[open] .wizard-footer .go-button").click()');
  await waitFor('!!document.querySelector(".canvas-host canvas")');
  await evaluate('document.querySelector("button[aria-label=Brush]").click()');
  const at = await evaluate('(()=>{const b=document.querySelector(".canvas-host").getBoundingClientRect();return {x:b.left+b.width*.4,y:b.top+b.height*.4};})()');
  await cdp('Input.dispatchMouseEvent', {type:'mousePressed',...at,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent', {type:'mouseMoved',x:at.x+40,y:at.y+20,buttons:1});
  await cdp('Input.dispatchMouseEvent', {type:'mouseReleased',x:at.x+40,y:at.y+20,button:'left',buttons:0,clickCount:1});
  await evaluate('document.querySelector("button[aria-label^=Save]").click()');
  await waitFor('!!document.querySelector(".choice-blank")');
  const savedDocument = await evaluate('(async()=> (await (await import("/src/app/pictures.ts")).pictureRepository.load())[0].document)()');
  if (!savedDocument.surfaces[0].vectorPaint?.regions[0]?.blobs.length) throw Error('Trusted mouse drawing was not saved');
  await evaluate('document.querySelector(".previous-picture").click()');
  await waitFor('!!document.querySelector(".canvas-host canvas")');
  await evaluate('document.querySelector("button[aria-label=Brush]").click()');
  const touchAt = await evaluate('(()=>{const b=document.querySelector(".canvas-host").getBoundingClientRect();return {x:b.left+b.width*.6,y:b.top+b.height*.6};})()');
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touchAt,id:1}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchAt.x+15,y:touchAt.y,id:1}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchAt.x+15,y:touchAt.y,id:1},{x:touchAt.x+50,y:touchAt.y+30,id:2}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await evaluate('document.querySelector("button[aria-label^=Save]").click()');
  await waitFor('!!document.querySelector(".choice-blank")');
  const afterPinch = await evaluate('(async()=> (await (await import("/src/app/pictures.ts")).pictureRepository.load())[0].document)()');
  const unchanged = await evaluate(`import('/tests/browser/helpers.ts').then(({normalizedPaintDocument}) =>
    JSON.stringify(normalizedPaintDocument(${JSON.stringify(savedDocument)})) === JSON.stringify(normalizedPaintDocument(${JSON.stringify(afterPinch)})))`);
  if(!unchanged){
    await fs.writeFile('work/tests/touch-before.json',JSON.stringify(savedDocument));
    await fs.writeFile('work/tests/touch-after.json',JSON.stringify(afterPinch));
    throw Error('Two-finger gesture did not roll back its partial stroke');
  }
  result.appInteraction={trustedMouse:true,saveReopen:true,touchCancellation:true};
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
  await fs.writeFile('work/tests/app-after-reopen.png',Buffer.from(screenshot.data,'base64'));
  if(process.argv.includes('--dense-profile')){
    const {diagnosticPng,...metrics}=await evaluate("import('/tests/browser/dense-paint.ts').then(m=>m.profileDensePaint())");
    await fs.writeFile('work/tests/dense-paint.json',JSON.stringify(metrics,null,2));
    await fs.writeFile('work/tests/dense-paint.png',Buffer.from(diagnosticPng.split(',')[1],'base64'));
    console.log('Dense paint profile:',JSON.stringify(metrics));
  }
  if(process.argv.includes('--brush-profile')){
    const profile=await evaluate("import('/tests/browser/brush-performance.ts').then(m=>m.profileBrush())");
    await fs.writeFile('work/tests/brush-profile.json',JSON.stringify(profile,null,2));
    console.log('Brush profile:',JSON.stringify(profile));
  }
  if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  await fs.writeFile('work/tests/region-coverage-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  }

} finally {
  if (cdp) { try { await Promise.race([cdp('Browser.close'),new Promise(resolve => setTimeout(resolve, 1000))]); } catch { /* Browser may already have closed. */ } }
  ws?.close(); child?.kill(); await server.close();
  // This profile was created by this run; do not accumulate browser test caches.
  await fs.rm(profile, {recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(error=>console.warn('Could not remove temporary browser profile:',error.message));
}

