import paper from 'paper';

/** Close small white pockets in the actual Bezier ink, never by overlaying a pixel patch. */
export function cleanInkComponents({commands,matrix,width,height,scale,w,h,labels,areas,cutoff=10.2}){
  if(!(cutoff>0)||!Number.isFinite(cutoff))throw Error('Invalid minimum component area');
  const aw=210/25.4*150,ah=297/25.4*150;
  const fit=Math.max(Math.min(aw/width,ah/height),Math.min(ah/width,aw/height));
  const pixelArea=(fit/scale)**2;
  const ids=new Set(areas.flatMap((area,index)=>area*pixelArea<cutoff?[index+1]:[]));
  if(!ids.size)return{report:{method:'curve-unioned components',removed:0,pockets:[]}};
  if(commands.some(c=>c.fill!=='ink'||c.stroke))throw Error('Curve component cleanup currently requires traced filled ink');
  const pockets=new Map([...ids].map(id=>[id,{id,left:w,top:h,right:0,bottom:0,points:[]} ]));
  for(let i=0;i<labels.length;i++){
    const pocket=pockets.get(labels[i]);if(!pocket)continue;
    const x=i%w,y=Math.floor(i/w);
    pocket.left=Math.min(pocket.left,x);pocket.right=Math.max(pocket.right,x+1);
    pocket.top=Math.min(pocket.top,y);pocket.bottom=Math.max(pocket.bottom,y+1);
    pocket.points.push([x+.5,y+.5]);
  }
  const scope=new paper.PaperScope();scope.setup(new scope.Size(100,100));
  try{
    let ink=new scope.CompoundPath({pathData:commands.map(c=>c.d).join(''),insert:false}).resolveCrossings().reorient(true,true);
    const [a,b,c,d,e,f]=matrix,det=a*d-b*c;
    if(!det)throw Error('Invalid ink matrix');
    const inverse=(x,y)=>new scope.Point((d*(x-e)-c*(y-f))/det,(-b*(x-e)+a*(y-f))/det);
    const areaScale=Math.abs(det)*fit**2;
    const children=ink.children??[ink],originalBlackComponents=children.filter(path=>path.area>0).length,holes=children.filter(path=>path.area<0).sort((a,b)=>Math.abs(a.area)-Math.abs(b.area));
    const originalHoles=holes.map(path=>({path:path.clone({insert:false}),area:Math.abs(path.area)*areaScale,removed:Math.abs(path.area)*areaScale<cutoff}));
    const exact=holes.filter(path=>Math.abs(path.area)*areaScale<cutoff);
    for(const hole of exact)hole.remove();
    const report={method:'curve-unioned components',analysisPixelArea:pixelArea,maximumAreaPixels:cutoff,beforeRegions:areas.length,removed:0,exactHoles:exact.length,curveCaps:0,unresolved:[],pockets:[]};
    for(const pocket of pockets.values()){
      let parent;
      for(const point of pocket.points){const p=inverse(point[0]/scale,point[1]/scale);parent=originalHoles.find(hole=>hole.path.contains(p));if(parent)break;}
      if(parent?.removed){report.removed++;report.pockets.push({id:pocket.id,method:'exact contour removal',areaPixels:areas[pocket.id-1]*pixelArea});continue;}
      // Include the edge's antialiased coverage. Intersect with the original
      // white contour so its curved sides survive; only a narrow connection is capped.
      const margin=1/scale;
      const corners=[[pocket.left/scale-margin,pocket.top/scale-margin],[pocket.right/scale+margin,pocket.top/scale-margin],
        [pocket.right/scale+margin,pocket.bottom/scale+margin],[pocket.left/scale-margin,pocket.bottom/scale+margin]].map(([x,y])=>inverse(x,y));
      const box=new scope.Path({segments:corners,closed:true,insert:false});
      const patch=parent?box.intersect(parent.path,{insert:false}):new scope.Path.Ellipse({rectangle:box.bounds,insert:false});
      const patchArea=Math.abs(patch.area)*areaScale;
      if(!patchArea||patchArea>cutoff*4){report.unresolved.push({id:pocket.id,patchArea});continue;}
      const next=ink.unite(patch,{insert:false});ink.remove();patch.remove();box.remove();ink=next;
      report.removed++;report.curveCaps++;report.pockets.push({id:pocket.id,method:parent?'curve intersection and union':'curved exterior union',areaPixels:areas[pocket.id-1]*pixelArea,patchAreaPixels:patchArea});
    }
    ink=ink.resolveCrossings().reorient(true,true);
    const slivers=(ink.children??[ink]).filter(path=>path.area<0&&Math.abs(path.area)*areaScale<cutoff);
    for(const sliver of slivers)sliver.remove();
    report.additionalExactHoles=slivers.length;
    report.afterContours=(ink.children??[ink]).length;
    report.blackComponents=(ink.children??[ink]).filter(path=>path.area>0).length;
    if(report.blackComponents>originalBlackComponents)throw Error('Ink cleanup introduced a detached black component');
    return{d:ink.pathData,report};
  }finally{scope.remove();}
}
