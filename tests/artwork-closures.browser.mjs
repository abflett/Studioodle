import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
export async function checkArtworkClosures({cdp,evaluate}){
 const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error(`Closure test timed out: ${expression}`);};
 const stored=()=>evaluate('JSON.parse(localStorage.getItem("studioodle-artwork-review-v1")).assets.find(a=>a.assetId==="triangle")');
 const screen=point=>evaluate(`(()=>{const r=document.querySelector('.review-sheet').getBoundingClientRect();return{x:r.left+${point.x}/220*r.width,y:r.top+${point.y}/280*r.height}})()`);
 const click=async (point,button='left')=>{const p=await screen(point);for(const type of ['mousePressed','mouseReleased'])await cdp('Input.dispatchMouseEvent',{type,...p,button,clickCount:1});};
 const drag=async(label,target)=>{
  const start=await evaluate(`(()=>{const r=document.querySelector('[aria-label="Line ${label} handle"] circle').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`),end=await screen(target);
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...end,button:'left',buttons:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',clickCount:1});
 };
 await cdp('Page.navigate',{url:'http://127.0.0.1:1433/artwork-review.html?asset=triangle&filter=all'});
 await wait('document.querySelector(".review-sidebar code")?.textContent==="triangle"&&document.querySelector(".review-sheet img")?.complete');
 await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 const before=await evaluate('localStorage.getItem("studioodle-artwork-review-v1")');
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'4',code:'Digit4'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'4',code:'Digit4'});
 await click({x:85,y:100},'right');await click({x:135,y:100},'right');
 await wait('document.querySelectorAll(".review-proposed-line").length===1');
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Set fill point').click()`);
 await click({x:110,y:125});
 let entry=await stored(),line=entry.closures[0];
 assert(Math.abs(line.a.x-85)<.05&&Math.abs(line.b.x-135)<.05);assert(line.width>=.1&&line.width<=2,'Initial width should be estimated from nearby triangle ink');
 assert(Math.abs(line.fillSeed.x-110)<.05&&Math.abs(line.fillSeed.y-125)<.05);
 assert(await evaluate('document.activeElement===document.querySelector(".review-stage")'),'Line creation must not focus note fields');
 await drag('Curve',{x:110,y:88});
 line=(await stored()).closures[0];assert(line.control&&Math.abs(line.control.y-76)<.1,'Middle handle must bend the curve through the dragged point');
 await drag('A',{x:80,y:102});
 line=(await stored()).closures[0];assert(Math.abs(line.a.x-80)<.05&&Math.abs(line.a.y-102)<.05,'Endpoint drag must save SVG coordinates');
 await evaluate(`(()=>{const input=document.querySelector('input[aria-label="Line width"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1.5');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 assert.equal((await stored()).closures[0].width,1.5);
 const wheelAt=await screen({x:110,y:140});
 const zoomBefore=await evaluate('document.querySelector(".review-sheet").style.width');
 const widthWheel=async deltaY=>{await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...wheelAt,deltaX:0,deltaY,modifiers:2});};
 await widthWheel(-120);await wait('document.querySelector(".review-width-control output").textContent==="1.6"');
 assert.equal((await stored()).closures[0].width,1.6,'Ctrl wheel up must increase width by 0.1');
 await widthWheel(120);await wait('document.querySelector(".review-width-control output").textContent==="1.5"');
 assert.equal(await evaluate('document.querySelector(".review-sheet").style.width'),zoomBefore,'Width adjustment must not zoom');
 for(const [width,delta] of [[2,-120],[.1,120]]){
  await evaluate(`(()=>{const input=document.querySelector('input[aria-label="Line width"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'${width}');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await widthWheel(delta);assert.equal((await stored()).closures[0].width,width,'Ctrl wheel respects width limits');
 }
 await evaluate(`(()=>{const input=document.querySelector('input[aria-label="Line width"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1.5');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await evaluate(`globalThis.lineExport=undefined;document.addEventListener('click',event=>{const link=event.target.closest('a[download]');if(link){event.preventDefault();fetch(link.href).then(r=>r.text()).then(text=>globalThis.lineExport=text);}},{capture:true});[...document.querySelectorAll('button')].find(b=>b.textContent==='Export all JSON').click()`);
 await wait('!!globalThis.lineExport');
 const exported=JSON.parse(await evaluate('globalThis.lineExport'));assert(exported.assets.find(a=>a.assetId==='triangle').closures[0].control);
 const previous=JSON.parse(before);for(const old of previous.assets)assert.deepEqual(exported.assets.find(a=>a.assetId===old.assetId),old,'Adding lines must preserve other artwork review progress');
 await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([globalThis.lineExport],'lines.json',{type:'application/json'}));const input=document.querySelector('input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait('document.querySelector(".review-save-status").textContent.startsWith("Saved locally")');assert.equal((await stored()).closures.length,1);
 await evaluate('globalThis.pendingReload=true');await cdp('Page.reload');await wait('!globalThis.pendingReload&&document.querySelector(".review-sheet img")?.complete');
 assert((await stored()).closures[0].control,'Curves must survive reload');
 await evaluate('document.querySelector(".review-marker-list button.close-line").click()');
 await wait('!!document.querySelector(".review-line-handle")');
 const screenshot=await cdp('Page.captureScreenshot',{format:'png'});await fs.writeFile('work/tests/artwork-line-closure.png',Buffer.from(screenshot.data,'base64'));
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Straighten line').click()`);assert.equal((await stored()).closures[0].control,null);
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Delete line').click()`);assert.equal((await stored()).closures.length,0);
 console.log('Proposed closures: endpoints, curved midpoint, nearby ink width, fill seed, editing, export/import, reload and progress preservation passed.');
}
