import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
const compare=process.argv.includes('--compare');
const output=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
const servers=[];
async function open(name){
 const sources=new Map(name==='before'?['vectorPaintGeometry.ts','polygonGeometry.ts'].map(file=>[file,execFileSync('git',['show',`26074b6:src/editor/${file}`],{encoding:'utf8'})]):[]);
 const server=await createServer({configFile:false,plugins:[{name:'paint-model-baseline',enforce:'pre',transform(code,id){return sources.get(id.replaceAll('\\','/').split('/').at(-1));}}],server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 servers.push(server);return server;
}
try{
 let result;
 if(compare){
  const versions=[];
  for(const name of ['before','after']){
   const server=await open(name),geometry=await server.ssrLoadModule('/src/editor/vectorPaintGeometry.ts');
   const {paintWorkloads}=await server.ssrLoadModule('/tests/fixtures/paint-workloads.ts');versions.push({name,geometry,paintWorkloads,samples:[],fillSamples:[]});
  }
  for(let i=0;i<40;i++)for(const v of (i%2?[...versions].reverse():versions)){
   const input=v.paintWorkloads().dense;global.gc?.();let start=performance.now();const compact=v.geometry.compactRegion(input);const elapsed=performance.now()-start;
   let point;outer:for(let y=10;y<350;y+=4)for(let x=10;x<490;x+=4)if(compact.blobs.some(blob=>v.geometry.containsGeometry(blob.geometry,[x,y]))){point=[x,y];break outer;}
   global.gc?.();start=performance.now();v.geometry.filledRegion(compact,999,point,undefined,undefined,compact.blobs.length);const filled=performance.now()-start;
   if(i>=10){v.samples.push(elapsed);v.fillSamples.push(filled);}
  }
  result=versions.map(v=>({name:v.name,trials:30,forcedGC:!!global.gc,compactMedian:v.samples.sort((a,b)=>a-b)[15],componentFillMedian:v.fillSamples.sort((a,b)=>a-b)[15]}));
 }else{
  const server=await open('after'),{profilePaintModel}=await server.ssrLoadModule('/tests/fixtures/paint-workloads.ts');result=Array.from({length:3},()=>profilePaintModel());
 }
 console.log(JSON.stringify(result,null,2));
 if(output){await fs.mkdir('work/tests',{recursive:true});await fs.writeFile(output,JSON.stringify(result,null,2));}
}finally{for(const server of servers)await server.close();}
