import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('refined sorceress closes the teardrop, preserves eye highlights and adds no detached ink',()=>{
 const scope=new paper.PaperScope();scope.setup(new scope.Size(100,100));
 const source=fs.readFileSync('experiments/moon-sorceress/06-traced-ink.svg','utf8');
 const original=new scope.CompoundPath({pathData:[...source.matchAll(/<path\s+d="([^"]+)"/g)].map(m=>m[1]).join(' '),insert:false}).resolveCrossings().reorient(true,true);
 const final=fs.readFileSync('experiments/moon-sorceress/curve-unioned-cleanup.svg','utf8');
 const ink=final.slice(final.indexOf('<g id="ink"'));
 const d=/<path[^>]* d="([^"]+)"/.exec(ink)[1];
 const result=new scope.CompoundPath({pathData:d,insert:false}).resolveCrossings().reorient(true,true);
 assert.equal(result.children.filter(p=>p.area>0).length,original.children.filter(p=>p.area>0).length);
 const factor=Math.abs(.1*340/888*-.1*480/1254)*(210/25.4*150/340)**2;
 assert.equal(result.children.filter(p=>p.area<0&&Math.abs(p.area)*factor<10.2).length,0);
 const sparkle=original.children.find(p=>p.area<0&&Math.abs(p.area)*factor>13&&Math.abs(p.area)*factor<14.5&&p.bounds.x>4700&&p.bounds.y>11000);
 assert.ok(sparkle);
 assert.equal(result.contains(sparkle.interiorPoint),false,'Round eye sparkle must remain white');
 assert.equal(original.contains(new scope.Point(4500,7390)),false);
 assert.equal(result.contains(new scope.Point(4500,7390)),true,'Teardrop must become solid ink');
 const metadata=JSON.parse(/<metadata>(.*?)<\/metadata>/.exec(final)[1]);
 assert.equal(metadata.remainingSmallComponents,0);assert.equal(metadata.finalRegions,199);
 assert.equal(metadata.removed,13);assert.equal(metadata.unresolved.length,0);
 const regions=[...final.matchAll(/<path id="region-\d+"[^>]* d="([^"]+)"/g)];
 assert.equal(regions.length,199);
 for(const region of regions){const path=new scope.CompoundPath({pathData:region[1],insert:false});assert.equal(path.children.filter(p=>p.area>0).length,1);}
 scope.remove();
});
