import assert from 'node:assert/strict';
import fs from 'node:fs';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
let server,model,geometry,tasks,cleanup;
const reviewFixture = key => JSON.parse(fs.readFileSync('tests/fixtures/artwork-review/reviews.json','utf8'))[key];
const repairLedger = key => JSON.parse(fs.readFileSync('tools/artwork-review/data/repair-history.json','utf8'))[key];
before(async()=>{server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});model=await server.ssrLoadModule('/tools/artwork-review/src/artworkReviewModel.ts');geometry=await server.ssrLoadModule('/tools/artwork-review/src/artworkReviewGeometry.ts');tasks=await server.ssrLoadModule('/tools/artwork-review/src/artworkLineTasks.ts');cleanup=await server.ssrLoadModule('/tools/artwork-review/src/artworkReviewCleanup.ts');});
after(async()=>{await server?.close();});
test('extending review annotations preserves the complete existing exported review',()=>{
 const original=reviewFixture('initial');
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
 const input=reviewFixture('initial');

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
 const exported=reviewFixture('lineV1');
 const old=exported.assets.find(a=>a.assetId==='fantasy-wandering-wizard'),task=tasks.rebuiltLineTasks.find(a=>a.assetId===old.assetId);
 const extra={...old.closures[0],id:'unexported-new-line'};
 const base={...old,closures:[...old.closures,extra]},before=structuredClone(base);
 const revision={sha256:task.afterSha256,viewBox:base.viewBox,regionAt:()=>123};
 const next=tasks.refreshKnownRepair(base,revision);
 assert.equal(next.reviewed,false);assert.equal(next.sha256,task.afterSha256);
 assert.deepEqual(next.closures,[extra],'Only actually applied line IDs leave the proposal overlay');
 assert.equal(next.notes,base.notes);assert.equal(next.markers[0].x,base.markers[0].x);assert.equal(next.markers[0].regionId,123);
 assert.deepEqual(base,before);assert.equal(tasks.refreshKnownRepair(next,revision),next,'Reloading must not reset completed inspection');
 const historical=reviewFixture('initial').assets.find(a=>a.assetId===old.assetId);
 assert.equal(tasks.refreshKnownRepair(historical,revision).sha256,task.afterSha256,'The earlier cutout repair can be reconciled through the line repair');
});

test('review cleanup clears one category or all annotations and restores only removed fields',()=>{
 const fixture=reviewFixture('lineV1');
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
 const first=reviewFixture('lineV1');
 const second=reviewFixture('lineV2');
 const nextLedger=repairLedger('lineV2');

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

test('line-then-marker pass retires only the applied instructions and keeps future annotations',()=>{
 const submitted=reviewFixture('lineV3');
 const ledger=repairLedger('markerV3');
 assert.equal(ledger.assets.reduce((n,a)=>n+a.appliedMarkerIds.length,0),60);

 for(const task of ledger.assets){
  const old=submitted.assets.find(a=>a.assetId===task.assetId),marker={...old.markers[0],id:'future-marker',note:'keep this new instruction'};
  const extra=old.closures?.[0]?{...old.closures[0],id:'future-line'}:undefined;
  const base={...old,notes:'keep notes for the next review',markers:[...old.markers,marker],closures:[...(old.closures??[]),...(extra?[extra]:[])]};
  const revision={sha256:task.afterSha256,viewBox:old.viewBox,regionAt:()=>123};
  const next=tasks.refreshKnownRepair(base,revision);
  assert.equal(next.sha256,task.afterSha256);assert.equal(next.notes,base.notes);
  assert.deepEqual(next.markers,[{...marker,regionId:123}]);assert.deepEqual(next.closures,extra?[extra]:[]);
  assert.equal(tasks.refreshKnownRepair(next,revision),next,'Later reviews must not be reset on reload');
  if(task.beforeSha256===task.afterSha256){
   const settled={...base,sha256:task.afterSha256,closures:extra?[extra]:[]};
   assert.deepEqual(tasks.refreshKnownRepair(settled,revision).markers,[marker],'Retire fill markers already satisfied on this same geometry revision');
  }
 }
});

test('histories contain the latest and preceding changed sets, without accumulating old artwork',()=>{
 const read=name=>repairLedger(name==='line-repairs'?'lineV5':'markerV5');
 const line=read('line-repairs'),markers=read('marker-repairs');
 const changed=entries=>[...new Set(entries.filter(a=>a.beforeSha256!==a.afterSha256).map(a=>a.assetId))].sort();
 assert.equal(tasks.repairHistory.length,2);
 assert.deepEqual([...tasks.repairHistory[0].assetIds].sort(),changed([...line.assets,...markers.assets]));
 assert.equal(tasks.repairHistory[0].assetIds.length,17);assert.equal(tasks.repairHistory[0].label,'History 1');
 const oldLines=repairLedger('lineV4');
 const oldMarkers=repairLedger('markerV4');
 assert.deepEqual([...tasks.repairHistory[1].assetIds].sort(),changed([...oldLines.assets,...oldMarkers.assets]));
 assert.equal(tasks.repairHistory[1].assetIds.length,7);assert.equal(tasks.repairHistory[1].label,'History 2');
 assert(!tasks.repairHistory.some(h=>h.assetIds.includes('fantasy-wandering-wizard')),'Older unaffected assets do not stay in either dropdown history');
 const input=reviewFixture('reviewV5');
 const latest=new Map([...line.assets,...markers.assets].map(a=>[a.assetId,a]));
 for(const id of tasks.repairHistory[0].assetIds){
  const base=input.assets.find(a=>a.assetId===id),task=latest.get(id),revision={sha256:task.afterSha256,viewBox:base.viewBox,regionAt:()=>100};
  const next=tasks.refreshKnownRepair(base,revision);
  assert.equal(next.sha256,task.afterSha256);assert.equal(next.markers.length,0);assert.equal(next.closures?.length??0,0);
 }
 const early=reviewFixture('lineV4').assets.find(a=>a.assetId==='nursery-rhymes-shepherd-child');
 const last=latest.get(early.assetId);
 assert.equal(tasks.refreshKnownRepair(early,{sha256:last.afterSha256,viewBox:early.viewBox,regionAt:()=>100}).sha256,last.afterSha256,'Revision reconciliation follows lines and markers in chronological pass order');
});
