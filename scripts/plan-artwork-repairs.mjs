import fs from 'node:fs';
import crypto from 'node:crypto';
import { planAssetRepairs } from './artwork-review-repairs.mjs';

const file=process.argv[2];
if(!file||process.argv.slice(3).some(arg=>arg!=='--apply'&&!arg.startsWith('--out=')))throw Error('Usage: node scripts/plan-artwork-repairs.mjs <review.json> [--apply] [--out=work/pass-name]');
const directory=process.argv.slice(3).find(arg=>arg.startsWith('--out='))?.slice(6)??'work/artwork-repair-pass';
if(fs.existsSync(`${directory}/promotion.json`))throw Error('This repair stage was already promoted; use a fresh --out directory for another pass.');
const bytes=fs.readFileSync(file),review=JSON.parse(bytes),assets=JSON.parse(fs.readFileSync('art/stickers.json','utf8'));
if(review.kind!=='studioodle-artwork-review'||review.version!==1||review.coordinateSpace!=='svg-viewBox')throw Error('Unsupported review');
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const results=[];
for(const entry of review.assets){
 const asset=assets.find(asset=>asset.id===entry.assetId);if(!asset)throw Error(`Unknown asset ${entry.assetId}`);
 const svg=fs.readFileSync(`src/assets/vector/${asset.id}.svg`);
 if(digest(svg)!==entry.sha256)throw Error(`Artwork changed since review: ${asset.id}`);
 if(entry.markers.length||entry.notes.trim())results.push({...planAssetRepairs(asset,svg.toString(),entry),beforeSha256:entry.sha256,sourceSha256:digest(fs.readFileSync(asset.source))});
}
fs.mkdirSync(directory,{recursive:true});
const plan={reviewFile:file,reviewSha256:digest(bytes),createdAt:new Date().toISOString(),assets:results};
fs.writeFileSync(`${directory}/plan.json`,JSON.stringify(plan,null,2)+'\n');
const operations=results.flatMap(asset=>asset.operations),targets=results.filter(asset=>asset.cutouts.length).map(asset=>asset.assetId);
fs.writeFileSync(`${directory}/targets.json`,JSON.stringify(targets,null,2)+'\n');
console.log(JSON.stringify({assets:results.length,targets:targets.length,regions:results.reduce((sum,asset)=>sum+asset.cutouts.length,0),planned:operations.filter(o=>o.status==='planned').length,alreadyTransparent:operations.filter(o=>o.status==='already-transparent').length,deferred:operations.filter(o=>o.status==='deferred').length}));
for(const asset of results)for(const operation of asset.operations.filter(o=>o.kind==='remove-region'&&o.status==='deferred'))console.log(`${asset.assetId}: ${operation.reason}`);
if(process.argv.includes('--apply')){
 for(const result of results){
  const asset=assets.find(asset=>asset.id===result.assetId);
  if(result.cutouts.length){
   const points=[...(asset.cutouts??[])];
   for(const {point} of result.cutouts)if(!points.some(existing=>existing[0]===point[0]&&existing[1]===point[1]))points.push(point);
   asset.cutouts=points;
  }
 }
 fs.writeFileSync('art/stickers.json',JSON.stringify(assets,null,2)+'\n');
 console.log(`Added cutout seeds to ${targets.length} manifest entries; original artwork and review export untouched.`);
}
