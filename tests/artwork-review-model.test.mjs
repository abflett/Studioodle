import assert from 'node:assert/strict';
import fs from 'node:fs';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
let server,model,geometry,tasks,cleanup;
before(async()=>{server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});model=await server.ssrLoadModule('/src/dev/artworkReviewModel.ts');geometry=await server.ssrLoadModule('/src/dev/artworkReviewGeometry.ts');tasks=await server.ssrLoadModule('/src/dev/artworkLineTasks.ts');cleanup=await server.ssrLoadModule('/src/dev/artworkReviewCleanup.ts');});
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
test('recorded repairs refresh region references without losing new lines, notes or review status',()=>{
 const input=JSON.parse(fs.readFileSync('docs/studioodle-artwork-review-2026-10-23.json','utf8'));
 assert.equal(tasks.lineRepairIds(input).size,31);
 const wizard=input.assets.find(a=>a.assetId==='fantasy-wandering-wizard');
 wizard.closures=[{id:'existing-line',a:{x:1,y:1},b:{x:2,y:2},control:null,width:1,fillSeed:null,note:'preserve',createdAt:'2026-10-23T00:00:00Z'}];
 const original=structuredClone(wizard),task=tasks.lineRepairTasks.find(a=>a.assetId===wizard.assetId);
 const revision={sha256:task.afterSha256,viewBox:wizard.viewBox,regionAt:()=>999};
 const refreshed=tasks.refreshKnownRepair(wizard,revision);
 assert.equal(refreshed.reviewed,true);assert.equal(refreshed.notes,wizard.notes);assert.deepEqual(refreshed.closures,wizard.closures);
 assert.equal(refreshed.markers.length,1);assert.equal(refreshed.markers[0].regionId,999);
 assert.deepEqual(wizard,original,'Never mutate existing annotations');
 assert.equal(tasks.refreshKnownRepair(refreshed,revision),refreshed,'Refresh is idempotent');
 assert.equal(tasks.refreshKnownRepair(wizard,{...revision,sha256:'0'.repeat(64)}),wizard,'Unknown revisions retain their guard');
});

test('rebuilt artwork starts inspection on the new revision without replaying applied lines',()=>{
 const exported=JSON.parse(fs.readFileSync('docs/studioodle-line-repairs-2026-10-24-line-repair.json','utf8'));
 const old=exported.assets.find(a=>a.assetId==='fantasy-wandering-wizard'),task=tasks.rebuiltLineTasks.find(a=>a.assetId===old.assetId);
 const extra={...old.closures[0],id:'unexported-new-line'};
 const base={...old,closures:[...old.closures,extra]},before=structuredClone(base);
 const revision={sha256:task.afterSha256,viewBox:base.viewBox,regionAt:()=>123};
 const next=tasks.refreshKnownRepair(base,revision);
 assert.equal(next.reviewed,false);assert.equal(next.sha256,task.afterSha256);
 assert.deepEqual(next.closures,[extra],'Only actually applied line IDs leave the proposal overlay');
 assert.equal(next.notes,base.notes);assert.equal(next.markers[0].x,base.markers[0].x);assert.equal(next.markers[0].regionId,123);
 assert.deepEqual(base,before);assert.equal(tasks.refreshKnownRepair(next,revision),next,'Reloading must not reset completed inspection');
 const historical=JSON.parse(fs.readFileSync('docs/studioodle-artwork-review-2026-10-23.json','utf8')).assets.find(a=>a.assetId===old.assetId);
 assert.equal(tasks.refreshKnownRepair(historical,revision).sha256,task.afterSha256,'The earlier cutout repair can be reconciled through the line repair');
});

test('review cleanup clears one category or all annotations and restores only removed fields',()=>{
 const fixture=JSON.parse(fs.readFileSync('docs/studioodle-line-repairs-2026-10-24-line-repair.json','utf8'));
 const focused=fixture.assets.find(a=>a.closures?.length&&a.markers.length);fixture.assets=[focused,...fixture.assets.filter(a=>a!==focused)];
 fixture.assets[0].notes='artwork note';fixture.assets[0].reviewed=true;fixture.assets[0].markers[0].note='marker note';fixture.assets[0].closures[0].note='line note';
 const before=structuredClone(fixture);
 for(const {value} of cleanup.cleanupOptions){
  const result=cleanup.clearReview(fixture,value);
  assert(result.removed.length);assert.deepEqual(fixture,before,'Cleanup must not mutate existing state');
  assert(result.review.assets.every(a=>!cleanup.matchesReviewFilter(a,value)),`Category ${value} must be empty`);
  assert.deepEqual(cleanup.restoreReviewCleanup(result.review,result.removed),fixture,'Undo restores the exact previous data');
  for(const entry of result.review.assets){const old=fixture.assets.find(a=>a.assetId===entry.assetId);assert.equal(entry.sha256,old.sha256);assert.deepEqual(entry.viewBox,old.viewBox);}
  if(value==='notes'){
   const changed=result.review.assets[0];assert.equal(changed.markers.length,fixture.assets[0].markers.length);assert.equal(changed.closures.length,fixture.assets[0].closures.length);
   assert.deepEqual(changed.closures[0].a,fixture.assets[0].closures[0].a);assert.equal(changed.reviewed,true);
  }
 }
 assert(!cleanup.matchesReviewFilter(undefined,'refinements'));assert(cleanup.matchesReviewFilter(undefined,'unreviewed'));
});

test('successive line passes preserve the full inspection set and reconcile both submitted revisions',()=>{
 const first=JSON.parse(fs.readFileSync('docs/studioodle-line-repairs-2026-10-24-line-repair.json','utf8'));
 const second=JSON.parse(fs.readFileSync('docs/studioodle-line-repairs-2026-10-24v2.json','utf8'));
 const nextLedger=JSON.parse(fs.readFileSync('docs/studioodle-line-repairs-2026-10-24v2.progress.json','utf8'));
 assert.equal(tasks.lineRepairIds().size,31);
 for(const task of nextLedger.assets){
  const recent=second.assets.find(a=>a.assetId===task.assetId),earlier=first.assets.find(a=>a.assetId===task.assetId);
  const extra={...recent.closures[0],id:'future-proposal'};
  const marker={id:'keep-fill-marker',kind:'add-region',x:10,y:20,regionId:1,note:'for the next region pass',createdAt:extra.createdAt};
  const revision={sha256:task.afterSha256,viewBox:recent.viewBox,regionAt:()=>456};
  for(const entry of [recent,{...earlier,closures:[...earlier.closures,...recent.closures]}]){
   const base={...entry,notes:'keep region inspection notes',markers:[marker],closures:[...entry.closures,extra]};
   const refreshed=tasks.refreshKnownRepair(base,revision);
   assert.equal(refreshed.sha256,task.afterSha256);assert.equal(refreshed.reviewed,false);
   assert.deepEqual(refreshed.closures,[extra]);assert.equal(refreshed.notes,base.notes);
   assert.deepEqual(refreshed.markers,[{...marker,regionId:456}]);
  }
  assert(tasks.hasRecordedRepair(recent));
 }
});
