/** Authoring-only connected white-component discovery; no paint raster is shipped. */
export function discoverRegions(gray,w,h,asset,scale){
  const count=w*h,{id}=asset;
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
  return {labels,queue,areas,regionCount};
}
