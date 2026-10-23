// Promote only a complete, audited staging set; original source artwork is never written.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const directory=process.argv[2]??'work/sticker-upgrade';
const assets=JSON.parse(fs.readFileSync('art/stickers.json','utf8'));
const summary=JSON.parse(fs.readFileSync(path.join(directory,'summary.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(directory,'audit.json'),'utf8'));
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const pipelineHash=digest(['build-stickers.mjs','clean-ink-components.mjs','discover-regions.mjs','svg-regions.mjs'].map(file=>fs.readFileSync(`scripts/${file}`,'utf8')).join('\n'));
if(summary.completed!==assets.length||summary.failed||summary.unresolved.length||audit.assets!==assets.length||audit.problems.length||pipelineHash!==summary.pipelineHash)
 throw Error('A complete successful batch and current clean audit are required before promotion');
const changes=[];
for(const asset of assets){
 const report=JSON.parse(fs.readFileSync(path.join(directory,'reports',asset.id+'.json'),'utf8'));
 const data=fs.readFileSync(path.join(directory,'vector',asset.id+'.svg'));
 if(report.pipelineHash!==pipelineHash||digest(fs.readFileSync(asset.source))!==report.sourceHash||digest(data)!==report.outputHash)
  throw Error(`Stale or modified conversion: ${asset.id}`);
 const destination=`src/assets/vector/${asset.id}.svg`,previous=fs.readFileSync(destination);
 if(!previous.equals(data))changes.push({id:asset.id,destination,previous,data});
}
const written=[];
try{
 for(const item of changes){fs.writeFileSync(item.destination,item.data);written.push(item);}
 await import('./build-asset-catalog.mjs');
}catch(error){for(const item of written)fs.writeFileSync(item.destination,item.previous);throw error;}
fs.writeFileSync(path.join(directory,'promotion.json'),JSON.stringify({promotedAt:new Date().toISOString(),pipelineHash,changed:changes.map(item=>item.id)},null,2)+'\n');
console.log(`Promoted ${changes.length} updated SVGs; original art preserved.`);
