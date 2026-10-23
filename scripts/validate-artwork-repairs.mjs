import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import paper from 'paper';
import { reviewRegions } from './artwork-review-repairs.mjs';

const directory=process.argv[2]??'work/artwork-repair-pass';
const plan=JSON.parse(fs.readFileSync(path.join(directory,'plan.json'),'utf8'));
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const problems=[],results=[];
if(digest(fs.readFileSync(plan.reviewFile))!==plan.reviewSha256)problems.push('Original review export changed');
for(const asset of plan.assets.filter(asset=>asset.cutouts.length)){
 const before=fs.readFileSync(path.join(directory,'before',asset.assetId+'.svg'),'utf8');
 const after=fs.readFileSync(path.join(directory,'vector',asset.assetId+'.svg'),'utf8');
 const fail=message=>problems.push({assetId:asset.assetId,message});
 if(digest(before)!==asset.beforeSha256)fail('Before snapshot does not match reviewed artwork');
 if(digest(fs.readFileSync(asset.source))!==asset.sourceSha256)fail('Original source art changed');
 const ink=svg=>svg.slice(svg.indexOf('<g id="ink"'));
 if(ink(before)!==ink(after))fail('Ink commands changed in a cutout-only repair');
 const scope=new paper.PaperScope();scope.setup(new scope.Size(100,100));
 try{
  const old=reviewRegions(before,scope),next=reviewRegions(after,scope);
  if(old.length-next.length!==asset.cutouts.length)fail(`Unexpected region count: ${old.length} -> ${next.length}`);
  for(const cutout of asset.cutouts)if(next.some(region=>region.geometry.contains(new scope.Point(...cutout.point))))fail(`Cutout point ${cutout.point} is still paintable`);
  const removed=new Set(asset.cutouts.map(cutout=>cutout.regionId));
  for(const region of old.filter(region=>!removed.has(region.id))){
   const sample=region.geometry.interiorPoint;
   if(!next.some(other=>other.geometry.contains(sample)))fail(`Unmarked region ${region.id} lost its interior`);
  }
  results.push({assetId:asset.assetId,beforeRegions:old.length,afterRegions:next.length,removedRegions:asset.cutouts.length,beforeSha256:asset.beforeSha256,afterSha256:digest(after)});
 }finally{scope.remove();}
}
const result={assets:results.length,removedRegions:results.reduce((sum,r)=>sum+r.removedRegions,0),originalReviewPreserved:true,results,problems};
fs.writeFileSync(path.join(directory,'repair-validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({assets:result.assets,removedRegions:result.removedRegions,problems}));
if(problems.length)process.exitCode=1;
