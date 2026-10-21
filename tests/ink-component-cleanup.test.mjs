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

test('cape retouch preserves the shoulder strand and keeps hair, cape, sleeve and skirt separately fillable',()=>{
 const scope=new paper.PaperScope();scope.setup(new scope.Size(340,480));
 try{
  const source=fs.readFileSync('art/source/fantasy/moon-sorceress.svg','utf8');
  const revised=new scope.CompoundPath({pathData:/<path d="([^"]+)"/.exec(source)[1],insert:false});
  const reference=fs.readFileSync('experiments/moon-sorceress/curve-unioned-cleanup.svg','utf8').split('<g id="ink"')[1];
  const original=new scope.CompoundPath({pathData:/\bd="([^"]+)"/.exec(reference)[1],insert:false});
  original.transform(new scope.Matrix(.../transform="matrix\(([^)]+)\)/.exec(reference)[1].split(/[ ,]+/).map(Number)));
  for(let y=125.25;y<168;y+=.5)for(let x=136.25;x<154;x+=.5){
   if(x>=136.4&&x<=137.8&&y>=153.5&&y<=160.1)continue; // two deliberately removed stray marks
   const p=new scope.Point(x,y);assert.equal(revised.contains(p),original.contains(p),`Front strand changed at ${x},${y}`);
  }
  for(let y=4.25;y<478;y+=8)for(let x=4.25;x<338;x+=8){
   if(x>121&&x<161&&y>153&&y<219)continue;
   const p=new scope.Point(x,y);assert.equal(revised.contains(p),original.contains(p),`Unrelated artwork changed at ${x},${y}`);
  }
  const svg=fs.readFileSync('src/assets/vector/fantasy-moon-sorceress.svg','utf8');
  const regions=[...svg.matchAll(/<path id="region-(\d+)"[^>]*transform="matrix\(([^)]+)\)" d="([^"]+)"/g)].map(m=>{
   const path=new scope.CompoundPath({pathData:m[3],insert:false});path.transform(new scope.Matrix(...m[2].split(/[ ,]+/).map(Number)));return{id:+m[1],path};
  });
  const ids=[[141,165],[138,180],[125,180],[144,195]].map(p=>{
   const hit=regions.filter(r=>r.path.contains(new scope.Point(...p)));assert.equal(hit.length,1);return hit[0].id;
  });
  assert.equal(new Set(ids).size,4,'Hair, cape, sleeve and skirt must not leak into one another');
 }finally{scope.remove();}
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
