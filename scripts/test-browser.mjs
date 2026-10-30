import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'vite';

const browserCandidates = [process.env.BENCHMARK_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let browser;
for (const candidate of browserCandidates) { try { await fs.access(candidate); browser = candidate; break; } catch { /* Try next installed browser. */ } }
if (!browser) throw new Error('Set BENCHMARK_BROWSER to a Chromium browser executable.');
await fs.mkdir('work/tests', { recursive: true });
const libraryProfile=process.argv.includes('--library-profile');
const memoryProfile=process.argv.includes('--memory-profile');
const sceneProfile=process.argv.includes('--scene-profile');
const sceneBudget=Number(process.argv.find(arg=>arg.startsWith('--scene-cache-mib='))?.split('=')[1]??64);
if(![32,64,128].includes(sceneBudget))throw Error('Scene cache diagnostic budget must be 32, 64 or 128 MiB');
const repeat=Number(process.argv.find(arg=>arg.startsWith('--scene-repeat='))?.split('=')[1]??1);
if(![1,2].includes(repeat))throw Error('Scene repeat must be 1 or 2');
const sceneSuffix=`-cache${sceneBudget}`;
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'studioodle-region-coverage-'));
const baseline=process.argv.includes('--paint-baseline');
const paintBaselineFiles=new Map(baseline?['VectorPaint.ts','vectorPaintGeometry.ts','polygonGeometry.ts'].map(name=>[name,execFileSync('git',['show',`26074b6:src/editor/${name}`],{encoding:'utf8'})]):[]);
const plugins=sceneProfile?[{
  name:'diagnostic-cache-budget', enforce:'pre',
  transform(code,id){
    if(id.replaceAll('\\','/').endsWith('/src/editor/paintDisplayCache.ts'))
      return code.replace(/export const paintDisplayBudget = \d+ \* 1024 \* 1024;/,`export const paintDisplayBudget = ${sceneBudget} * 1024 * 1024;`);
  },
}]:baseline?[{name:'paint-baseline',enforce:'pre',transform(code,id){return paintBaselineFiles.get(id.replaceAll('\\','/').split('/').at(-1));}}]:[];
const server = await createServer({ plugins, configFile: process.argv.includes('--artwork-review') ? 'tools/artwork-review/vite.config.ts' : 'vite/config.dev.ts', server: { host: '127.0.0.1', port: 1433, strictPort: true, open: false } });
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
  if (process.argv.includes('--artwork-review')) await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `globalThis.reviewRepo = ${JSON.stringify('/@fs/' + process.cwd().split(path.sep).join('/') + '/')};` });
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
  if(process.argv.includes('--artwork-review')){
    const { checkArtworkReview } = await import('../tests/artwork-review.browser.mjs');
    await checkArtworkReview({ cdp, evaluate });
    const { checkArtworkClosures } = await import('../tests/artwork-closures.browser.mjs');
    try { await checkArtworkClosures({ cdp, evaluate }); }
    catch (error) { if(runtimeErrors.length)console.log('Artwork review runtime errors:',JSON.stringify(runtimeErrors)); throw error; }
    const { checkArtworkQueue } = await import('../tests/artwork-queue.browser.mjs');
    await checkArtworkQueue({ cdp, evaluate });
    if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  }else if(process.argv.includes('--save-profile')){
    const metrics = await evaluate("import('/tests/browser/save-performance.ts').then(m=>m.profileSavePerformance())");
    await fs.writeFile('work/tests/save-performance-results.json', JSON.stringify(metrics, null, 2));
    console.log('Save performance:', JSON.stringify(metrics));
  }else if(process.argv.includes('--gallery-loading')){
    const layouts=[];
    for(const [width,height] of [[1280,900],[390,844],[320,568],[844,390]]){
      await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      for(const format of ['portrait','square','landscape'])for(const phase of ['thumbnail','opening']){
        layouts.push(await evaluate(`import('/tests/browser/gallery-loading.ts').then(m=>m.showGalleryLoading('${format}','${phase}'))`));
        const shot=await cdp('Page.captureScreenshot',{format:'png'});
        await fs.writeFile(`work/tests/gallery-${width}-${format}-${phase}.png`,Buffer.from(shot.data,'base64'));
      }
    }
    await evaluate("import('/tests/browser/gallery-loading.ts').then(m=>m.closeGalleryLoading())");
    console.log('Gallery loading:',JSON.stringify(layouts));
    if(runtimeErrors.length)throw Error(JSON.stringify(runtimeErrors));
  }else if(process.argv.includes('--paint-profile')){
    const brush=await evaluate("import('/tests/browser/brush-performance.ts').then(async m=>{const runs=[];for(let i=0;i<3;i++)runs.push(await m.profileBrush());return runs;})");
    const model=await evaluate("import('/tests/fixtures/paint-workloads.ts').then(m=>[m.profilePaintModel(),m.profilePaintModel(),m.profilePaintModel()])");
    console.log('Paint profile:',JSON.stringify({brush,model}));
    await fs.writeFile(`work/tests/paint-browser-${baseline?'before':'after'}.json`,JSON.stringify({brush,model},null,2));
    if(runtimeErrors.length)throw Error(JSON.stringify(runtimeErrors));
  }else if(process.argv.includes('--raster-spray')){
    const result=await evaluate("import('/tests/browser/raster-spray.ts').then(m=>m.checkRasterSpray(true))");
    const preview=result.preview;delete result.preview;
    await fs.writeFile('work/tests/raster-spray.png',Buffer.from(preview.split(',')[1],'base64'));
    console.log('Raster spray:',JSON.stringify(result));
    await fs.writeFile('work/tests/raster-spray.json',JSON.stringify(result,null,2));
    if(runtimeErrors.length)throw Error(JSON.stringify(runtimeErrors));
  }else if(process.argv.includes('--picture-output-only')){
    const result=await evaluate("import('/tests/browser/picture-output.ts').then(m=>m.checkPictureOutput())");
    console.log('Picture output:',result.vectorPrint,result.printFailure,result.downloadCleanup);
    if(runtimeErrors.length)throw Error(JSON.stringify(runtimeErrors));
  }else if(process.argv.includes('--storage-ui')){
    console.log('Library UI:',await evaluate("import('/tests/browser/library-state.ts').then(m=>m.checkLibraryState())"));
    console.log('Coloring pages:',await evaluate("import('/tests/browser/coloring-page-picker.ts').then(m=>m.checkColoringPagePicker())"));
    console.log('Page action:',await evaluate("import('/tests/browser/coloring-page-action.ts').then(m=>m.checkColoringPageAction())"));
    if(runtimeErrors.length)throw Error(JSON.stringify(runtimeErrors));
  }else if(process.argv.includes('--storage-thumbnails')){
    const checks=await evaluate("import('/tests/browser/storage-thumbnails.ts').then(m=>m.checkStorageThumbnails())");
    const scale=await evaluate("import('/tests/browser/storage-thumbnails.ts').then(m=>m.profileThumbnailLibrary())");
    console.log('Storage and thumbnails:',JSON.stringify({checks,scale}));
    await fs.writeFile('work/tests/storage-thumbnails.json',JSON.stringify({checks,scale},null,2));
    if(runtimeErrors.length)throw Error(JSON.stringify(runtimeErrors));
  }else if(libraryProfile){
    const setup=await evaluate("import('/tests/browser/picture-library-profile.ts').then(m=>m.prepareLibraryProfile())");
    const samples=[];
    const sample=async(label,metrics)=>{
      await cdp('HeapProfiler.collectGarbage');
      const heap=await cdp('Runtime.getHeapUsage');
      const retained=await evaluate("import('/tests/browser/picture-library-profile.ts').then(m=>m.libraryRetained())");
      const value={label,...metrics,heap,retained};samples.push(value);
      console.log('Library sample:',JSON.stringify(value));
      if(retained.liveLoadedRecords>retained.cachedDrawings)throw Error('Evicted drawings were retained');
    };
    await sample('summaries');
    for(const index of [0,60,61,100,20,80]){
      const metrics=await evaluate(`import('/tests/browser/picture-library-profile.ts').then(m=>m.selectLibraryPicture(${index}))`);
      await sample(`selected-${index}`,metrics);
    }
    await evaluate("import('/tests/browser/picture-library-profile.ts').then(m=>m.disposeLibraryProfile())");
    await sample('disposed');
    await evaluate("import('/tests/browser/picture-library-profile.ts').then(m=>m.cleanupLibraryProfile())");
    await fs.writeFile('work/tests/picture-library-results.json',JSON.stringify({setup,samples},null,2));
    if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  }else if(memoryProfile){
    await cdp('Page.bringToFront');
    const setup=await evaluate("import('/tests/browser/document-memory.ts').then(m=>m.prepareMemoryFixture())");
    const samples=[];
    const sample=async(label)=>{
      await cdp('HeapProfiler.collectGarbage');
      const heap=await cdp('Runtime.getHeapUsage'),dom=await cdp('Memory.getDOMCounters');
      const resources=await evaluate("import('/tests/browser/document-memory.ts').then(m=>m.memoryResources())");
      const value={label,heap,dom,resources};samples.push(value);console.log('Memory sample:',JSON.stringify(value));
      await fs.writeFile('work/tests/document-memory-results.json',JSON.stringify({setup,samples},null,2));
    };
    await sample('prepared');
    for(let cycle=1;cycle<=8;cycle++){
      const active=await evaluate("import('/tests/browser/document-memory.ts').then(m=>m.openMemoryCycle())");
      console.log('Memory active:',JSON.stringify({cycle,...active}));
      await sample(`active-${cycle}`);
      await evaluate("import('/tests/browser/document-memory.ts').then(m=>m.closeMemoryCycle())");
      await sample(`closed-${cycle}`);
    }
    const probe=await evaluate("import('/tests/browser/document-memory.ts').then(m=>m.openMemoryCycle(true))");
    console.log('Definition eviction probe:',JSON.stringify(probe));
    await sample('probe-active');
    await evaluate("import('/tests/browser/document-memory.ts').then(m=>m.closeMemoryCycle(false))");
    await sample('probe-closed');
    if(probe.duplicateDefinitions!==0)throw Error('Live sticker definitions were duplicated under cache pressure');
    const closed=samples.filter(s=>s.label.startsWith('closed-')||s.label==='probe-closed');
    for(const value of closed){
      if(value.resources.retainedSessions||value.resources.retainedArtwork)throw Error('Closed editor retained document objects: '+JSON.stringify(value));
      if(value.resources.canvasPixelBytes>value.resources.liveCanvases*4)throw Error('Closed editor retained canvas backing pixels: '+JSON.stringify(value));
    }
    const tail=closed.filter(s=>s.label.startsWith('closed-')).slice(-4);
    for(const field of ['usedSize','backingStorageSize']){
      const values=tail.map(s=>s.heap[field]);
      if(Math.max(...values)-Math.min(...values)>2*1024*1024)throw Error('Closed memory did not plateau: '+field);
    }
    await evaluate("import('/tests/browser/document-memory.ts').then(m=>m.cleanupMemoryFixture())");
    await fs.writeFile('work/tests/document-memory-results.json',JSON.stringify({setup,samples,probe},null,2));
    if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  }else if(sceneProfile){
    await cdp('Page.bringToFront');
    await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
    await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});
    const setup=await evaluate("import('/tests/browser/advanced-scene.ts').then(m=>m.prepareAdvancedScene())");
    console.log('Advanced scene setup:',JSON.stringify(setup));
    const runs=[];
    for(let repetition=1;repetition<=repeat;repetition++)for(const [label,rate,dpr] of [['native',1,1],['high-dpi',1,2],['cpu-4x-high-dpi',4,2]]){
      await cdp('Emulation.setCPUThrottlingRate',{rate});
      const {diagnosticPng,document,...metrics}=await evaluate(`import('/tests/browser/advanced-scene.ts').then(m=>m.profileAdvancedScene(${dpr}))`);
      await fs.writeFile(`work/tests/advanced-scene${sceneSuffix}-${label}-run${repetition}.png`,Buffer.from(diagnosticPng.split(',')[1],'base64'));
      await fs.writeFile('work/tests/advanced-scene-picture.json',JSON.stringify(document));
      runs.push({label,repetition,mainThreadCpuSlowdown:rate,...metrics});
      await fs.writeFile(`work/tests/advanced-scene${sceneSuffix}-results.json`,JSON.stringify({cacheBudgetMiB:sceneBudget,setup,runs},null,2));
      console.log('Advanced scene:',label,JSON.stringify({...metrics,phases:{...metrics.phases,worker:{...metrics.phases.worker,raw:undefined,fills:undefined}}}));
    }
    await cdp('Emulation.setCPUThrottlingRate',{rate:1});
    if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  }else{
  const output = await evaluate("import('/tests/browser/picture-output.ts').then(m => m.checkPictureOutput())");
  await fs.writeFile('work/tests/vector-output.svg', output.svg);
  await fs.writeFile('work/tests/vector-output.pdf', Buffer.from(output.pdf, 'base64'));
  for (const key of ['actualPng', 'referencePng']) await fs.writeFile(`work/tests/vector-output-${key}.png`, Buffer.from(output[key].split(',')[1], 'base64'));
  // Exercise Chromium's actual print-to-PDF pipeline using the adapter's HTML.
  const printTarget = await cdp('Target.createTarget', { url: 'about:blank' });
  try {
    const { sessionId } = await cdp('Target.attachToTarget', { targetId: printTarget.targetId, flatten: true });
    await cdp('Page.enable', {}, sessionId);
    const { frameTree } = await cdp('Page.getFrameTree', {}, sessionId);
    await cdp('Page.setDocumentContent', { frameId: frameTree.frame.id, html: output.printHtml }, sessionId);
    const printed = await cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true }, sessionId);
    const bytes = Buffer.from(printed.data, 'base64');
    await fs.writeFile('work/tests/vector-printed.pdf', bytes);
    if (/\/Subtype\s*\/Image\b/.test(bytes.toString('latin1'))) throw Error('Browser printing rasterized vector artwork');
  } finally { await cdp('Target.closeTarget', { targetId: printTarget.targetId }); }
  for (const key of ['svg', 'pdf', 'actualPng', 'referencePng', 'printHtml']) delete output[key];

  console.log('Picture output:', JSON.stringify(output));
  if (output.meanError >= 2 || output.differentFraction >= .03) throw Error('SVG differs from editor: '+JSON.stringify(output));
  console.log('Blank paper:', await evaluate("import('/tests/browser/blank-page-setup.ts').then(m => m.checkBlankPageSetup())"));
  console.log('Coloring pages:', await evaluate("import('/tests/browser/coloring-page-picker.ts').then(m => m.checkColoringPagePicker())"));
  console.log('Paper view:', await evaluate("import('/tests/browser/paper-view.ts').then(m => m.checkPaperView())"));
  const cursors = await evaluate("import('/tests/browser/cursors.ts').then(m => m.checkCursors())");
  await fs.writeFile('work/tests/cursor-surfaces.png', Buffer.from(cursors.preview.split(',')[1], 'base64'));
  delete cursors.preview;
  console.log('Cursors:', JSON.stringify(cursors));
  const firstFill = await evaluate("import('/tests/browser/first-fill.ts').then(m => m.checkFirstFill())");
  console.log('First fill:',JSON.stringify(firstFill));
  const result = await evaluate("import('/tests/browser/region-coverage.ts').then(m => m.checkRegionCoverage())");
  const vectorPaint = await evaluate("import('/tests/browser/vector-paint.ts').then(m => m.checkVectorPaint())");
  if(runtimeErrors.length)throw Error(`Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);
  if(vectorPaint.diagnosticPng){await fs.writeFile('work/tests/moon-vector-paint.png',Buffer.from(vectorPaint.diagnosticPng.split(',')[1],'base64'));delete vectorPaint.diagnosticPng;}
  const paintDisplay = await evaluate("import('/tests/browser/paint-display.ts').then(m => m.checkPaintDisplay())");
  result.paletteColors=await evaluate("import('/tests/browser/palette-colors.ts').then(m=>m.checkPaletteColors())");
  console.log('Palette colors:',JSON.stringify(result.paletteColors));
  result.pictureOutput=output;
  result.libraryState=await evaluate("import('/tests/browser/library-state.ts').then(m => m.checkLibraryState())");
  result.paintDisplay=paintDisplay;
  console.log('Paint display:',JSON.stringify(paintDisplay));
  result.rasterSpray=await evaluate("import('/tests/browser/raster-spray.ts').then(m=>m.checkRasterSpray())");
  result.storageThumbnails=await evaluate("import('/tests/browser/storage-thumbnails.ts').then(m=>m.checkStorageThumbnails())");
  result.pictureStorage=await evaluate("import('/tests/browser/picture-storage.ts').then(m=>m.checkPictureStorage())");
  console.log('Picture storage:',JSON.stringify(result.pictureStorage));
  const canvasEditor = await evaluate("import('/tests/browser/canvas-editor.ts').then(m => m.checkCanvasEditor())");
  console.log('Canvas editor:', JSON.stringify(canvasEditor));
  result.canvasEditor = canvasEditor;
  result.selectionExit = await evaluate("import('/tests/browser/selection-exit.ts').then(m => m.checkSelectionExit())");
  console.log('Selection:', JSON.stringify(result.selectionExit));
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
  if(await evaluate(`!!document.querySelector('[aria-label="Coloring page workshop"], .workshop-dialog')`))throw Error('Developer workshop must not be exposed in the editor');

  await evaluate(`document.querySelector('button[aria-label="Fill"]').click()`);
  await waitFor(`document.querySelector('button[aria-label="Fill"]').getAttribute('aria-pressed')==='true'&&!document.querySelector('dialog[open]')`);
  if(await evaluate(`document.querySelector('button[aria-label="Fill"]').hasAttribute('aria-haspopup')`))throw Error('Fill must select directly, without a popup');
  await evaluate(`document.querySelector('button[aria-label="Move the page"]').click();document.activeElement.blur()`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'g',code:'KeyG',windowsVirtualKeyCode:71});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'g',code:'KeyG',windowsVirtualKeyCode:71});
  await waitFor(`document.querySelector('button[aria-label="Fill"]').getAttribute('aria-pressed')==='true'&&!document.querySelector('dialog[open]')`);

  const clickFirstCustomSlot=async()=>{
    const point=await evaluate(`(()=>{const r=document.querySelectorAll('.palette-swatch')[0].getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
  };
  await evaluate(`document.querySelector('button[aria-label="Colors"]').click()`);
  await waitFor(`document.querySelectorAll('.color-palette-tab').length===5`);
  for(const name of ['Everyday','Pastel','Vivid','Moody','Custom']){
    await evaluate(`document.querySelector('button[aria-label="${name} palette"]').click()`);
    await waitFor(`document.querySelector('button[aria-label="${name} palette"]').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('.palette-swatch').length===32`);
  }
  if(await evaluate(`document.querySelectorAll('.palette-swatch.is-empty').length`)!==32)throw Error('New custom palettes must start empty');
  for(const [width,height] of [[1000,760],[390,844],[320,568],[844,390]]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for(const theme of ['dark','light']){
      await evaluate(`document.documentElement.dataset.theme='${theme}'`);
      const fit=await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const d=document.querySelector('.palette-dialog'),r=d.getBoundingClientRect();resolve(r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth)})))`);
      if(!fit)throw Error(`Palette overflows ${width}x${height} ${theme}`);
      const shot=await cdp('Page.captureScreenshot',{format:'png'});await fs.writeFile(`work/tests/palette-${width}x${height}-${theme}.png`,Buffer.from(shot.data,'base64'));
    }
  }
  await cdp('Emulation.clearDeviceMetricsOverride');
  await clickFirstCustomSlot();
  await waitFor(`!!document.querySelector('.palette-custom-dialog[open]')`);
  const initialCustomHex=await evaluate(`document.querySelector('.custom-hex-field').value`);
  await evaluate(`document.querySelector('.custom-sv-field').focus()`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38});
  if(await evaluate(`document.querySelector('.custom-hex-field').value`)===initialCustomHex)throw Error('Saturation/brightness must support keyboard input');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await waitFor(`!document.querySelector('.palette-custom-dialog')&&document.querySelectorAll('.palette-swatch.is-empty').length===32&&document.activeElement===document.querySelectorAll('.palette-swatch')[0]`);
  await clickFirstCustomSlot();
  await waitFor(`!!document.querySelector('.palette-custom-dialog[open]')`);
  const customPickerShot=await cdp('Page.captureScreenshot',{format:'png'});await fs.writeFile('work/tests/custom-color-picker.png',Buffer.from(customPickerShot.data,'base64'));
  await evaluate(`document.querySelector('.custom-hex-field').focus();document.querySelector('.custom-hex-field').select()`);
  await cdp('Input.insertText',{text:'#3366CC'});
  await evaluate(`document.querySelector('button[aria-label="Apply custom color"]').click()`);
  await waitFor(`!document.querySelector('.palette-custom-dialog')&&!document.querySelector('.palette-dialog[open]')&&document.querySelector('.main-ribbon .ribbon-color-dot').style.background==='rgb(51, 102, 204)'`);
  await evaluate(`document.querySelector('button[aria-label="Colors"]').click()`);
  await waitFor(`document.querySelector('button[aria-label="Custom palette"]')?.getAttribute('aria-pressed')==='true'`);
  await evaluate(`document.querySelector('button[aria-label="Edit custom palette"]').click()`);
  await waitFor(`document.querySelector('button[aria-label="Finish editing custom palette"]')?.getAttribute('aria-pressed')==='true'`);
  await clickFirstCustomSlot();
  await waitFor(`!!document.querySelector('.palette-custom-dialog[open]')`);
  await evaluate(`document.querySelector('.custom-hex-field').focus();document.querySelector('.custom-hex-field').select()`);
  await cdp('Input.insertText',{text:'#GGGGGG'});
  await waitFor(`document.querySelector('button[aria-label="Apply custom color"]').disabled`);
  await evaluate(`document.querySelector('.custom-hex-field').select()`);await cdp('Input.insertText',{text:'#33AA66'});
  await evaluate(`document.querySelector('button[aria-label="Apply custom color"]').click()`);
  await waitFor(`!document.querySelector('.palette-custom-dialog')&&!!document.querySelector('.palette-dialog[open]')&&document.querySelector('.main-ribbon .ribbon-color-dot').style.background==='rgb(51, 170, 102)'`);
  await evaluate(`document.querySelector('.palette-dialog button[aria-label="Close picker"]').click()`);
  await waitFor(`!document.querySelector('.palette-dialog[open]')`);
  await evaluate(`document.querySelector('button[aria-label="Undo"]').click()`);
  await waitFor(`document.querySelector('.main-ribbon .ribbon-color-dot').style.background==='rgb(51, 102, 204)'`);
  await evaluate(`document.querySelector('button[aria-label="Stickers"]').click()`);
  await waitFor(`document.querySelectorAll('.sticker-category-grid button').length===10`);
  if(!await evaluate(`getComputedStyle(document.querySelector('.sticker-ink-button .ribbon-color-dot')).boxShadow==='none'&&getComputedStyle(document.querySelector('.sticker-ink-button .ribbon-color-dot')).borderWidth==='0px'`))throw Error('Sticker ink dot must match ribbon without border');
  for(const [width,height] of [[1000,720],[390,844],[320,568],[844,390]]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for(const theme of ['dark','light']){
      await evaluate(`document.documentElement.dataset.theme='${theme}'`);
      const fits=await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const d=document.querySelector('.sticker-dialog'),b=d.getBoundingClientRect();resolve(b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth&&[...d.querySelectorAll('button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom}));})))`);
      if(!fits)throw Error(`Sticker layout overflows ${width}x${height} ${theme}`);
      const shot=await cdp('Page.captureScreenshot',{format:'png'});await fs.writeFile(`work/tests/stickers-${width}x${height}-${theme}.png`,Buffer.from(shot.data,'base64'));
    }
  }
  await cdp('Emulation.clearDeviceMetricsOverride');
  await evaluate(`document.querySelector('button[aria-label="Medium stickers"]').click();document.querySelector('button[aria-label="Animals"]').click()`);
  await waitFor(`!!document.querySelector('.sticker-item')`);
  const filtered=await evaluate(`(async()=>{const {stickerCategories}=await import('/src/ui/stickerCatalog.ts');return [...document.querySelectorAll('.sticker-item')].every(b=>stickerCategories.find(c=>c.id==='animals').items.some(i=>i.title===b.getAttribute('aria-label')&&i.detail==='moderate'));})()`);
  if(!filtered)throw Error('Sticker difficulty must use authored metadata');
  if(await evaluate(`!!document.querySelector('button[aria-label="Next stickers"]')`))await evaluate(`document.querySelector('button[aria-label="Next stickers"]').click()`);
  const stickerBefore=await evaluate(`JSON.stringify([...document.querySelectorAll('.sticker-item')].map(b=>b.getAttribute('aria-label')))`);
  const paintColorBefore=await evaluate(`document.querySelector('.main-ribbon .ribbon-color-dot').style.background`);
  await evaluate(`document.querySelector('.sticker-ink-button').click()`);
  await waitFor(`!!document.querySelector('.sticker-ink-dialog[open]')`);
  await evaluate(`document.querySelector('.sticker-ink-dialog button[aria-label="White"]').click()`);
  await waitFor(`!document.querySelector('.sticker-ink-dialog')`);
  if(!await evaluate(`document.querySelector('.sticker-ink-button .ribbon-color-dot').style.background==='rgb(255, 255, 255)'&&document.activeElement===document.querySelector('.sticker-ink-button')`))throw Error('Ink selection must return focus and use selected RGB');
  if(await evaluate(`document.querySelector('.main-ribbon .ribbon-color-dot').style.background`)!==paintColorBefore||await evaluate(`JSON.stringify([...document.querySelectorAll('.sticker-item')].map(b=>b.getAttribute('aria-label')))`)!==stickerBefore)throw Error('Ink choice must preserve drawing color and browsing state');
  await evaluate(`document.querySelector('.sticker-ink-button').click()`);
  await waitFor(`!!document.querySelector('.sticker-ink-dialog[open]')`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await waitFor(`!document.querySelector('.sticker-ink-dialog')&&!!document.querySelector('.sticker-dialog[open]')`);
  await evaluate(`document.querySelector('.sticker-ink-button').click()`);
  await waitFor(`!!document.querySelector('.sticker-ink-dialog[open]')`);
  await evaluate(`document.querySelector('.sticker-ink-dialog button[aria-label="Black"]').click()`);
  await waitFor(`!document.querySelector('.sticker-ink-dialog')`);
  await evaluate(`document.querySelector('.sticker-dialog button[aria-label="Close picker"]').click()`);
  await waitFor(`!document.querySelector('.sticker-dialog[open]')`);
  await evaluate('document.querySelector("button[aria-label=Brush]").click()');
  await waitFor('!!document.querySelector("button[aria-label=" + JSON.stringify("Close picker") + "]")');
  await evaluate('document.querySelector("button[aria-label=" + JSON.stringify("Close picker") + "]").click()');
  await evaluate('document.querySelector("button[aria-label=Brush]").click()');
  await waitFor('!!document.querySelector(".brush-dialog[open]")');
  for (const [width,height] of [[1024,768],[390,844],[320,568],[844,390]]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for (const theme of ['dark','light']) {
      await evaluate(`document.documentElement.dataset.theme='${theme}'`);
      const layout=await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const d=document.querySelector('.brush-dialog'),b=d.getBoundingClientRect();
        const controls=[...d.querySelectorAll('button,input')].map(e=>e.getBoundingClientRect());
        resolve(b.height<320&&b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth&&controls.every(r=>r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom));
      })))`);
      if(!layout)throw Error(`Brush controls overflow at ${width}x${height} ${theme}`);
      const shot=await cdp('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(`work/tests/brush-${width}x${height}-${theme}.png`,Buffer.from(shot.data,'base64'));
    }
  }
  await cdp('Emulation.clearDeviceMetricsOverride');
  for(const label of ['Diagonal tip, rising','Diagonal tip, falling','Soft spray tip','Round tip']) {
    await evaluate(`document.querySelector('button[aria-label="${label}"]').click()`);
    await waitFor(`document.querySelector('button[aria-label="${label}"]').getAttribute('aria-pressed')==='true'`);
    if(await evaluate(`document.querySelectorAll('.brush-tip[aria-pressed="true"]').length`)!==1)throw Error('Brush tips must be exclusive');
  }
  await evaluate(`document.querySelector('button[aria-label="Make brush one unit larger"]').click()`);
  await waitFor(`document.querySelector('.brush-size-number').value==='6'`);
  for(const [text,expected] of [['64',64],['0',1],['6',6]]){
    await evaluate(`document.querySelector('.brush-size-number').focus();document.querySelector('.brush-size-number').select()`);
    await cdp('Input.insertText',{text});
    await waitFor(`document.querySelector('.brush-size-number').value==='${expected}'&&document.querySelector('.brush-size-slider').value==='${expected}'`);
    if(expected===64&&!await evaluate(`document.querySelector('button[aria-label="Make brush one unit larger"]').disabled`))throw Error('Brush maximum must disable increment');
    if(expected===1&&!await evaluate(`document.querySelector('button[aria-label="Make brush one unit smaller"]').disabled`))throw Error('Brush minimum must disable decrement');
  }
  await evaluate(`document.querySelector('.brush-size-slider').focus()`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await waitFor(`document.querySelector('.brush-size-number').value==='7'`);
  await evaluate(`document.querySelector('button[aria-label="Make brush one unit smaller"]').click()`);

  await evaluate(`document.querySelector('button[aria-label="Use this brush"]').click()`);
  await waitFor(`!document.querySelector('.brush-dialog[open]')`);
  await evaluate('document.querySelector("button[aria-label=Brush]").click()');
  await waitFor(`document.querySelector('.brush-size-number')?.value==='6'`);
  await evaluate(`document.querySelector('button[aria-label="Make brush one unit smaller"]').click()`);
  await evaluate(`document.querySelector('button[aria-label="Use this brush"]').click()`);
  await waitFor(`!document.querySelector('dialog[open]')`);
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  const at = await evaluate('(()=>{const b=document.querySelector(".canvas-host").getBoundingClientRect();return {x:b.left+b.width*.4,y:b.top+b.height*.4};})()');
  await cdp('Input.dispatchMouseEvent', {type:'mousePressed',...at,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent', {type:'mouseMoved',x:at.x+40,y:at.y+20,buttons:1});
  await cdp('Input.dispatchMouseEvent', {type:'mouseReleased',x:at.x+40,y:at.y+20,button:'left',buttons:0,clickCount:1});
  await evaluate('document.querySelector("button[aria-label=" + JSON.stringify("Go home") + "]").click()');
  await waitFor('!!document.querySelector(".choice-blank")');
  const savedDocument = await evaluate('(async()=>{const r=(await import("/src/app/pictures.ts")).pictureRepository;return (await r.get((await r.list())[0].id)).document;})()');
  if (!savedDocument.surfaces[0].vectorPaint?.regions[0]?.blobs.length) throw Error('Trusted mouse drawing was not saved');
  await waitFor('!!document.querySelector(".previous-picture:not(:disabled)")');
  await evaluate('document.querySelector(".previous-picture").click()');
  await waitFor('!!document.querySelector(".canvas-host canvas")');
  await evaluate('document.querySelector("button[aria-label=Brush]").click()');
  await waitFor('!!document.querySelector("button[aria-label=" + JSON.stringify("Close picker") + "]")');
  await evaluate('document.querySelector("button[aria-label=" + JSON.stringify("Close picker") + "]").click()');
  const touchAt = await evaluate('(()=>{const b=document.querySelector(".canvas-host").getBoundingClientRect();return {x:b.left+b.width*.6,y:b.top+b.height*.6};})()');
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touchAt,id:1}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchAt.x+15,y:touchAt.y,id:1}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchAt.x+15,y:touchAt.y,id:1},{x:touchAt.x+50,y:touchAt.y+30,id:2}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await evaluate(`document.querySelector('button[aria-label="Select and move stickers"]').click()`);
  await cdp('Input.dispatchMouseEvent', {type:'mousePressed',...touchAt,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent', {type:'mouseReleased',...touchAt,button:'left',buttons:0,clickCount:1});
  await waitFor(`document.querySelector('button[aria-label="Fill"]').getAttribute('aria-pressed')==='true'`);
  await evaluate('document.querySelector("button[aria-label=" + JSON.stringify("Go home") + "]").click()');
  await waitFor('!!document.querySelector(".choice-blank")');
  const afterPinch = await evaluate('(async()=>{const {pictureRepository:r,pictureSaves}=await import("/src/app/pictures.ts");await pictureSaves.flush();return (await r.get((await r.list())[0].id)).document;})()');
  const unchanged = await evaluate(`import('/tests/browser/helpers.ts').then(({normalizedPaintDocument}) =>
    JSON.stringify(normalizedPaintDocument(${JSON.stringify(savedDocument)})) === JSON.stringify(normalizedPaintDocument(${JSON.stringify(afterPinch)})))`);
  if(!unchanged){
    await fs.writeFile('work/tests/touch-before.json',JSON.stringify(savedDocument));
    await fs.writeFile('work/tests/touch-after.json',JSON.stringify(afterPinch));
    throw Error('Two-finger gesture did not roll back its partial stroke');
  }
  // Background failures remain visible after Home and can be retried without reopening.
  await evaluate(`(async()=>{
    const {pictureRepository:r}=await import('/src/app/pictures.ts');
    const picture=await r.get((await r.list())[0].id);
    globalThis.originalSavePut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){if(this.name==='pictures')throw Error('Injected save failure');return globalThis.originalSavePut.apply(this,args);};
    globalThis.failedSave=r.save({...picture,updatedAt:picture.updatedAt+1}).catch(()=>{});
  })()`);
  await waitFor(`!!document.querySelector('button[aria-label="Retry saving"]')`);
  await evaluate(`IDBObjectStore.prototype.put=globalThis.originalSavePut;delete globalThis.originalSavePut;document.querySelector('button[aria-label="Retry saving"]').click()`);
  await evaluate(`import('/src/app/pictures.ts').then(async ({pictureSaves})=>{if(!await pictureSaves.flush())throw Error('Save retry did not commit');delete globalThis.failedSave;})`);
  await waitFor(`!document.querySelector('button[aria-label="Retry saving"]')`);
  await waitFor(`!!document.querySelector('button[aria-label="Export selected saved picture"]:not(:disabled)')`);
  await evaluate(`document.querySelector('button[aria-label="Export selected saved picture"]').click()`);
  await waitFor(`!!document.querySelector('dialog[open] button[aria-label="Export as PDF"]')`);
  const exportOptions = await evaluate(`['PNG','SVG','PDF'].every(format => document.querySelector('dialog[open] button[aria-label="Export as '+format+'"]'))`);
  if (!exportOptions) throw Error('Export picker must offer PNG, SVG and PDF');
  if (await evaluate(`document.querySelector('#export-dpi').value`) !== '300') throw Error('Export dialog must default to 300 DPI');
  for (const [label,width,height] of [['desktop',900,700],['phone',390,740]]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for (const theme of ['dark','light']) {
      await evaluate(`document.documentElement.dataset.theme = '${theme}'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      const layout = await evaluate(`(() => {
        const dialog=document.querySelector('.export-dialog'), box=dialog.getBoundingClientRect();
        const copy=document.querySelector('.export-format-copy'), title=copy.querySelector('strong').getBoundingClientRect(), caption=copy.querySelector('span').getBoundingClientRect();
        return {inside:box.left>=0 && box.right<=innerWidth && box.top>=0 && box.bottom<=innerHeight && box.height<520, noOverflow:dialog.scrollWidth<=dialog.clientWidth, stacked:caption.top>=title.bottom && Math.abs(caption.left-title.left)<1};
      })()`);
      if (!layout.inside || !layout.noOverflow || !layout.stacked) throw Error('Export layout failed: '+JSON.stringify({label,theme,...layout}));
      const shot=await cdp('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(`work/tests/export-${label}-${theme}.png`,Buffer.from(shot.data,'base64'));
    }
  }
  await cdp('Emulation.clearDeviceMetricsOverride');
  await evaluate(`document.querySelector('#export-dpi').value='600'; document.querySelector('#export-dpi').dispatchEvent(new Event('change',{bubbles:true}))`);
  const resolutionUpdates = await evaluate(`import('/src/editor/exportResolution.ts').then(async ({exportDimensions}) => {
    const repository=(await import('/src/app/pictures.ts')).pictureRepository; const picture=await repository.get((await repository.list())[0].id);
    return document.querySelector('.export-pixel-size').textContent.includes(exportDimensions(picture,600).width.toLocaleString());
  })`);
  if (!resolutionUpdates) throw Error('Changing DPI must update the PNG dimensions');
  await evaluate(`document.querySelector('button[aria-label="Close export"]').click()`);
  // Export errors leave the overlay usable, then retry downloads the chosen format.
  await evaluate(`document.querySelector('button[aria-label="Export selected saved picture"]').click()`);
  await waitFor(`!!document.querySelector('dialog[open] button[aria-label="Export as SVG"]')`);
  await evaluate(`globalThis.originalExportUrl = URL.createObjectURL; URL.createObjectURL = () => { throw Error('Simulated download failure'); }; document.querySelector('button[aria-label="Export as SVG"]').click()`);
  await waitFor(`!!document.querySelector('dialog[open] [role="alert"]')`);
  await evaluate(`URL.createObjectURL = globalThis.originalExportUrl; delete globalThis.originalExportUrl;
    globalThis.exportCapture = {};
    globalThis.captureExport = event => { const link = event.target.closest('a[download]'); if (!link) return; event.preventDefault();
      globalThis.exportCapture.name = link.download; fetch(link.href).then(response => response.text()).then(text => { globalThis.exportCapture.text = text; }); };
    document.addEventListener('click', globalThis.captureExport, true);
    document.querySelector('button[aria-label="Export as SVG"]').click()`);
  await waitFor(`!!globalThis.exportCapture.text && !document.querySelector('dialog[open] button[aria-label="Export as SVG"]')`);
  const exportedSvg = await evaluate(`globalThis.exportCapture.name.endsWith('.svg') && globalThis.exportCapture.text.startsWith('<svg') && globalThis.exportCapture.text.includes('<path')`);
  await evaluate(`document.removeEventListener('click', globalThis.captureExport, true); delete globalThis.captureExport; delete globalThis.exportCapture;`);
  if (!exportedSvg) throw Error('Export retry did not download the chosen SVG format');
  // Exercise the library workflow through React, including durable delete/restore.
  const deletedId = await evaluate('(async()=> (await (await import("/src/app/pictures.ts")).pictureRepository.list())[0].id)()');
  await waitFor(`!!document.querySelector('button[aria-label="Delete selected saved picture"]:not(:disabled)')`);
  await evaluate(`document.querySelector('button[aria-label="Delete selected saved picture"]').click()`);
  await waitFor('!!document.querySelector(".delete-picture-dialog[open]")');
  await evaluate('document.querySelector(".confirm-delete").click()');
  await waitFor(`!!document.querySelector('button[aria-label="Undo delete"]')`);
  const wasDeleted = await evaluate(`import('/src/app/pictures.ts').then(async ({pictureRepository}) => !(await pictureRepository.list()).some(p => p.id === ${JSON.stringify(deletedId)}))`);
  if (!wasDeleted) throw Error('Library deletion was not persisted');
  await evaluate(`document.querySelector('button[aria-label="Undo delete"]').click()`);
  await waitFor(`!document.querySelector('button[aria-label="Undo delete"]')`);
  const restored = await evaluate(`import('/src/app/pictures.ts').then(async ({pictureRepository}) => await pictureRepository.get(${JSON.stringify(deletedId)}))`);
  if (!restored || JSON.stringify(restored.document) !== JSON.stringify(afterPinch)) throw Error('Undo delete did not restore the saved drawing');
  await evaluate(`import('/src/app/pictures.ts').then(({pictureRepository:r})=>r.save({...${JSON.stringify(restored)},id:'portfolio-second',title:'Second drawing',updatedAt:${restored.updatedAt}-1,format:'portrait',size:{width:24,height:32},document:{version:6,width:24,height:32,surfaces:[{id:'paper',kind:'canvas',x:0,y:0,color:16777215}]}}))`);
  await evaluate("document.documentElement.dataset.beforeReload='yes'");
  await cdp('Page.reload');
  await waitFor('!document.documentElement?.dataset.beforeReload && !!document.querySelector(".choice-blank") && !!document.querySelector(".previous-picture:not(:disabled)")');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  const illustrationsReady=await evaluate("[...document.querySelectorAll('.choice-illustration')].length===2 && [...document.querySelectorAll('.choice-illustration')].every(image=>image.complete&&image.naturalWidth>0)");
  if(!illustrationsReady)throw Error('Selection illustrations must be decoded when the home screen opens');
  if(!await evaluate("document.querySelector('.portfolio-stack-art')?.complete && document.querySelector('.portfolio-stack-art')?.naturalWidth>0"))throw Error('Paper-stack illustration must be decoded when the home screen opens');
  result.portfolio=await evaluate("import('/tests/browser/portfolio-navigation.ts').then(m=>m.checkPortfolioNavigation())");
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(await evaluate("getComputedStyle(document.querySelector('.portfolio-page')).animationName")!=='none')throw Error('Portfolio must respect reduced motion');
  await cdp('Emulation.setEmulatedMedia',{features:[]});
  for(const [width,height] of [[1280,900],[1000,700],[1024,768],[390,844],[320,568],[844,390],[600,360],[480,320]]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    const fits=await evaluate(`(()=>{const elements=document.querySelectorAll('.choice-grid .choice-card,.saved-picture-card,.selection .icon-button');return [...elements].every(e=>{const r=e.getBoundingClientRect();return r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1})&&document.documentElement.scrollWidth<=innerWidth})()`);
    if(!fits)throw Error(`Selection controls exceed viewport ${width}x${height}`);
    const paperLayout=await evaluate(`(()=>{const draw=document.querySelector('.choice-blank').getBoundingClientRect(),color=document.querySelector('.choice-coloring').getBoundingClientRect(),saved=document.querySelector('.saved-picture-card').getBoundingClientRect();return color.top>draw.top&&color.top-draw.top<=110&&Math.max(draw.bottom,color.bottom)<=saved.top&&!document.querySelector('.choice-tab,.portfolio-cover')})()`);
    if(!paperLayout)throw Error(`Paper choices must stay above the unlabeled saved-picture stack at ${width}x${height}`);
  }
  await cdp('Emulation.clearDeviceMetricsOverride');
  result.coloringPageAction=await evaluate("import('/tests/browser/coloring-page-action.ts').then(m=>m.checkColoringPageAction())");
  result.appInteraction={trustedMouse:true,saveReopen:true,touchCancellation:true,selectionExit:true,backgroundSaveRetry:true,deleteRestore:true,exportChoices:true,exportRetry:true};
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

