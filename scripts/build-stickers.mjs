// Unified offline vector/region authoring pipeline. No app tests or builds.
import fs from 'node:fs';
import { regionSvg } from './svg-regions.mjs';
import { stickerInspection } from './sticker-inspection.mjs';
import { cleanA4InkPockets, cleanTinyInkPockets } from './ink-pocket-cleanup.mjs';
import { execFileSync } from 'node:child_process';
const inspectionDirectory=process.argv.find(arg=>arg.startsWith('--inspect='))?.slice('--inspect='.length);
const experimentOutput=process.argv.find(arg=>arg.startsWith('--experiment-output='))?.slice('--experiment-output='.length);
const cleanupComponents=process.argv.includes('--cleanup-components');
if(cleanupComponents&&!experimentOutput)throw Error('Component cleanup requires experimental output');
const cleanupA4=process.argv.includes('--cleanup-a4-pockets');
const cleanupPockets=process.argv.includes('--cleanup-small-pockets')||cleanupA4;
if(cleanupPockets&&!experimentOutput)throw new Error('Pocket cleanup is experimental; specify --experiment-output');
const authoringOnly=inspectionDirectory||experimentOutput;
const inspectionThreshold=Number(process.argv.find(arg=>arg.startsWith('--inspect-threshold='))?.split('=')[1]??50);
const inspectionPrefix=process.argv.find(arg=>arg.startsWith('--inspect-prefix='))?.split('=')[1]??'';
const inspectionSharedSource=process.argv.find(arg=>arg.startsWith('--inspect-shared-source='))?.split('=')[1]??'';
if(!Number.isFinite(inspectionThreshold)||inspectionThreshold<=0||inspectionThreshold>=100)throw new Error('Inspection threshold must be between 0 and 100');
if(!inspectionDirectory && inspectionThreshold!==50)throw new Error('Threshold comparisons require --inspect');
if(!/^[a-z0-9-]*$/.test(inspectionPrefix))throw new Error('Invalid inspection filename prefix');
const assets = JSON.parse(fs.readFileSync('art/stickers.json','utf8'));
const out='src/assets/vector', work='work/hybrid';
fs.mkdirSync(out,{recursive:true}); fs.mkdirSync(work,{recursive:true});
fs.mkdirSync('art/source/shapes',{recursive:true});
const shape = (name, body) => !authoringOnly && fs.writeFileSync(`art/source/shapes/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="280"><g fill="white" stroke="black" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`);
shape('circle','<circle cx="110" cy="140" r="80"/>');
shape('square','<rect x="30" y="60" width="160" height="160"/>');
shape('triangle','<path d="M110 55L25 215H195Z"/>');
shape('tree','<rect x="88" y="140" width="44" height="120" rx="8"/><rect x="15" y="30" width="190" height="160" rx="65"/>');
shape('flower', '<rect x="104" y="140" width="12" height="120" rx="4"/>' + Array.from({length:5},(_,i)=>{const a=i*Math.PI*2/5-Math.PI/2;return `<circle cx="${110+Math.cos(a)*42}" cy="${140+Math.sin(a)*42}" r="32"/>`;}).join('')+'<circle cx="110" cy="140" r="26"/>');
const run=(...args)=>execFileSync('magick',args,{maxBuffer:128e6});
const trace=(input, output, alpha=1.2, tolerance=.5, speckle=2)=>execFileSync(process.env.POTRACE_PATH??'work/tools/potrace/potrace-1.16.win64/potrace.exe',[input,'-s','-a',`${alpha}`,'-O',`${tolerance}`,'-t',`${speckle}`,'-o',output]);
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const paths=svg=>[...svg.matchAll(/<path\s+d="([^"]+)"/g)].map(m=>m[1]);
function svgCommands(svg) {
  const root=attrs(svg.match(/<svg[^>]*>/)[0]), group=attrs(svg.match(/<g[^>]*>/)?.[0]??'');
  const commands=[];
  for(const match of svg.matchAll(/<(path|circle|rect)\b[^>]*>/g)) {
    const a={...group,...attrs(match[0])};let d=a.d;
    if(match[1]==='circle'){const x=+a.cx,y=+a.cy,r=+a.r;d=`M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;}
    if(match[1]==='rect'){const x=+(a.x??0),y=+(a.y??0),w=+a.width,h=+a.height,r=Math.min(+(a.rx??0),w/2,h/2);d=`M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;}
    commands.push({d,fill:a.fill==='black'?'ink':a.fill==='none'?'none':'base',stroke:a.stroke!=='none',width:+(a['stroke-width']??5)});
  }
  return {commands,sourceWidth:+root.width,sourceHeight:+root.height};
}
const pending=process.argv.includes('--pending');
const target=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
if(authoringOnly && (!target || pending))throw new Error('Inspection requires one asset ID and cannot use --pending');
const report=(pending || target) && fs.existsSync('art/conversion-report.json') ? JSON.parse(fs.readFileSync('art/conversion-report.json','utf8')).filter(item=>item.id!==target) : [];
for(const asset of assets) {
  const {id,width,height}=asset;
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid asset ID');
  if(target && id!==target) continue;
  if(pending && report.some(item=>item.id===id) && fs.existsSync(`${out}/${id}.svg`)) continue;
  const base=`${work}/${id}`, source=asset.source;
  if(inspectionDirectory && asset.mode==='svg')throw new Error('Stage inspection currently supports raster sources only');
  const inspection=inspectionDirectory?stickerInspection(inspectionDirectory,asset,{threshold:inspectionThreshold,prefix:inspectionPrefix,sharedSource:inspectionSharedSource}):undefined;
  let commands,matrix,inkSvg,cleanupReport;
  if(asset.mode==='svg') {
    const original=fs.readFileSync(source,'utf8'), parsed=svgCommands(original);
    commands=parsed.commands;matrix=[width/parsed.sourceWidth,0,0,height/parsed.sourceHeight,0,0];
    inkSvg=`<g transform="scale(${matrix[0]} ${matrix[3]})">${original.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</g>`;
  } else {
    const crop=asset.crop?['-crop',asset.crop,'+repage']:[];
    run(source,...crop,'-background','white','-alpha','remove','-alpha','off','-colorspace','Gray',...(asset.extracted?['-bordercolor','white','-border','2']:[]),`${base}-gray.png`);
    const [sw,sh]=run('identify','-format','%w %h',`${base}-gray.png`).toString().split(' ').map(Number);
    const gray=run(`${base}-gray.png`,'-depth','8','gray:-');
    if(asset.extracted){
      // A bounding-box crop can include neighboring objects from the original
      // page. Isolate the largest connected outline, retaining ink enclosed by it.
      const marks=new Int32Array(sw*sh),q=new Int32Array(sw*sh);let component=0,biggest=0,best=0;
      for(let seed=0;seed<gray.length;seed++){if(gray[seed]>=128||marks[seed])continue;let head=0,tail=1;q[0]=seed;marks[seed]=++component;while(head<tail){const i=q[head++],x=i%sw,y=Math.floor(i/sw);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,n=ny*sw+nx;if(nx>=0&&ny>=0&&nx<sw&&ny<sh&&gray[n]<128&&!marks[n]){marks[n]=component;q[tail++]=n;}}}if(tail>best){best=tail;biggest=component;}}
      const outside=new Uint8Array(gray.length);let head=0,tail=1;q[0]=0;outside[0]=1;
      while(head<tail){const i=q[head++],x=i%sw;const visit=n=>{if(!outside[n]&&marks[n]!==biggest){outside[n]=1;q[tail++]=n;}};if(x)visit(i-1);if(x+1<sw)visit(i+1);if(i>=sw)visit(i-sw);if(i+sw<gray.length)visit(i+sw);}
      for(let i=0;i<gray.length;i++)if(outside[i])gray[i]=255;
      fs.writeFileSync(`${base}-clean.gray`,gray);run('-size',`${sw}x${sh}`,'-depth','8',`${base}-clean.gray`,`${base}-gray.png`);
    }
    inspection?.source(`${base}-gray.png`);
    const histogram=new Uint32Array(Math.ceil(Math.min(sw,sh)*.04)+1);
    const record=n=>{if(n>=3&&n<histogram.length)histogram[n]++;};
    for(let y=0;y<sh;y++){let n=0;for(let x=0;x<=sw;x++){if(x<sw&&gray[y*sw+x]<128)n++;else{record(n);n=0;}}}
    for(let x=0;x<sw;x++){let n=0;for(let y=0;y<=sh;y++){if(y<sh&&gray[y*sw+x]<128)n++;else{record(n);n=0;}}}
    let stroke=3;for(let n=4;n<histogram.length;n++)if(histogram[n]>histogram[stroke])stroke=n;
    run(`${base}-gray.png`,'-blur',`0x${stroke*.04}`,'-threshold',`${inspectionDirectory?inspectionThreshold:50}%`,`${base}.pbm`);
    inspection?.bitmap(`${base}-gray.png`,`${base}.pbm`,stroke);
    trace(`${base}.pbm`,`${base}-ink.svg`,1.2,.5*stroke/12,Math.max(2,Math.round(8*(stroke/12)**2)));
    inspection?.ink(`${base}-ink.svg`);
    commands=paths(fs.readFileSync(`${base}-ink.svg`,'utf8')).map(d=>({d,fill:'ink',stroke:false,width:0}));
    if(cleanupPockets){
      const cleaned=cleanupA4?cleanA4InkPockets(commands.map(c=>c.d),sw,sh,Number(process.argv.find(arg=>arg.startsWith('--cleanup-area='))?.split('=')[1]??3)):cleanTinyInkPockets(commands.map(c=>c.d));
      commands=[{d:cleaned.d,fill:'ink',stroke:false,width:0}];cleanupReport=cleaned.report;
      fs.writeFileSync(`${base}-pocket-cleanup.json`,JSON.stringify(cleanupReport,null,2));
    }
    matrix=[.1*width/sw,0,0,-.1*height/sh,0,height];
    inkSvg=`<g fill="black" transform="matrix(${matrix.join(' ')})">${commands.map(c=>`<path d="${c.d}"/>`).join('')}</g>`;
  }
  // Supersample discovery/tracing independently of the shipped runtime lookup.
  // Keep large scenery bounded instead of scaling every asset into a huge map.
  const lookupScale=width*height<=300000?4:2;
  const scale=[8,4,2,1].find(value=>value<=lookupScale*2 && width*height*value*value<=16_000_000);
  if(!scale)throw new Error(`${id}: asset exceeds the offline analysis budget`);
  const w=width*scale,h=height*scale,count=w*h;
  // Hidden closures keep fill regions enclosed without drawing boxed scenery edges.
  const barriers=asset.horizon ? `<g transform="matrix(${matrix.join(' ')})" fill="none" stroke="black" stroke-width="5">${commands.filter(c=>c.fill==='base').map(c=>`<path d="${c.d}"/>`).join('')}</g>` : '';
  const preview=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="white"/>${inkSvg}${barriers}</svg>`;
  fs.writeFileSync(`${base}-render.svg`,preview);
  const gray=run('-background','white',`${base}-render.svg`,...(asset.analysisGapClosure?['-morphology','Open',`Disk:${asset.analysisGapClosure*scale}`]:[]),'-alpha','remove','-colorspace','Gray','-depth','8','gray:-');
  inspection?.analysis(`${base}-render.svg`,gray,w,h,scale,lookupScale);
  if(gray.length!==count)throw new Error(`${id}: raster dimensions`);
  const labels=new Int32Array(count);labels.fill(-1);for(let i=0;i<count;i++)if(gray[i]<128)labels[i]=-2;
  const queue=new Int32Array(count),areas=[];
  function flood(seed,label){let head=0,tail=1;queue[0]=seed;labels[seed]=label;while(head<tail){const i=queue[head++],x=i%w;const visit=n=>{if(labels[n]===-1){labels[n]=label;queue[tail++]=n;}};if(x)visit(i-1);if(x+1<w)visit(i+1);if(i>=w)visit(i-w);if(i+w<count)visit(i+w);}return tail;}
  // Raster horizons continue off the canvas: only top-connected white is sky.
  // Side/bottom canvas edges implicitly close ground regions without visible ink.
  if(asset.interior) {
    // Canvas edges close interior walls and floors; none is outside sky.
  } else if(asset.horizon && asset.mode!=='svg') {
    if(asset.skySeeds) {
      for(const [x,y] of asset.skySeeds) {
        const px=Math.floor(x*scale),py=Math.floor(y*scale);
        if(px<0||py<0||px>=w||py>=h||labels[py*w+px]!==-1)throw new Error(`${id}: invalid sky seed`);
        flood(py*w+px,0);
      }
    } else for(let x=0;x<w;x++)if(labels[x]===-1)flood(x,0);
  } else {
    for(let x=0;x<w;x++)for(const i of [x,(h-1)*w+x])if(labels[i]===-1)flood(i,0);
    for(let y=0;y<h;y++)for(const i of [y*w,y*w+w-1])if(labels[i]===-1)flood(i,0);
  }
  // Authored seeds mark enclosed negative space, not paintable sticker regions.
  // Keep them in logical asset coordinates so source rebuilds remain reproducible.
  for(const [x,y] of asset.cutouts??[]) {
    const px=Math.floor(x*scale),py=Math.floor(y*scale),index=py*w+px;
    if(px<0||py<0||px>=w||py>=h||labels[index]!==-1)
      throw new Error(`${id}: cutout (${x}, ${y}) must lie inside an enclosed white region`);
    flood(index,0);
  }
  let regionCount=0;for(let i=0;i<count;i++)if(labels[i]===-1)areas.push(flood(i,++regionCount));
  if(cleanupComponents||asset.minimumRegionAreaPixels){
    // flood() has already assigned each connected white glob its own ID.
    // Measure those globs, not the potentially self-intersecting ink subpaths.
    const a4w=210/25.4*150,a4h=297/25.4*150;
    const fit=Math.max(Math.min(a4w/width,a4h/height),Math.min(a4h/width,a4w/height));
    const cutoff=asset.minimumRegionAreaPixels??10.2, pixelArea=(fit/scale)**2;
    if(!Number.isFinite(cutoff)||cutoff<=0)throw Error('Minimum region area must be positive');
    const removed=new Set(areas.flatMap((area,index)=>area*pixelArea<cutoff?[index+1]:[]));
    const stride=Math.ceil(w/8),bitmap=Buffer.alloc(stride*h),mapping=new Int32Array(regionCount+1);
    let next=0;
    for(let id=1;id<=regionCount;id++)if(!removed.has(id))mapping[id]=++next;
    for(let i=0;i<count;i++){
      if(removed.has(labels[i])){bitmap[Math.floor(i/w)*stride+((i%w)>>3)]|=1<<(7-(i%w&7));labels[i]=-2;gray[i]=0;}
      else if(labels[i]>0)labels[i]=mapping[labels[i]];
    }
    if(removed.size){
      const file=`${base}-component-patches.pbm`,output=`${base}-component-patches.svg`;
      fs.writeFileSync(file,Buffer.concat([Buffer.from(`P4\n${w} ${h}\n`),bitmap]));
      trace(file,output,0,0,0);
      const factors=[(.1/scale)/matrix[0],(-.1/scale)/matrix[3]];
      for(const d of paths(fs.readFileSync(output,'utf8'))){let axis=0;
        commands.push({d:d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,n=>String(Number(n)*factors[axis++%2])),fill:'ink',stroke:false,width:0});
      }
    }
    cleanupReport={method:'connected white components',maximumAreaPixels:cutoff,beforeRegions:regionCount,removed:removed.size,
      pockets:[...removed].map(id=>({id,areaPixels:areas[id-1]*pixelArea}))};
    fs.writeFileSync(`${base}-component-cleanup.json`,JSON.stringify(cleanupReport,null,2));
    const retainedAreas=areas.filter((_,index)=>!removed.has(index+1));
    areas.splice(0,areas.length,...retainedAreas);
    regionCount=next;
  }
  inspection?.discovered(labels,w,h,regionCount);
  // No regions is a real conversion failure, never silently emit an empty sticker.
  if(!regionCount)throw new Error(`${id}: no enclosed coloring regions`);
  let left=w,top=h,right=0,bottom=0;
  for(let i=0;i<count;i++)if(labels[i]!==0){const x=i%w,y=Math.floor(i/w);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  const bounds={left:left/scale,top:top/scale,right:right/scale,bottom:bottom/scale};
  // Extend categorical labels under the ink with nearest 4-connected regions.
  let head=0,tail=0;for(let i=0;i<count;i++){if(labels[i]<0)continue;const x=i%w;if((x&&labels[i-1]===-2)||(x+1<w&&labels[i+1]===-2)||(i>=w&&labels[i-w]===-2)||(i+w<count&&labels[i+w]===-2))queue[tail++]=i;}
  while(head<tail){const i=queue[head++],x=i%w;const visit=n=>{if(labels[n]===-2){labels[n]=labels[i];queue[tail++]=n;}};if(x)visit(i-1);if(x+1<w)visit(i+1);if(i>=w)visit(i-w);if(i+w<count)visit(i+w);}
  inspection?.extended(labels,w,h);
  let svg=regionSvg({width,height,bounds,regionCount,scale,lookupScale,labels,commands,matrix,inkMask:gray,overlapPixels:asset.regionOverlapPixels??1});
  if(experimentOutput){
    if(cleanupReport)svg=svg.replace('<g id="regions"',`<metadata>${JSON.stringify({experiment:cleanupComponents?'connected component cleanup':cleanupA4?'A4 area pocket cleanup':'line-width pocket cleanup',...cleanupReport,pockets:undefined})}</metadata><g id="regions"`);
    fs.writeFileSync(experimentOutput,svg);console.log(`${id}: ${cleanupReport?.removed??0} pockets absorbed into ink; ${regionCount} final regions; ${experimentOutput}`);continue;
  }
  if(inspection){inspection.finish(svg);console.log(`${id}: captured current pipeline in ${inspectionDirectory}`);continue;}
  fs.writeFileSync(`${out}/${id}.svg`,svg);
  // Remove obsolete generated transport only after the replacement was written.
  if (fs.existsSync(`${out}/${id}.json`)) fs.unlinkSync(`${out}/${id}.json`);
  run('-background','white',`${out}/${id}.svg`,'-resize','180x170','-gravity','center','-extent','200x205','-font','Arial','-pointsize','12','-gravity','south','-annotate','+0+5',id,`${base}-preview.png`);
  report.push({id,width,height,regionCount,tinyRegions:areas.filter(a=>a<16*(scale/lookupScale)**2).length,analysisScale:scale,lookupScale,mode:asset.mode??'potrace-light'});
  fs.writeFileSync('art/conversion-report.json',JSON.stringify(report,null,2));
  console.log(`${id}: ${regionCount} regions`);
}
if(!target){
  fs.writeFileSync(`${out}/catalog.json`,JSON.stringify(Object.fromEntries(assets.map(a=>[a.id,{width:a.width,height:a.height,...(a.interior?{interior:true}:{}),...(a.horizon?{horizon:true,horizonStart:a.horizonStart??.58,...(a.horizonOverscan?{horizonOverscan:a.horizonOverscan}:{})}:{})}]))));
  fs.writeFileSync('src/editor/stickerKinds.ts',`// Generated from art/stickers.json by scripts/build-stickers.mjs.\nexport type StickerKind = ${assets.map(a=>JSON.stringify(a.id)).join(' | ')};\n`);
  for(let i=0;i<assets.length;i+=12)run('montage',...assets.slice(i,i+12).map(a=>`${work}/${a.id}-preview.png`),'-tile','4x3','-geometry','+6+6','-background','#eeeeee',`${work}/sheet-${i/12+1}.png`);
}

// Refresh the searchable authoring library and the UI display metadata.
if(!authoringOnly)await import('./build-asset-catalog.mjs');
