import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

/** Exercise the standalone inspector with real pointer coordinates and modifier keys. */
export async function checkArtworkReview({ cdp, evaluate }) {
  const wait = async expression => {
    for(let i=0;i<200;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,25));}
    throw Error(`Artwork review timed out: ${expression}\n${await evaluate('document.body.innerText')}`);
  };
  const ready = () => wait('!!document.querySelector(".review-sheet img") && document.querySelector(".review-sheet img").complete');
  const reload = async () => {
    await evaluate('globalThis.reviewReloadPending=true');
    await cdp('Page.reload');await wait('!globalThis.reviewReloadPending');await ready();
  };
  const stored = () => evaluate('JSON.parse(localStorage.getItem("studioodle-artwork-review-v1"))');
  const clickPoint = async (x,y,modifiers=0) => {
    const p=await evaluate(`(()=>{const r=document.querySelector('.review-sheet').getBoundingClientRect();const v=document.querySelector('.review-marker-layer').viewBox.baseVal;return{x:r.left+${x}/v.width*r.width,y:r.top+${y}/v.height*r.height}})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1,modifiers});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1,modifiers});
  };
  const type = (label,value) => evaluate(`(()=>{const e=document.querySelector('textarea[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:'http://127.0.0.1:1433/artwork-review.html?asset=circle&filter=all'});
  await ready();
  await clickPoint(110,140,2); // Ctrl: transparent, with a real region ID.
  await wait('document.querySelectorAll(".review-marker").length===1');
  assert(await evaluate('document.activeElement===document.querySelector(".review-stage")'),'Placing a marker must keep focus on the artwork');
  await type('Marker note','This pocket should be transparent.');
  await clickPoint(5,5,8); // Shift: missing region, with no existing region ID.
  await wait('document.querySelectorAll(".review-marker").length===2');
  await type('Marker note','Close the gap and make this fillable.');
  let review=await stored(),entry=review.assets[0];
  assert.equal(entry.markers[0].kind,'remove-region');assert.equal(entry.markers[0].regionId,1);
  assert.equal(entry.markers[1].kind,'add-region');assert.equal(entry.markers[1].regionId,0);
  assert.equal(entry.markers[0].x,110);assert.equal(entry.markers[1].y,5);
  assert.match(entry.sha256,/^[a-f0-9]{64}$/);assert.equal(entry.source,'art/source/stickers/shapes/circle.svg');
  // The same SVG coordinates must be exported after fitting and zooming the display.
  await evaluate(`document.querySelector('button[aria-label="Zoom in"]').click()`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1'});
  await clickPoint(110,170);
  await wait('document.querySelectorAll(".review-marker").length===3');
  review=await stored();entry=review.assets[0];
  assert.equal(entry.markers[2].kind,'note');assert.equal(entry.markers[2].x,110);assert.equal(entry.markers[2].y,170);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD'});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD'});
  await wait('document.querySelector(".review-sidebar code").textContent==="square"');await ready();
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA'});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA'});
  await wait('document.querySelector(".review-sidebar code").textContent==="circle"');await ready();
  assert.equal((await stored()).assets[0].markers.length,3,'Immediate shortcut browsing after marking must preserve all markers');
  await type('Artwork notes','Overall artwork review.');
  await evaluate('document.querySelector(".review-check input").click()');
  await reload();
  assert.equal((await stored()).assets[0].notes,'Overall artwork review.');
  assert.equal(await evaluate('document.querySelectorAll(".review-marker").length'),3);
  assert.equal(await evaluate('document.querySelector(".review-check input").checked'),true);
  // Capture an actual generated JSON download and round-trip it through the import UI.
  await evaluate(`globalThis.reviewDownload=undefined;document.addEventListener('click',event=>{const a=event.target.closest('a[download]');if(a){event.preventDefault();fetch(a.href).then(r=>r.text()).then(text=>globalThis.reviewDownload=text);}},{capture:true});[...document.querySelectorAll('button')].find(e=>e.textContent==='Export all JSON').click()`);
  await wait('!!globalThis.reviewDownload');
  const exported=JSON.parse(await evaluate('globalThis.reviewDownload'));
  assert.equal(exported.assets[0].markers.length,3);assert.equal(exported.coordinateSpace,'svg-viewBox');assert(exported.exportedAt);
  await evaluate(`(()=>{const file=new File([globalThis.reviewDownload],'review.json',{type:'application/json'}),data=new DataTransfer();data.items.add(file);const input=document.querySelector('input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait('document.querySelector(".review-save-status").textContent.startsWith("Saved locally")');
  assert.equal((await stored()).assets[0].markers.length,3,'Importing the same review must not duplicate markers');
  // Validation and revision conflicts protect coordinates from silently changing meaning.
  const validation=await evaluate(`import('/src/dev/artworkReviewModel.ts').then(async m=>{const assets=(await import('/art/stickers.json')).default;const original=JSON.parse(globalThis.reviewDownload);let rejected=0;for(const change of [r=>r.assets[0].markers[0].x=-1,r=>r.assets[0].assetId='unknown',r=>r.assets[0].markers.push(r.assets[0].markers[0]),r=>r.assets[0].markers[0].kind='bad']){const r=structuredClone(original);change(r);try{m.parseReview(JSON.stringify(r),assets);}catch{rejected++;}}const other=structuredClone(original);other.assets[0].sha256='0'.repeat(64);try{m.mergeReviews(original,other);}catch{rejected++;}return rejected;})`);
  assert.equal(validation,5);
  // Ordinary wheel input zooms at the cursor without navigating or drifting its SVG point.
  const p=await evaluate('(()=>{const r=document.querySelector(".review-stage").getBoundingClientRect();return{x:r.x+r.width/2+70,y:r.y+r.height/2-55}})()');
  const underCursor=()=>evaluate(`(()=>{const r=document.querySelector('.review-sheet').getBoundingClientRect();return{x:(${p.x}-r.x)/r.width*220,y:(${p.y}-r.y)/r.height*280,width:r.width}})()`);
  const beforeZoom=await underCursor();
  await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:-120});
  await wait(`document.querySelector('.review-sheet').getBoundingClientRect().width>${beforeZoom.width}`);
  const afterZoom=await underCursor();
  assert(Math.abs(beforeZoom.x-afterZoom.x)<.05&&Math.abs(beforeZoom.y-afterZoom.y)<.05,'Wheel zoom must preserve the SVG point under the cursor');
  assert.equal(await evaluate('document.querySelector(".review-sidebar code").textContent'),'circle','Wheel must not browse artwork');
  await evaluate(`document.querySelector('button[aria-label="Next artwork"]').click()`);
  await wait('document.querySelector(".review-sidebar code").textContent==="square"');await ready();
  await clickPoint(5,5,8);
  await wait('document.querySelectorAll(".review-marker").length===1');
  await evaluate(`globalThis.reviewDownload=undefined;[...document.querySelectorAll('button')].find(e=>e.textContent==='Export all JSON').click()`);
  await wait('!!globalThis.reviewDownload');
  assert.deepEqual(JSON.parse(await evaluate('globalThis.reviewDownload')).assets.map(entry=>entry.assetId).sort(),['circle','square'],'One export must include annotations from every artwork');
  await evaluate('document.activeElement.blur()');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft'});
  await wait('document.querySelector(".review-sidebar code").textContent==="circle"');await ready();
  const key = async (key,code,extra={}) => {
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,...extra});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code});
  };
  await key('d','KeyD');
  await wait('document.querySelector(".review-sidebar code").textContent==="square"');await ready();
  await key('A','KeyA');
  await wait('document.querySelector(".review-sidebar code").textContent==="circle"');await ready();
  await key(' ','Space');
  assert.equal((await stored()).assets.find(entry=>entry.assetId==='circle').reviewed,false,'Space must toggle Reviewed');
  await key(' ','Space',{autoRepeat:true});
  assert.equal((await stored()).assets.find(entry=>entry.assetId==='circle').reviewed,false,'A held Space key must not toggle repeatedly');
  await evaluate(`document.querySelector('button[aria-label="Next artwork"]').focus()`);
  await key(' ','Space');
  assert.equal(await evaluate('document.querySelector(".review-sidebar code").textContent'),'circle','Space must not also activate a focused navigation button');
  assert.equal((await stored()).assets.find(entry=>entry.assetId==='circle').reviewed,true);
  await evaluate(`document.querySelector('textarea[aria-label="Artwork notes"]').focus()`);
  await key('a','KeyA');await key('d','KeyD');await key(' ','Space');
  assert.equal(await evaluate('document.querySelector(".review-sidebar code").textContent'),'circle','Typing in notes must not trigger navigation');
  assert.equal((await stored()).assets.find(entry=>entry.assetId==='circle').reviewed,true,'Typing spaces must not toggle Reviewed');
  // A regenerated asset's old notes remain visible, but new edits are blocked.
  await evaluate('(()=>{const key="studioodle-artwork-review-v1",r=JSON.parse(localStorage.getItem(key));r.assets.find(entry=>entry.assetId==="circle").sha256="0".repeat(64);localStorage.setItem(key,JSON.stringify(r));})()');
  await reload();
  await wait('!!document.querySelector("[role=alert]")');
  await clickPoint(110,200,2);
  assert.equal((await stored()).assets.find(entry=>entry.assetId==='circle').markers.length,3);
  // Old markers can still be removed after repairs change the SVG checksum.
  await clickPoint(110,140,1);
  await wait('document.querySelectorAll(".review-marker").length===2');
  assert.equal((await stored()).assets.find(entry=>entry.assetId==='circle').markers.length,2,'Alt-click must persistently delete only the clicked marker');
  await reload();
  assert.equal(await evaluate('document.querySelectorAll(".review-marker").length'),2);
  // Pointer hover must not repaint fill or ink in the default inspection view.
  await cdp('Page.navigate',{url:'http://127.0.0.1:1433/artwork-review.html?asset=triangle&filter=all'});
  await wait('document.querySelector(".review-sidebar code")?.textContent==="triangle"');await ready();
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:20});
  const clip=await evaluate('(()=>{const r=document.querySelector(".review-sheet").getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
  const baseline=await cdp('Page.captureScreenshot',{format:'png',clip});
  const center=await evaluate('(()=>{const r=document.querySelector(".review-sheet").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...center});
  await wait('document.querySelector(".review-view-tools > span").textContent==="Region 1"');
  const hovered=await cdp('Page.captureScreenshot',{format:'png',clip});
  await fs.writeFile('work/tests/triangle-before-hover.png',Buffer.from(baseline.data,'base64'));
  await fs.writeFile('work/tests/triangle-after-hover.png',Buffer.from(hovered.data,'base64'));
  const hoverDelta=await evaluate(`(async()=>{const pixels=async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};const a=await pixels(${JSON.stringify(baseline.data)}),b=await pixels(${JSON.stringify(hovered.data)});let max=0;for(let i=0;i<a.length;i++)max=Math.max(max,Math.abs(a[i]-b[i]));return max;})()`);
  // Allow a few channel values of browser edge rounding, never a visible tint.
  assert(hoverDelta<=4,`Hover changed triangle fill or ink by ${hoverDelta} channel values`);
  const gaps=await evaluate(`(async()=>{
    const render=async url=>{const doc=new DOMParser().parseFromString(await (await fetch(url)).text(),'image/svg+xml');doc.documentElement.setAttribute('width','220');doc.documentElement.setAttribute('height','280');const blob=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)],{type:'image/svg+xml'}));try{const image=new Image();image.src=blob;await image.decode();const canvas=document.createElement('canvas');canvas.width=880;canvas.height=1120;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,880,1120);return ctx.getImageData(0,0,880,1120).data;}finally{URL.revokeObjectURL(blob);}};
    const source=await render('/art/source/stickers/shapes/triangle.svg'),current=await render('/src/assets/vector/triangle.svg');let gaps=0;
    for(let i=0;i<source.length;i+=4)if(source[i]>250&&source[i+1]>250&&source[i+2]>250&&source[i+3]>250&&current[i+3]<250)gaps++;
    return gaps;
  })()`);
  assert.equal(gaps,0,'The converted triangle must cover every solid white interior pixel in the original art');
  await evaluate(`const label=[...document.querySelectorAll('.review-view-tools label')].find(e=>e.textContent.trim()==='Region outline');label.querySelector('input').click()`);
  await wait('!!document.querySelector(".review-region-outline")');
  assert.equal(await evaluate('document.querySelector(".review-region-outline").getAttribute("fill")'),'none');
  // Open the user's representative detailed asset for a final visual inspection.
  await cdp('Page.navigate',{url:'http://127.0.0.1:1433/artwork-review.html?asset=counting-03'});
  await wait('document.querySelector(".review-sidebar code")?.textContent==="counting-03"');await ready();
  for(const [width,height] of [[1440,1000],[1024,768],[390,844]]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await new Promise(resolve=>setTimeout(resolve,80));
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Inspector must not overflow horizontally');
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await new Promise(resolve=>setTimeout(resolve,100));
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
  await fs.writeFile('work/tests/artwork-review.png',Buffer.from(screenshot.data,'base64'));
  await fs.writeFile('work/tests/artwork-review-export.json',JSON.stringify(exported,null,2));
  console.log('Artwork review: modifier markers, cursor anchored wheel zoom, keyboard navigation, region IDs, notes, persistence, export/import, validation, revision guards and responsive layout passed.');
}
