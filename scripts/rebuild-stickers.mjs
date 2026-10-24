// Isolated, resumable offline conversion. Review staged output before promoting it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { selectBatchAssets } from './sticker-batch-selection.mjs';
const option=(name,fallback)=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const directory=option('out','work/sticker-upgrade'),jobs=Number(option('jobs','2'));
const timeout=Number(option('timeout','180000'));
const resume=process.argv.includes('--resume');
for(const arg of process.argv.slice(2))if(arg!=='--resume'&&!/^--(out|jobs|timeout|ids-file)=/.test(arg))throw Error(`Unknown option: ${arg}`);
if(!Number.isInteger(jobs)||jobs<1||jobs>4||!Number.isFinite(timeout)||timeout<1000)throw Error('Use 1-4 jobs and a positive timeout in milliseconds');
const manifest=JSON.parse(fs.readFileSync('art/stickers.json','utf8')),idsFile=option('ids-file');
const assets=selectBatchAssets(manifest,idsFile?JSON.parse(fs.readFileSync(idsFile,'utf8')):manifest.map(asset=>asset.id));
for(const folder of ['vector','before','reports','errors'])fs.mkdirSync(path.join(directory,folder),{recursive:true});
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const scripts=['build-stickers.mjs','clean-ink-components.mjs','discover-regions.mjs','svg-regions.mjs','svg-rect-path.mjs'];
const pipelineHash=digest(scripts.map(file=>fs.readFileSync(`scripts/${file}`,'utf8')).join('\n'));
const results=[];let next=0,completed=0;
const startedAt=new Date().toISOString();
function summary(){
 const success=results.filter(r=>r.status==='ok');
 return {startedAt,total:assets.length,assetIds:assets.map(asset=>asset.id),completed,pipelineHash,successful:success.length,failed:results.filter(r=>r.status==='failed').length,
  changed:success.filter(r=>r.changed).length,removedRegions:success.reduce((sum,r)=>sum+(r.cleanup?.removed??0),0),
  unresolved:success.filter(r=>r.cleanup?.unresolved?.length||r.cleanup?.remainingSmallComponents),results:[...results].sort((a,b)=>a.id.localeCompare(b.id))};
}
function record(result){results.push(result);completed++;fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify(summary(),null,2)+'\n');console.log(`${completed}/${assets.length} ${result.id}: ${result.status}${result.regionCount===undefined?'':` (${result.regionCount} regions, ${result.cleanup?.removed??0} removed)`}`);}
async function convert(asset){
 const id=asset.id,sourceHash=digest(fs.readFileSync(asset.source)),inkSourceHash=asset.inkSource?digest(fs.readFileSync(asset.inkSource)):undefined,inputHash=digest(JSON.stringify(asset)+sourceHash+(inkSourceHash??''));
 const output=path.join(directory,'vector',id+'.svg'),reportPath=path.join(directory,'reports',id+'.json');
 const existing=fs.readFileSync(`src/assets/vector/${id}.svg`),before=path.join(directory,'before',id+'.svg');
 if(!fs.existsSync(before))fs.writeFileSync(before,existing);
 if(resume&&fs.existsSync(output)&&fs.existsSync(reportPath)){
  const cached=JSON.parse(fs.readFileSync(reportPath,'utf8'));
  if(cached.pipelineHash===pipelineHash&&cached.inputHash===inputHash){record(cached);return;}
 }
 const started=Date.now();
 try{
  await new Promise((resolve,reject)=>execFile(process.execPath,['scripts/build-stickers.mjs',id,`--out=${path.join(directory,'vector')}`,`--report=${reportPath}`,'--no-catalog'],
   {timeout,maxBuffer:8*1024*1024,windowsHide:true,env:{...process.env,MAGICK_THREAD_LIMIT:'1'}},(error,stdout,stderr)=>error?reject(Object.assign(error,{diagnostic:stderr||stdout})):resolve()));
  const built=JSON.parse(fs.readFileSync(reportPath,'utf8')),svg=fs.readFileSync(output);
  const result={...built,status:'ok',pipelineHash,inputHash,sourceHash,inkSourceHash,elapsedMs:Date.now()-started,
   beforeBytes:existing.length,beforeRegions:(existing.toString().match(/id="region-\d+"/g)??[]).length,
   changed:!existing.equals(svg),outputHash:digest(svg)};
  fs.writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n');record(result);
 }catch(error){
  fs.writeFileSync(path.join(directory,'errors',id+'.txt'),String(error.diagnostic||error.stack||error));
  record({id,status:'failed',sourceHash,inputHash,pipelineHash,elapsedMs:Date.now()-started,error:String(error.message)});
 }
}
await Promise.all(Array.from({length:jobs},async()=>{while(next<assets.length){const asset=assets[next++];await convert(asset);}}));
const result=summary();
for(const entry of result.results.filter(r=>r.status==='ok')){const stale=path.join(directory,'errors',entry.id+'.txt');if(fs.existsSync(stale))fs.unlinkSync(stale);}
fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify({...result,finishedAt:new Date().toISOString()},null,2)+'\n');
console.log(JSON.stringify({successful:result.successful,failed:result.failed,changed:result.changed,removedRegions:result.removedRegions,unresolved:result.unresolved.length}));
if(result.failed)process.exitCode=1;
