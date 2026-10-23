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
  await cdp('Page.navigate',{url:'http://127.0.0.1:1433/artwork-review.html?asset=circle'});
  await ready();
  await clickPoint(110,140,2); // Ctrl: transparent, with a real region ID.
  await wait('document.querySelectorAll(".review-marker").length===1');
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
  await clickPoint(110,170);
  await wait('document.querySelectorAll(".review-marker").length===3');
  review=await stored();entry=review.assets[0];
  assert.equal(entry.markers[2].kind,'note');assert.equal(entry.markers[2].x,110);assert.equal(entry.markers[2].y,170);
  await type('Artwork notes','Overall artwork review.');
  await evaluate('document.querySelector(".review-check input").click()');
  await reload();
  assert.equal((await stored()).assets[0].notes,'Overall artwork review.');
  assert.equal(await evaluate('document.querySelectorAll(".review-marker").length'),3);
  assert.equal(await evaluate('document.querySelector(".review-check input").checked'),true);
  // Capture an actual generated JSON download and round-trip it through the import UI.
  await evaluate(`globalThis.reviewDownload=undefined;document.addEventListener('click',event=>{const a=event.target.closest('a[download]');if(a){event.preventDefault();fetch(a.href).then(r=>r.text()).then(text=>globalThis.reviewDownload=text);}},{capture:true});[...document.querySelectorAll('button')].find(e=>e.textContent==='Export JSON').click()`);
  await wait('!!globalThis.reviewDownload');
  const exported=JSON.parse(await evaluate('globalThis.reviewDownload'));
  assert.equal(exported.assets[0].markers.length,3);assert.equal(exported.coordinateSpace,'svg-viewBox');assert(exported.exportedAt);
  await evaluate(`(()=>{const file=new File([globalThis.reviewDownload],'review.json',{type:'application/json'}),data=new DataTransfer();data.items.add(file);const input=document.querySelector('input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait('document.querySelector(".review-save-status").textContent.startsWith("Saved locally")');
  assert.equal((await stored()).assets[0].markers.length,3,'Importing the same review must not duplicate markers');
  // Validation and revision conflicts protect coordinates from silently changing meaning.
  const validation=await evaluate(`import('/src/dev/artworkReviewModel.ts').then(async m=>{const assets=(await import('/art/stickers.json')).default;const original=JSON.parse(globalThis.reviewDownload);let rejected=0;for(const change of [r=>r.assets[0].markers[0].x=-1,r=>r.assets[0].assetId='unknown',r=>r.assets[0].markers.push(r.assets[0].markers[0]),r=>r.assets[0].markers[0].kind='bad']){const r=structuredClone(original);change(r);try{m.parseReview(JSON.stringify(r),assets);}catch{rejected++;}}const other=structuredClone(original);other.assets[0].sha256='0'.repeat(64);try{m.mergeReviews(original,other);}catch{rejected++;}return rejected;})`);
  assert.equal(validation,5);
  // Wheel navigation must advance one asset despite a burst of wheel events.
  const p=await evaluate('(()=>{const r=document.querySelector(".review-stage").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
  for(let i=0;i<4;i++)await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:120});
  await wait('document.querySelector(".review-sidebar code").textContent==="square"');await ready();
  await evaluate('document.activeElement.blur()');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft'});
  await wait('document.querySelector(".review-sidebar code").textContent==="circle"');await ready();
  // A regenerated asset's old notes remain visible, but new edits are blocked.
  await evaluate('(()=>{const key="studioodle-artwork-review-v1",r=JSON.parse(localStorage.getItem(key));r.assets[0].sha256="0".repeat(64);localStorage.setItem(key,JSON.stringify(r));})()');
  await reload();
  await wait('!!document.querySelector("[role=alert]")');
  await clickPoint(110,200,2);
  assert.equal((await stored()).assets[0].markers.length,3);
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
  console.log('Artwork review: modifier markers, accurate zoom coordinates, region IDs, notes, persistence, export/import, validation, revision guards, wheel/keyboard navigation and responsive layout passed.');
}
