// Unified offline vector/region authoring pipeline. No app tests or builds.
import fs from 'node:fs';
import path from 'node:path';
import paper from 'paper';
import { discoverRegions } from './discover-regions.mjs';
import { cleanInkComponents, a4FitScale, defaultMinimumRegionAreaPixels } from './clean-ink-components.mjs';
import { regionSvg } from './svg-regions.mjs';
import { svgRectPath } from './svg-rect-path.mjs';
import { stickerInspection } from './sticker-inspection.mjs';
import { execFileSync } from 'node:child_process';
const inspectionDirectory=process.argv.find(arg=>arg.startsWith('--inspect='))?.slice('--inspect='.length);
const inspectionThreshold=Number(process.argv.find(arg=>arg.startsWith('--inspect-threshold='))?.split('=')[1]??50);
if(!Number.isFinite(inspectionThreshold)||inspectionThreshold<=0||inspectionThreshold>=100)throw new Error('Inspection threshold must be between 0 and 100');
if(!inspectionDirectory && inspectionThreshold!==50)throw new Error('Threshold comparisons require --inspect');
const assets = JSON.parse(fs.readFileSync('art/stickers.json','utf8'));
const out=process.argv.find(arg=>arg.startsWith('--out='))?.slice(6)??'src/assets/vector', work='work/assets';
const reportFile=process.argv.find(arg=>arg.startsWith('--report='))?.slice(9);
const noCatalog=process.argv.includes('--no-catalog');
if(reportFile&&!process.argv.slice(2).some(arg=>!arg.startsWith('--')))throw Error('--report requires one asset ID');
fs.mkdirSync(out,{recursive:true}); fs.mkdirSync(work,{recursive:true});
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
    if(match[1]==='rect')d=svgRectPath(a);
    commands.push({d,fill:a.fill==='black'?'ink':a.fill==='none'?'none':'base',stroke:a.stroke!=='none',width:+(a['stroke-width']??5)});
  }
  return {commands,sourceWidth:+root.width,sourceHeight:+root.height};
}
const pending=process.argv.includes('--pending');
const target=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
if(inspectionDirectory && (!target || pending))throw new Error('Inspection requires one asset ID and cannot use --pending');
if(target&&!assets.some(asset=>asset.id===target))throw Error(`Unknown sticker: ${target}`);
for(const arg of process.argv.slice(2).filter(arg=>arg.startsWith('--')))if(arg!=='--pending'&&!arg.startsWith('--inspect=')&&!arg.startsWith('--inspect-threshold=')&&!arg.startsWith('--out=')&&!arg.startsWith('--report=')&&arg!=='--no-catalog')throw Error(`Unknown option: ${arg}`);
for(const asset of assets) {
  const {id,width,height}=asset;
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid asset ID');
  if(target && id!==target) continue;
  if(pending && fs.existsSync(`${out}/${id}.svg`)) continue;
  const base=`${work}/${id}`, source=asset.source;
  if(inspectionDirectory && (asset.mode==='svg'||asset.inkSource))throw new Error('Stage inspection currently supports raster sources only');
  const inspection=inspectionDirectory?stickerInspection(inspectionDirectory,asset,{threshold:inspectionThreshold}):undefined;
  let commands,matrix,inkSvg,cleanupReport;
  if(asset.mode==='svg'||asset.inkSource) {
    const original=fs.readFileSync(asset.inkSource??source,'utf8').trim(), parsed=svgCommands(original);
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
  const originalInkSvg=inkSvg;
  const preview=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="white"/>${inkSvg}${barriers}</svg>`;
  fs.writeFileSync(`${base}-render.svg`,preview);
  let gray=run('-background','white',`${base}-render.svg`,...(asset.analysisGapClosure?['-morphology','Open',`Disk:${asset.analysisGapClosure*scale}`]:[]),'-alpha','remove','-colorspace','Gray','-depth','8','gray:-');
  inspection?.analysis(`${base}-render.svg`,gray,w,h,scale,lookupScale);
  if(gray.length!==count)throw new Error(`${id}: raster dimensions`);
  let {labels,queue,areas,regionCount}=discoverRegions(gray,w,h,asset,scale);
  const minimumArea=asset.minimumRegionAreaPixels??defaultMinimumRegionAreaPixels;
  if(minimumArea>0){
    const rounds=[];
    for(let pass=0;pass<4;pass++){
      const authored=commands.some(command=>command.fill!=='ink'||command.stroke);
      let cleanupCommands=commands,cleanupMatrix=matrix;
      if(authored&&areas.some(area=>area*(a4FitScale(width,height)/scale)**2<minimumArea)){
        // Derive pocket contours at analysis resolution, but keep the authored ink intact.
        fs.writeFileSync(`${base}-cleanup.gray`,gray);
        run('-size',`${w}x${h}`,'-depth','8',`gray:${base}-cleanup.gray`,'-threshold','50%',`${base}-cleanup.pbm`);
        trace(`${base}-cleanup.pbm`,`${base}-cleanup.svg`,1.2,.015*scale,0);
        cleanupCommands=paths(fs.readFileSync(`${base}-cleanup.svg`,'utf8')).map(d=>({d,fill:'ink',stroke:false,width:0}));
        cleanupMatrix=[.1/scale,0,0,-.1/scale,0,height];
      }
      const cleaned=cleanInkComponents({commands:cleanupCommands,matrix:cleanupMatrix,width,height,scale,w,h,labels,areas,cutoff:minimumArea});
      cleanupReport=cleaned.report;
      fs.writeFileSync(`${base}-component-cleanup.json`,JSON.stringify(cleanupReport,null,2));
      if(cleaned.d){
        if(authored){
          const scope=new paper.PaperScope();scope.setup(new scope.Size(100,100));
          try{
            const patches=new scope.CompoundPath({pathData:cleaned.addedD,insert:false});
            patches.transform(new scope.Matrix(...matrix).inverted().append(new scope.Matrix(...cleanupMatrix)));
            const d=patches.pathData;
            commands=[...commands,{d,fill:'ink',stroke:false,width:0}];
            inkSvg+=`<g fill="black" transform="matrix(${matrix.join(' ')})"><path d="${d}"/></g>`;
            cleanupReport.method='curve-filled pockets with original authored ink preserved';
          }finally{scope.remove();}
        }else{
          commands=[{d:cleaned.d,fill:'ink',stroke:false,width:0}];
          inkSvg=`<g fill="black" transform="matrix(${matrix.join(' ')})"><path d="${cleaned.d}"/></g>`;
        }
        fs.writeFileSync(`${base}-render.svg`,preview.replace(originalInkSvg,inkSvg));
        gray=run('-background','white',`${base}-render.svg`,'-alpha','remove','-colorspace','Gray','-depth','8','gray:-');
        ({labels,queue,areas,regionCount}=discoverRegions(gray,w,h,asset,scale));
        cleanupReport.finalRegions=regionCount;
        cleanupReport.remainingSmallComponents=areas.filter(area=>area*cleanupReport.analysisPixelArea<minimumArea).length;
        fs.writeFileSync(`${base}-component-cleanup.json`,JSON.stringify(cleanupReport,null,2));
        inspection?.analysis(`${base}-render.svg`,gray,w,h,scale,lookupScale);
      }
      cleanupReport.finalRegions=regionCount;
      cleanupReport.remainingSmallComponents=areas.filter(area=>area*cleanupReport.analysisPixelArea<minimumArea).length;
      rounds.push(cleanupReport);
      if(!cleanupReport.remainingSmallComponents||!cleaned.d)break;
    }
    cleanupReport={...rounds.at(-1),beforeRegions:rounds[0].beforeRegions,
      removed:rounds.reduce((sum,round)=>sum+round.removed,0),
      exactHoles:rounds.reduce((sum,round)=>sum+round.exactHoles,0),
      curveCaps:rounds.reduce((sum,round)=>sum+round.curveCaps,0),rounds};
    fs.writeFileSync(`${base}-component-cleanup.json`,JSON.stringify(cleanupReport,null,2));
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
  let svg=regionSvg({width,height,bounds,regionCount,scale,lookupScale,labels,commands,matrix});
  if(inspection){inspection.finish(svg);console.log(`${id}: captured current pipeline in ${inspectionDirectory}`);continue;}
  fs.writeFileSync(`${out}/${id}.svg`,svg);
  if(reportFile){fs.mkdirSync(path.dirname(reportFile),{recursive:true});fs.writeFileSync(reportFile,JSON.stringify({id,source:asset.source,sourceMode:asset.mode??'raster',minimumAreaPixels:minimumArea,analysisScale:scale,regionCount,bytes:Buffer.byteLength(svg),cleanup:cleanupReport},null,2)+'\n');}
  console.log(`${id}: ${regionCount} regions`);
}
// Refresh the searchable authoring library and the UI display metadata.
if(!inspectionDirectory&&!noCatalog)await import('./build-asset-catalog.mjs');
