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
  await evaluate('document.fonts.ready');
  await settle();
  assert.equal(await evaluate('document.querySelector("#grid-mode").value'), 'display');
  await evaluate('document.querySelector("#grid-mode").value="legacy"; document.querySelector("#grid-mode").dispatchEvent(new Event("change"))'); await settle();
  assert.equal(await evaluate('document.querySelector("#library").value'), 'straight');
  assert.equal(await evaluate('document.querySelector("#match-edges").checked'), false, 'Independent straight fitting is the default');
  assert.equal(await evaluate('document.querySelectorAll("#profiles canvas").length'), 32);
  assert.equal(await evaluate('document.querySelectorAll("#profiles .reserved").length'), 16, 'Unused straight slots remain visibly reserved');
  let box = await evaluate('(()=>{const b=document.querySelector("#paint").getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()');
  const stroke = async (a, b, color) => {
    box = await evaluate('(()=>{const b=document.querySelector("#paint").getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()');
    await evaluate(`document.querySelector('[data-slot="${color}"]').click()`);
    const x = box.x + a[0] * box.w, y = box.y + a[1] * box.h;
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
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
  // Exercise native input before full-page capture temporarily changes the
  // emulated viewport. Later comparison screenshots use programmatic examples.
  await evaluate('(()=>{const select=document.querySelector("#view");select.value="reference";select.dispatchEvent(new Event("change"));})()'); await settle();
  await stroke([.1, .1], [.2, .1], 2);
  assert.equal(await evaluate('document.querySelector("#reference").getContext("2d").getImageData(150,100,1,1).data[0]'), 216, 'Drawing still works while the reference is displayed');
  await evaluate('(()=>{const select=document.querySelector("#view");select.value="cells";select.dispatchEvent(new Event("change"));})()'); await settle();
  const image = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'desktop.png'), Buffer.from(image.data, 'base64'));
  await stroke([.5, .5], [.55, .5], 0);
  assert.equal(await evaluate('(()=>{const c=document.querySelector("#paint");return c.getContext("2d").getImageData(Math.floor(c.width*.52),Math.floor(c.height*.5),1,1).data[3]})()'), 0, 'Paper brush erases to transparency');
  await evaluate('document.querySelector("#example").click()'); await settle();
  assert.ok(Number(await evaluate('document.querySelector("#painted").textContent')) > 800);
  assert.equal(await evaluate('document.querySelector("#scratch").textContent'), '0.00 KiB');
  const expandedExample = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'straight-cuts.png'), Buffer.from(expandedExample.data, 'base64'));
  await evaluate('(()=>{const select=document.querySelector("#library");select.value="32";select.dispatchEvent(new Event("change"));})()'); await settle();
  assert.equal(await evaluate('document.querySelectorAll("#profiles .reserved").length'), 0, 'Earlier experimental library remains available');
  await evaluate('document.querySelector("#example").click()'); await settle();
  const experimentalExample = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'profiles-32.png'), Buffer.from(experimentalExample.data, 'base64'));
  await evaluate('(()=>{const select=document.querySelector("#library");select.value="8";select.dispatchEvent(new Event("change"));})()'); await settle();
  assert.equal(await evaluate('document.querySelector("#painted").textContent'), '0', 'Library change explicitly clears canvas');
  await evaluate('document.querySelector("#example").click()'); await settle();
  const legacyExample = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'profiles-8.png'), Buffer.from(legacyExample.data, 'base64'));
  await evaluate('(()=>{const select=document.querySelector("#library");select.value="straight";select.dispatchEvent(new Event("change"));})()'); await settle();
  await evaluate('document.querySelector("#circles").click()'); await settle();
  assert.ok(Number(await evaluate('document.querySelector("#painted").textContent')) > 800, 'Large dabs paint visible circles');
  const circles = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'straight-circles.png'), Buffer.from(circles.data, 'base64'));
  await evaluate('document.querySelector("#match-edges").click(); document.querySelector("#circles").click()'); await settle();
  const matched = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'straight-circles-matched.png'), Buffer.from(matched.data, 'base64'));
  await evaluate('document.querySelector("#match-edges").click()');
  await evaluate('document.querySelector("#overlap").click()'); await settle();
  const overlapCells = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'overlap-cells.png'), Buffer.from(overlapCells.data, 'base64'));
  await evaluate('(()=>{const select=document.querySelector("#view");select.value="reference";select.dispatchEvent(new Event("change"));})()'); await settle();
  assert.equal(await evaluate('document.querySelector("#reference").hidden'), false);
  assert.equal(await evaluate('document.querySelector("#paint").style.opacity'), '0');
  assert.equal(await evaluate('document.querySelector("#reference").getContext("2d").getImageData(500,500,1,1).data[0]'), 37, 'Unquantized overlapping round dabs retain the central ink-colored gap');
  const cusp = await evaluate('(()=>{const c=document.querySelector("#reference").getContext("2d");return [500,498,502].map(x=>c.getImageData(x,520,1,1).data[0]);})()');
  assert.ok(cusp[0] === 37 && cusp[1] >= 70 && cusp[2] >= 70, 'The unquantized gap narrows to a real cusp between blue circles');
  const overlapReference = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'overlap-reference.png'), Buffer.from(overlapReference.data, 'base64'));
  await evaluate('(()=>{const select=document.querySelector("#view");select.value="difference";select.dispatchEvent(new Event("change"));})()'); await settle();
  assert.equal(await evaluate('document.querySelector("#reference").style.mixBlendMode'), 'difference');
  await evaluate('(()=>{const select=document.querySelector("#view");select.value="cells";select.dispatchEvent(new Event("change"));})()');
  await evaluate('document.querySelector("#thin-curve").click()'); await settle();
  assert.equal(await evaluate('document.querySelector("#capture-cells").checked'), true);
  assert.equal(await evaluate('document.querySelector("#size").value'), '1');
  assert.ok(await evaluate('document.querySelector("#cell-inspector").textContent.includes("Snapped:")'), 'Fixture captures real and snapped crossings');
  assert.ok(await evaluate('document.querySelector("#cell-inspector").textContent.includes("Source mismatch:")'), 'Inspector reports source/profile disagreement');
  const thinArc = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'thin-arc-inspector.png'), Buffer.from(thinArc.data, 'base64'));
  await evaluate('document.querySelector("#inspect-cells").click()');
  const beforeInspect = await evaluate('document.querySelector("#painted").textContent');
  await stroke([.505, .385], [.505, .385], 2);
  assert.equal(await evaluate('document.querySelector("#painted").textContent'), beforeInspect, 'Inspection does not paint');
  assert.ok(await evaluate('document.querySelector("#cell-inspector").textContent.includes("Cell (50, 38)")'));
  await evaluate('document.querySelector("#inspect-cells").click(); document.querySelector("#curve-kind").value="spiral"; document.querySelector("#grid-phase").value=".375"; document.querySelector("#grid-phase").dispatchEvent(new Event("input")); document.querySelector("#thin-curve").click()'); await settle();
  assert.equal(await evaluate('document.querySelector("#phase-value").textContent'), '0.375 cells');
  assert.ok(await evaluate('document.querySelector("#cell-inspector").textContent.includes("fallback")'), 'Spiral fixture exposes ambiguous cells without changing profiles');
  const thinSpiral = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'thin-spiral-inspector.png'), Buffer.from(thinSpiral.data, 'base64'));
  for (const kind of ['tightening', 'boundary']) {
    await evaluate(`(() => {
      document.querySelector('#curve-kind').value=${JSON.stringify(kind)};
      for (const [id,value] of [['grid-phase','.173'],['grid-phase-y',${JSON.stringify(kind === 'boundary' ? '.007' : '.619')}],['jitter','.09'],['noise-seed','17']]) {
        const input=document.getElementById(id); input.value=value; input.dispatchEvent(new Event('input'));
      }
      document.querySelector('#thin-curve').click();
    })()`); await settle();
    assert.equal(await evaluate('document.querySelector("#jitter-value").textContent'), '0.09 cells');
    assert.equal(await evaluate('document.querySelector("#phase-y-value").textContent'), `${kind === 'boundary' ? '0.007' : '0.619'} cells`);
    assert.ok(Number(await evaluate('document.querySelector("#painted").textContent')) > 50);
    const noisy = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await fs.writeFile(path.join(output, `thin-${kind}-jitter.png`), Buffer.from(noisy.data, 'base64'));
  }
  await evaluate('document.querySelector("#curve-kind").value="short"; document.querySelector("#jitter").value=".09"; document.querySelector("#thin-curve").click()'); await settle();
  const shortImage = await evaluate(`(()=>{const c=document.createElement('canvas');c.width=c.height=600;const source=document.querySelector('#paint'),ctx=c.getContext('2d');ctx.fillStyle='#fffdf6';ctx.fillRect(0,0,600,600);ctx.drawImage(source,source.width*.43,source.height*.56,source.width*.14,source.height*.14,0,0,600,600);return c.toDataURL().split(',')[1]})()`);
  await fs.writeFile(path.join(output,'short-curve.png'),Buffer.from(shortImage,'base64'));
  // Replay the noisy tightening fixture through native pointer events as well as
  // the example button, including pauses/duplicates and backwards retraversal.
  const samples = await evaluate(`(async()=>{const {thinCurve}=await import('/src/fixtures.ts'); return thinCurve('tightening',[.173,.619],240,{jitter:.09,seed:17,retrace:true});})()`);
  await evaluate('document.querySelector("#clear").click(); document.querySelector(\'[data-slot="1"]\').click()'); await settle();
  box = await evaluate('(()=>{const b=document.querySelector("#paint").getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()');
  const mousePoint = p => ({ x: box.x + p[0] / 100 * box.w, y: box.y + p[1] / 100 * box.h });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...mousePoint(samples[0]), button: 'left', buttons: 1, clickCount: 1 });
  for (const p of samples.slice(1)) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...mousePoint(p), buttons: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mousePoint(samples.at(-1)), button: 'left', buttons: 0, clickCount: 1 }); await settle();
  assert.ok(Number(await evaluate('document.querySelector("#painted").textContent')) > 80, 'Noisy native input paints a tightening curve');
  assert.equal(await evaluate('document.querySelector("#scratch").textContent'), '0.00 KiB');
  await evaluate('document.querySelector("#capture-cells").click(); document.querySelector("#size").value="8"');
  assert.equal(await evaluate('document.querySelector("#cell-inspector").textContent'), '', 'Disabling capture releases diagnostics');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }); await settle();
  await evaluate('document.querySelector("#grid-mode").value="display"; document.querySelector("#grid-mode").dispatchEvent(new Event("change"))'); await settle();
  const displayGrid = await evaluate(`(()=>{
    const b=document.querySelector('#paint').getBoundingClientRect(), dims=document.querySelector('#grid-info').textContent.match(/[0-9]+/g).map(Number);
    return {width:dims[0],height:dims[1],cellX:b.width/dims[0],cellY:b.height/dims[1],bottom:b.bottom,right:b.right,bytes:document.querySelector('#cell-data').textContent};
  })()`);
  assert.ok(displayGrid.width > 300 && displayGrid.height > 150, 'Display grid follows the usable 1080p canvas');
  assert.ok(displayGrid.cellX >= 4 && displayGrid.cellX < 4.03 && displayGrid.cellY >= 4 && displayGrid.cellY < 4.03);
  assert.ok(displayGrid.bottom <= 1080 && displayGrid.right < 1920 - 250, 'Canvas and tooling fit side by side');
  await evaluate('document.querySelector("#size").value="4"; document.querySelector("#size").dispatchEvent(new Event("input"))');
  await stroke([.12, .25], [.83, .65], 5);
  const displayPainted = await evaluate('document.querySelector("#painted").textContent');
  assert.ok(Number(displayPainted) > 500, 'Pointer mapping reaches across the larger rectangular grid');
  const displayImage = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path.join(output, 'display-1920x1080.png'), Buffer.from(displayImage.data, 'base64'));
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }); await settle();
  assert.equal(await evaluate('document.querySelector("#painted").textContent'), displayPainted, 'Resizing preserves the model');
  await evaluate('document.querySelector("#fit-grid").click()'); await settle();
  assert.equal(await evaluate('document.querySelector("#painted").textContent'), '0', 'Explicit refit clears and reallocates');
  console.log('1080p display grid:', displayGrid);
  for (const [mode, pixels] of [['display2', 2], ['display1', 1]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }); await settle();
    await evaluate(`document.querySelector('#grid-mode').value='${mode}'; document.querySelector('#grid-mode').dispatchEvent(new Event('change'))`); await settle();
    const fineGrid = await evaluate(`(()=>{const b=document.querySelector('#paint').getBoundingClientRect(),dims=document.querySelector('#grid-info').textContent.match(/[0-9]+/g).map(Number);return {width:dims[0],height:dims[1],cell:b.width/dims[0],bytes:document.querySelector('#cell-data').textContent,reference:document.querySelector('#reference').width}})()`);
    assert.ok(Math.abs(fineGrid.cell - pixels) < .01);
    assert.equal(fineGrid.width, Math.floor(1520 / pixels));
    assert.equal(fineGrid.height, Math.floor(850 / pixels));
    assert.equal(fineGrid.bytes, `${(fineGrid.width * fineGrid.height * 3 / 1024).toFixed(2)} KiB`);
    assert.equal(fineGrid.reference, 1520, 'Finer grids must not multiply reference backing resolution');
    assert.equal(await evaluate('document.querySelector("#painted").textContent'), '0');
    await stroke([.25, .4], [.5, .45], 2);
    assert.ok(Number(await evaluate('document.querySelector("#painted").textContent')) > 300, 'Finer grids paint using the correct coordinates');
    await evaluate('document.querySelector("#clear").click()'); await settle();
    assert.equal(await evaluate('document.querySelector("#painted").textContent'), '0');
    console.log(`${pixels}px display grid:`, fineGrid);
  }
  const pixelRender = await evaluate(`(async()=>{
    const {pixelLookup,PixelSurface}=await import('/src/pixelSurface.ts');
    const {libraries}=await import('/src/profiles.ts');
    const palette=Array.from(document.querySelectorAll('.swatch'),el=>el.style.getPropertyValue('--color'));
    const paths=libraries.straight.variants.map(polygon=>{const p=new Path2D();polygon.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));if(polygon.length)p.closePath();return p;});
    const lookup=pixelLookup(paths,palette), make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    const expected=make(256,64), actual=make(256,64), ctx=expected.getContext('2d',{willReadFrequently:true});
    const surface=new PixelSurface(256,64,lookup,8);
    const vector=(ctx,x,y,profile,front,back,pathTable=paths)=>{
      ctx.clearRect(x,y,1,1);
      if(back){ctx.fillStyle=palette[back];ctx.fillRect(x,y,1,1);}
      ctx.setTransform(1,0,0,1,x,y);ctx.globalCompositeOperation=front?'source-over':'destination-out';
      ctx.fillStyle=front?palette[front]:'#000';ctx.fill(pathTable[profile]);ctx.resetTransform();ctx.globalCompositeOperation='source-over';
    };
    for(let front=0;front<8;front++)for(let back=0;back<8;back++)for(let profile=0;profile<256;profile++){
      const row=front*8+back;vector(ctx,profile,row,profile,front,back);surface.set(row*256+profile,profile,front,back);
    }
    surface.flush(actual.getContext('2d'));
    const a=ctx.getImageData(0,0,256,64).data,b=actual.getContext('2d').getImageData(0,0,256,64).data;
    let mismatches=0,maxDifference=0,alphaMismatches=0;
    for(let i=0;i<a.length;i++)if(a[i]!==b[i]){mismatches++;maxDifference=Math.max(maxDifference,Math.abs(a[i]-b[i]));if(i%4===3)alphaMismatches++;}
    const straightMismatches=mismatches;
    for(const name of ['experimental','legacy']){
      const otherPaths=libraries[name].variants.map(polygon=>{const p=new Path2D();polygon.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));if(polygon.length)p.closePath();return p;});
      const reference=make(256,64),output=make(256,64),otherCtx=reference.getContext('2d',{willReadFrequently:true});
      const other=new PixelSurface(256,64,pixelLookup(otherPaths,palette),8);
      for(let front=0;front<8;front++)for(let back=0;back<8;back++)for(let profile=0;profile<256;profile++){
        const row=front*8+back;vector(otherCtx,profile,row,profile,front,back,otherPaths);other.set(row*256+profile,profile,front,back);
      }
      other.flush(output.getContext('2d'));
      const expected=otherCtx.getImageData(0,0,256,64).data,actual=output.getContext('2d').getImageData(0,0,256,64).data;
      for(let i=0;i<expected.length;i++)if(expected[i]!==actual[i]){
        mismatches++;maxDifference=Math.max(maxDifference,Math.abs(expected[i]-actual[i]));if(i%4===3)alphaMismatches++;
      }
    }
    const large=make(1520,850), largeCtx=large.getContext('2d'), pixels=new PixelSurface(1520,850,lookup,8);
    const pathTimes=[],pixelTimes=[];
    for(let repeat=0;repeat<4;repeat++){
      let start=performance.now();
      for(let i=0;i<16384;i++){const index=i*79%(1520*850);vector(largeCtx,index%1520,Math.floor(index/1520),i%256,Math.floor(i/2048)%8,Math.floor(i/256)%8);}
      if(repeat)pathTimes.push(performance.now()-start);
      start=performance.now();
      for(let i=0;i<16384;i++)pixels.set(i*79%(1520*850),i%256,Math.floor(i/2048)%8,Math.floor(i/256)%8);
      pixels.flush(largeCtx);if(repeat)pixelTimes.push(performance.now()-start);
    }
    return {straightMismatches,mismatches,maxDifference,alphaMismatches,profileColorCases:49152,pathMedianMs:pathTimes.sort((a,b)=>a-b)[1],pixelMedianMs:pixelTimes.sort((a,b)=>a-b)[1]};
  })()`);
  console.log('One-pixel browser render check:', pixelRender);
  assert.equal(pixelRender.straightMismatches, 0, 'Every straight profile/color case matches canonical software path rendering exactly');
  assert.equal(pixelRender.alphaMismatches, 0, 'Coverage is identical across all libraries');
  assert.ok(pixelRender.maxDifference <= 1, 'Curved legacy profiles allow only one RGB level of premultiplication roundtrip error');
  await evaluate('document.querySelector("#grid-mode").value="legacy"; document.querySelector("#grid-mode").dispatchEvent(new Event("change")); document.querySelector("#size").value="8"'); await settle();
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await settle();
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'No mobile horizontal overflow');
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
  box = await evaluate('(()=>{const b=document.querySelector("#paint").getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()');
  await evaluate('document.querySelector("#clear").click()'); await settle();
  assert.equal(await evaluate('document.querySelector("#reference").getContext("2d").getImageData(500,500,1,1).data[3]'), 0, 'Clear resets the reference with the cells');
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
