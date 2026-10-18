// Unified offline vector/region authoring pipeline. No app tests or builds.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const assets = JSON.parse(fs.readFileSync('art/stickers.json','utf8'));
const out='src/assets/vector', work='work/hybrid';
fs.mkdirSync(out,{recursive:true}); fs.mkdirSync(work,{recursive:true});
fs.mkdirSync('art/source/shapes',{recursive:true});
const shape = (name, body) => fs.writeFileSync(`art/source/shapes/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="280"><g fill="white" stroke="black" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`);
shape('circle','<circle cx="110" cy="140" r="80"/>');
shape('square','<rect x="30" y="60" width="160" height="160"/>');
shape('triangle','<path d="M110 55L25 215H195Z"/>');
shape('tree','<rect x="88" y="140" width="44" height="120" rx="8"/><rect x="15" y="30" width="190" height="160" rx="65"/>');
shape('flower', '<rect x="104" y="140" width="12" height="120" rx="4"/>' + Array.from({length:5},(_,i)=>{const a=i*Math.PI*2/5-Math.PI/2;return `<circle cx="${110+Math.cos(a)*42}" cy="${140+Math.sin(a)*42}" r="32"/>`;}).join('')+'<circle cx="110" cy="140" r="26"/>');
const run=(...args)=>execFileSync('magick',args,{maxBuffer:128e6});
const trace=(input, output, alpha=1.2, tolerance=.5, speckle=2)=>execFileSync(process.env.POTRACE_PATH??'work/tools/potrace/potrace-1.16.win64/potrace.exe',[input,'-s','-a',`${alpha}`,'-O',`${tolerance}`,'-t',`${speckle}`,'-o',output]);
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const paths=svg=>[...svg.matchAll(/<path\s+d="([^"]+)"/g)].map(m=>m[1]);
const pack=bits=>{const b=Buffer.alloc(Math.ceil(bits.length/8));bits.forEach((v,i)=>{if(v)b[i>>3]|=1<<(i&7);});return b.toString('base64');};
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
const report=process.argv[2] && fs.existsSync('art/conversion-report.json') ? JSON.parse(fs.readFileSync('art/conversion-report.json','utf8')).filter(item=>item.id!==process.argv[2]) : [];
for(const asset of assets) {
  const {id,width,height}=asset;
  if(process.argv[2] && id!==process.argv[2]) continue;
  const base=`${work}/${id}`, source=asset.source;
  let commands,matrix,inkSvg;
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
    const histogram=new Uint32Array(Math.ceil(Math.min(sw,sh)*.04)+1);
    const record=n=>{if(n>=3&&n<histogram.length)histogram[n]++;};
    for(let y=0;y<sh;y++){let n=0;for(let x=0;x<=sw;x++){if(x<sw&&gray[y*sw+x]<128)n++;else{record(n);n=0;}}}
    for(let x=0;x<sw;x++){let n=0;for(let y=0;y<=sh;y++){if(y<sh&&gray[y*sw+x]<128)n++;else{record(n);n=0;}}}
    let stroke=3;for(let n=4;n<histogram.length;n++)if(histogram[n]>histogram[stroke])stroke=n;
    run(`${base}-gray.png`,'-blur',`0x${stroke*.04}`,'-threshold','50%',`${base}.pbm`);
    trace(`${base}.pbm`,`${base}-ink.svg`,1.2,.5*stroke/12,Math.max(2,Math.round(8*(stroke/12)**2)));
    commands=paths(fs.readFileSync(`${base}-ink.svg`,'utf8')).map(d=>({d,fill:'ink',stroke:false,width:0}));
    matrix=[.1*width/sw,0,0,-.1*height/sh,0,height];
    inkSvg=`<g fill="black" transform="matrix(${matrix.join(' ')})">${commands.map(c=>`<path d="${c.d}"/>`).join('')}</g>`;
  }
  // Four samples per logical unit preserve fine gaps and antlers. Large assets
  // keep a bounded analysis footprint instead of allocating huge region maps.
  const scale=width*height<=300000?4:2,w=width*scale,h=height*scale,count=w*h;
  // Hidden closures keep fill regions enclosed without drawing boxed scenery edges.
  const barriers=asset.horizon ? `<g transform="matrix(${matrix.join(' ')})" fill="none" stroke="black" stroke-width="5">${commands.filter(c=>c.fill==='base').map(c=>`<path d="${c.d}"/>`).join('')}</g>` : '';
  const preview=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="white"/>${inkSvg}${barriers}</svg>`;
  fs.writeFileSync(`${base}-render.svg`,preview);
  const gray=run('-background','white',`${base}-render.svg`,'-alpha','remove','-colorspace','Gray','-depth','8','gray:-');
  if(gray.length!==count)throw new Error(`${id}: raster dimensions`);
  const labels=new Int32Array(count);labels.fill(-1);for(let i=0;i<count;i++)if(gray[i]<128)labels[i]=-2;
  const queue=new Int32Array(count),areas=[];
  function flood(seed,label){let head=0,tail=1;queue[0]=seed;labels[seed]=label;while(head<tail){const i=queue[head++],x=i%w;const visit=n=>{if(labels[n]===-1){labels[n]=label;queue[tail++]=n;}};if(x)visit(i-1);if(x+1<w)visit(i+1);if(i>=w)visit(i-w);if(i+w<count)visit(i+w);}return tail;}
  for(let x=0;x<w;x++)for(const i of [x,(h-1)*w+x])if(labels[i]===-1)flood(i,0);
  for(let y=0;y<h;y++)for(const i of [y*w,y*w+w-1])if(labels[i]===-1)flood(i,0);
  // Authored seeds mark enclosed negative space, not paintable sticker regions.
  // Keep them in logical asset coordinates so source rebuilds remain reproducible.
  for(const [x,y] of asset.cutouts??[]) {
    const px=Math.floor(x*scale),py=Math.floor(y*scale),index=py*w+px;
    if(px<0||py<0||px>=w||py>=h||labels[index]!==-1)
      throw new Error(`${id}: cutout (${x}, ${y}) must lie inside an enclosed white region`);
    flood(index,0);
  }
  let regionCount=0;for(let i=0;i<count;i++)if(labels[i]===-1)areas.push(flood(i,++regionCount));
  // No regions is a real conversion failure, never silently emit an empty sticker.
  if(!regionCount)throw new Error(`${id}: no enclosed coloring regions`);
  const silhouette=new Uint8Array(count),hit=silhouette.slice();
  for(let i=0;i<count;i++)hit[i]=labels[i]!==0?1:0;
  let left=w,top=h,right=0,bottom=0;
  for(let i=0;i<count;i++)if(hit[i]){const x=i%w,y=Math.floor(i/w);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  const bounds={left:left/scale,top:top/scale,right:right/scale,bottom:bottom/scale};
  // Extend categorical labels under the ink with nearest 4-connected regions.
  let head=0,tail=0;for(let i=0;i<count;i++){if(labels[i]<0)continue;const x=i%w;if((x&&labels[i-1]===-2)||(x+1<w&&labels[i+1]===-2)||(i>=w&&labels[i-w]===-2)||(i+w<count&&labels[i+w]===-2))queue[tail++]=i;}
  while(head<tail){const i=queue[head++],x=i%w;const visit=n=>{if(labels[n]===-2){labels[n]=labels[i];queue[tail++]=n;}};if(x)visit(i-1);if(x+1<w)visit(i+1);if(i>=w)visit(i-w);if(i+w<count)visit(i+w);}
  // Place the paint backing at the ink's interior midpoint. Unlike a fixed
  // erosion, this follows local stroke thickness and retains narrow interiors.
  // Standalone ink specks need no white backing of their own.
  for(let i=0;i<count;i++)silhouette[i]=labels[i]>0?1:0;
  const raw=Buffer.from(silhouette.map(v=>v?255:0));fs.writeFileSync(`${base}-shape.gray`,raw);
  run('-size',`${w}x${h}`,'-depth','8',`${base}-shape.gray`,'-negate',`${base}-shape.pbm`);
  trace(`${base}-shape.pbm`,`${base}-shape.svg`,1,.05*scale,2);
  const silhouettePaths=paths(fs.readFileSync(`${base}-shape.svg`,'utf8'));
  const silhouetteMatrix=[.1/scale,0,0,-.1/scale,0,height];
  const runs=[];for(let i=0;i<count;){const start=i,label=labels[i++];while(i<count&&labels[i]===label)i++;runs.push(i-start,label);}
  const packed=Buffer.alloc(runs.length*4);runs.forEach((n,i)=>packed.writeUInt32LE(n,i*4));
  fs.writeFileSync(`${out}/${id}.json`,JSON.stringify({width,height,bounds,regionCount,regionScale:scale,regionRuns:packed.toString('base64'),hitCoverage:pack(hit),commands,matrix,silhouettePaths,silhouetteMatrix}));
  const silhouetteSvg=`<g transform="matrix(${silhouetteMatrix.join(' ')})" fill="white">${silhouettePaths.map(d=>`<path d="${d}"/>`).join('')}</g>`;
  fs.writeFileSync(`${out}/${id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${silhouetteSvg}${inkSvg}</svg>`);
  run('-background','white',`${out}/${id}.svg`,'-resize','180x170','-gravity','center','-extent','200x205','-font','Arial','-pointsize','12','-gravity','south','-annotate','+0+5',id,`${base}-preview.png`);
  report.push({id,width,height,regionCount,tinyRegions:areas.filter(a=>a<16).length,mode:asset.mode??'potrace-light'});
  fs.writeFileSync('art/conversion-report.json',JSON.stringify(report,null,2));
  console.log(`${id}: ${regionCount} regions`);
}
if(!process.argv[2]){
  fs.writeFileSync(`${out}/catalog.json`,JSON.stringify(Object.fromEntries(assets.map(a=>[a.id,{width:a.width,height:a.height,...(a.horizon?{horizon:true,horizonStart:a.horizonStart??.58}:{})}]))));
  fs.writeFileSync('src/editor/stickerKinds.ts',`// Generated from art/stickers.json by scripts/build-stickers.mjs.\nexport type StickerKind = ${assets.map(a=>JSON.stringify(a.id)).join(' | ')};\n`);
  for(let i=0;i<assets.length;i+=12)run('montage',...assets.slice(i,i+12).map(a=>`${work}/${a.id}-preview.png`),'-tile','4x3','-geometry','+6+6','-background','#eeeeee',`${work}/sheet-${i/12+1}.png`);
}
