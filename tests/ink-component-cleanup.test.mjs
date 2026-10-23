import assert from 'node:assert/strict';
import { test } from 'node:test';
import paper from 'paper';
import { discoverRegions } from '../scripts/discover-regions.mjs';
import { cleanInkComponents, a4FitScale } from '../scripts/clean-ink-components.mjs';

test('small true holes close along the original curve instead of receiving raster patches',()=>{
 const scope=new paper.PaperScope();scope.setup(new scope.Size(100,100));
 const outer=new scope.Path.Circle({center:[5,5],radius:20,insert:false});
 const hole=new scope.Path.Circle({center:[5,5],radius:.2,insert:false});hole.clockwise=false;
 const originalOuter=outer.pathData;
 const labels=new Int32Array(80*80);labels[40*80+40]=1;
 const cleaned=cleanInkComponents({commands:[{d:outer.pathData+' '+hole.pathData,fill:'ink',stroke:false}],matrix:[1,0,0,1,0,0],width:340,height:480,scale:8,w:80,h:80,labels,areas:[1]});
 scope.activate();const result=new scope.CompoundPath({pathData:cleaned.d,insert:false});
 assert.equal(cleaned.report.exactHoles,1);
 assert.equal(cleaned.report.curveCaps,0);
 assert.equal(result.children.length,1);
 assert.equal(result.children[0].pathData,originalOuter);
 assert.ok(result.contains(new scope.Point(5,5)));
 scope.remove();
});

test('cleanup preserves authored negative spaces that are not paintable regions',()=>{
 const scope=new paper.PaperScope();scope.setup(new scope.Size(100,100));
 const outer=new scope.Path.Circle({center:[5,5],radius:20,insert:false});
 const pocket=new scope.Path.Circle({center:[5,5],radius:.2,insert:false});pocket.clockwise=false;
 const cutout=new scope.Path.Circle({center:[8,5],radius:.2,insert:false});cutout.clockwise=false;
 const labels=new Int32Array(80*80);labels[40*80+40]=1;
 const result=cleanInkComponents({commands:[{d:outer.pathData+' '+pocket.pathData+' '+cutout.pathData,fill:'ink',stroke:false}],matrix:[1,0,0,1,0,0],width:340,height:480,scale:8,w:80,h:80,labels,areas:[1]});
 scope.activate();const ink=new scope.CompoundPath({pathData:result.d,insert:false});
 assert.equal(result.report.exactHoles,1);
 assert.ok(ink.contains(new scope.Point(5,5)));
 assert.equal(ink.contains(new scope.Point(8,5)),false);
 const additions=new scope.CompoundPath({pathData:result.addedD,insert:false});
 assert.ok(additions.contains(new scope.Point(5,5)));
 assert.equal(additions.contains(new scope.Point(8,5)),false);
 scope.remove();
});

test('normalized cleanup uses the best A4 orientation, independently of logical source size',()=>{
 assert.equal(a4FitScale(340,480),a4FitScale(480,340));
 assert.equal(a4FitScale(680,960)*2,a4FitScale(340,480));
});

test('disconnected white specks receive separate IDs before size filtering',()=>{
 const gray=new Uint8Array(25);gray[6]=255;gray[12]=255;
 const result=discoverRegions(gray,5,5,{id:'disconnected-test'},1);
 assert.equal(result.regionCount,2);
 assert.deepEqual(result.areas,[1,1]);
 assert.notEqual(result.labels[6],result.labels[12]);
});
