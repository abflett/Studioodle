import assert from 'node:assert/strict';
import fs from 'node:fs';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
let server,model,geometry,tasks;
before(async()=>{server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});model=await server.ssrLoadModule('/src/dev/artworkReviewModel.ts');geometry=await server.ssrLoadModule('/src/dev/artworkReviewGeometry.ts');tasks=await server.ssrLoadModule('/src/dev/artworkLineTasks.ts');});
after(async()=>{await server?.close();});
test('extending review annotations preserves the complete existing exported review',()=>{
 const original=JSON.parse(fs.readFileSync('docs/studioodle-artwork-review-2026-10-23.json','utf8'));
 const catalog=JSON.parse(fs.readFileSync('art/stickers.json','utf8'));
 assert.deepEqual(model.parseReview(JSON.stringify(original),catalog).assets,original.assets);
});
test('cursor anchored zoom preserves the same document position while clamping the zoom range',()=>{
 const view={zoom:2,pan:{x:45,y:-20}},cursor={x:160,y:80};
 const next=geometry.zoomReviewAt(view,cursor,5);
 for(const axis of ['x','y'])assert(Math.abs((cursor[axis]-view.pan[axis])/view.zoom-(cursor[axis]-next.pan[axis])/next.zoom)<1e-10);
 assert.equal(geometry.zoomReviewAt(view,cursor,200).zoom,16);assert.equal(geometry.zoomReviewAt(view,cursor,0).zoom,1);
});
test('dragging the curve midpoint controls the visible curve, and closure geometry round-trips with markers',()=>{
 const catalog=[{id:'test',source:'source.svg',width:100,height:100}];
 const line={id:'line',a:{x:10,y:50},b:{x:90,y:50},control:null,width:2,fillSeed:{x:50,y:65},note:'close hair',createdAt:'2026-10-23T00:00:00Z'};
 const curved=geometry.moveClosureHandle(line,'midpoint',{x:50,y:40},100,100);
 assert.deepEqual(geometry.closureMidpoint(curved),{x:50,y:40});assert.match(geometry.closurePath(curved),/Q50 30/);
 const entry={assetId:'test',source:'source.svg',vectorPath:'src/assets/vector/test.svg',viewBox:[0,0,100,100],sha256:'a'.repeat(64),notes:'keep notes',reviewed:true,markers:[{id:'marker',kind:'add-region',x:50,y:60,regionId:0,note:'fill',createdAt:line.createdAt}],closures:[curved]};
 const review={...model.emptyReview(),assets:[entry]},parsed=model.parseReview(JSON.stringify(review),catalog);
 assert.deepEqual(parsed,review);assert.equal(model.mergeReviews(parsed,parsed).assets[0].closures.length,1);
 for(const mutate of [l=>l.width=0,l=>l.control.x=-1,l=>l.fillSeed.y=101,l=>l.id='marker']){
  const invalid=structuredClone(review);mutate(invalid.assets[0].closures[0]);assert.throws(()=>model.parseReview(JSON.stringify(invalid),catalog));
 }
});
test('reopening the recorded line queue preserves other progress and proposed geometry',()=>{
 const input=JSON.parse(fs.readFileSync('docs/studioodle-artwork-review-2026-10-23.json','utf8'));
 const source=structuredClone(input),ids=tasks.lineRepairIds(input),revisions=new Map();assert.equal(ids.size,33);
 const wizard=input.assets.find(a=>a.assetId==='fantasy-wandering-wizard');wizard.closures=[{id:'existing-line',a:{x:1,y:1},b:{x:2,y:2},control:null,width:1,fillSeed:null,note:'preserve',createdAt:'2026-10-23T00:00:00Z'}];
 for(const id of ids){const task=tasks.lineRepairTasks.find(a=>a.assetId===id),base=input.assets.find(a=>a.assetId===id);revisions.set(id,{sha256:task.afterSha256??task.beforeSha256,viewBox:base.viewBox,regionAt:()=>999});}
 const reopened=tasks.reopenLineRepairs(input,ids,revisions);
 for(const old of source.assets)if(!ids.has(old.assetId))assert.deepEqual(reopened.assets.find(a=>a.assetId===old.assetId),old);
 const changed=reopened.assets.find(a=>a.assetId===wizard.assetId);assert.deepEqual(changed.closures,wizard.closures);assert.equal(changed.notes,wizard.notes);assert.equal(changed.reviewed,false);assert.equal(changed.markers.length,1);assert.equal(changed.markers[0].regionId,999);
 assert(reopened.assets.find(a=>a.assetId==='fantasy-moon-sorceress').markers.some(m=>m.id==='3e2b6a5e-026f-4015-b59a-495313d22591'),'Keep the already-transparent hair constraint');
 assert.deepEqual(tasks.reopenLineRepairs(reopened,ids,revisions),reopened,'Repeating the action must not duplicate or remove pending work');
 revisions.set(wizard.assetId,{...revisions.get(wizard.assetId),sha256:'0'.repeat(64)});assert.throws(()=>tasks.reopenLineRepairs(input,ids,revisions),/not a recorded cutout-only/);
 assert.equal(input.assets.find(a=>a.assetId===wizard.assetId).reviewed,true,'Failed preparation must not mutate the input');
});
