import paper from 'paper';

const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
export function reviewRegions(svg,scope){
 const group=/<g id="regions"[^>]*>([\s\S]*?)<\/g>/.exec(svg)?.[1]??'';
 return [...group.matchAll(/<path\b[^>]*\/>/g)].map(match=>{
  const a=attributes(match[0]),geometry=new scope.CompoundPath({pathData:a.d,insert:false});
  if(a.transform)geometry.transform(new scope.Matrix(...a.transform.replace(/^matrix\(|\)$/g,'').trim().split(/[ ,]+/).map(Number)));
  return{id:Number(a.id.replace('region-','')),geometry,area:Math.abs(geometry.area)};
 });
}

/** Plan only explicit, local removals. Never infer missing line art from marker points. */
export function planAssetRepairs(asset,svg,review){
 const scope=new paper.PaperScope();scope.setup(new scope.Size(asset.width,asset.height));
 try{
  const regions=reviewRegions(svg,scope);
  const totalArea=regions.reduce((sum,region)=>sum+region.area,0),cutouts=[],operations=[];
  for(const marker of review.markers){
   const point=new scope.Point(marker.x,marker.y);
   const hit=regions.find(region=>region.geometry.contains(point));
   const operation={markerId:marker.id,kind:marker.kind,x:marker.x,y:marker.y,regionId:marker.regionId,note:marker.note,status:'deferred',effort:marker.kind==='remove-region'?'low':'medium',reason:''};
   if(marker.kind!=='remove-region'){
    operation.effort=review.markers.filter(m=>m.kind==='add-region').length>3?'high':'medium';
    operation.reason='Requires locating and interpreting source line breaks; marker coordinates alone do not define a safe closure.';
   }else if(!marker.regionId&&!hit){operation.status='already-transparent';operation.reason='No paint region at the marked point; retain as a negative-space constraint.';}
   else if(!hit||hit.id!==marker.regionId){operation.reason='Point does not unambiguously match the recorded region; inspect before editing.';}
   else if(hit.area/totalArea>.35){operation.effort='medium';operation.reason='Marked region exceeds 35% of paintable area; inspect to avoid removing a main body region.';}
   else if(review.markers.some(other=>other.kind==='add-region'&&hit.geometry.contains(new scope.Point(other.x,other.y)))){operation.effort='medium';operation.reason='Same region also contains an add/fill request; resolve intent visually.';}
   else{
    operation.status='planned';operation.reason='Explicit existing region; add a reproducible negative-space seed without altering ink.';
    if(!cutouts.some(cutout=>cutout.regionId===hit.id))cutouts.push({regionId:hit.id,point:[marker.x,marker.y]});
   }
   operations.push(operation);
  }
  return{assetId:asset.id,source:asset.source,notes:review.notes,cutouts,operations};
 }finally{scope.remove();}
}
