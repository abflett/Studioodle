import assert from 'node:assert/strict';
import { test } from 'node:test';
import paper from 'paper';
import { cleanInkComponents } from '../scripts/clean-ink-components.mjs';

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
