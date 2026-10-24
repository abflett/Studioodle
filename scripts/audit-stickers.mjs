// Validate staged sticker geometry and build a compact before/after review index.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import paper from 'paper';
import { selectBatchAssets } from './sticker-batch-selection.mjs';
const directory=process.argv[2]??'work/sticker-upgrade';
const summary=JSON.parse(fs.readFileSync(path.join(directory,'summary.json'),'utf8'));
const assets=selectBatchAssets(JSON.parse(fs.readFileSync('art/stickers.json','utf8')),summary.assetIds);
if(summary.completed!==assets.length||summary.failed)throw Error('Finish the batch successfully before auditing');
paper.setup(new paper.Size(100,100));
const problems=[],rows=[];
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
for(const asset of assets){
 const report=JSON.parse(fs.readFileSync(path.join(directory,'reports',asset.id+'.json'),'utf8'));
 const svg=fs.readFileSync(path.join(directory,'vector',asset.id+'.svg'),'utf8');
 const fail=message=>problems.push({id:asset.id,message});
 if(digest(fs.readFileSync(asset.source))!==report.sourceHash)fail('Original source changed during conversion');
 if(asset.inkSource&&digest(fs.readFileSync(asset.inkSource))!==report.inkSourceHash)fail('Accepted ink source changed during conversion');
 if(digest(svg)!==report.outputHash)fail('Staged output checksum mismatch');
 if(report.cleanup?.remainingSmallComponents||report.cleanup?.unresolved?.length)fail('Small regions remain unresolved');
 if(!svg.includes(`viewBox="0 0 ${asset.width} ${asset.height}"`))fail('Artwork dimensions changed');
 if(/<image\b|data:image|regionRuns|hitCoverage/.test(svg))fail('Raster data found in vector output');
 const group=/<g id="regions"[^>]*>([\s\S]*?)<\/g>/.exec(svg)?.[1]??'';
 const regions=[...group.matchAll(/<path id="region-(\d+)"[^>]*\bd="([^"]*)"/g)];
 if(regions.length!==report.regionCount)fail('Region count does not match conversion report');
 for(const [index,match] of regions.entries()){
  if(Number(match[1])!==index+1)fail('Region IDs are not contiguous');
  const compound=new paper.CompoundPath({pathData:match[2],insert:false});
  const islands=compound.children.filter(p=>p.area>0).length;
  if(islands!==1)fail(`Region ${match[1]} contains ${islands} disconnected outer contours`);
  compound.remove();
 }
 rows.push({...report,title:asset.title,category:asset.category});
}
const report={assets:rows.length,regions:rows.reduce((n,r)=>n+r.regionCount,0),beforeRegions:rows.reduce((n,r)=>n+r.beforeRegions,0),
 removedSmallRegions:rows.reduce((n,r)=>n+(r.cleanup?.removed??0),0),changed:rows.filter(r=>r.changed).length,
 beforeBytes:rows.reduce((n,r)=>n+r.beforeBytes,0),afterBytes:rows.reduce((n,r)=>n+r.bytes,0),problems};
fs.writeFileSync(path.join(directory,'audit.json'),JSON.stringify(report,null,2)+'\n');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
fs.writeFileSync(path.join(directory,'review.html'),`<!doctype html><html><meta charset="utf-8"><title>Sticker cleanup review</title><style>body{font:15px system-ui;background:#172233;color:#f4eddf;margin:24px}h1{margin-bottom:8px}p{color:#c4d0de}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px}article{background:#24344b;padding:14px;border-radius:12px}h2{font-size:16px;margin:0 0 8px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}figure{margin:0}img{width:100%;height:180px;object-fit:contain;background:white}a{color:#b5d6e6}small{display:block;margin-top:8px}</style><h1>Sticker conversion review</h1><p>${rows.length} assets; ${report.changed} updated. Left: previous version. Right: rebuilt with A4/150 DPI cleanup. Click either image for full vector detail.</p><p><a href="audit.json">Validation report</a> | <a href="summary.json">Per-asset conversion report</a></p><div class="grid">${rows.map(r=>`<article><h2>${escape(r.title)}</h2><div class="pair">${['before','vector'].map(folder=>`<figure><a href="${folder}/${r.id}.svg"><img loading="lazy" src="${folder}/${r.id}.svg" alt="${folder} ${escape(r.title)}"></a><figcaption>${folder==='before'?'Before':'After'}</figcaption></figure>`).join('')}</div><small>${r.beforeRegions} ? ${r.regionCount} regions; ${r.cleanup?.removed??0} small-region fixes | ${escape(r.id)}</small></article>`).join('')}</div></html>`);
console.log(JSON.stringify(report));
if(problems.length)process.exitCode=1;
