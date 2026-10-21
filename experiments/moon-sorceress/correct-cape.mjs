// Local vector retouch from the unmodified historical cleaned ink.
// Preserve the entire front shoulder strand; replace only the rear cape curls.
import fs from 'node:fs';import paper from 'paper';
const svg=fs.readFileSync('experiments/moon-sorceress/curve-unioned-cleanup.svg','utf8'),group=svg.slice(svg.indexOf('<g id="ink"'));
const scope=new paper.PaperScope();scope.setup(new scope.Size(340,480));
let ink=new scope.CompoundPath({pathData:/\bd="([^"]+)"/.exec(group)[1],insert:false});ink.transform(new scope.Matrix(.../transform="matrix\(([^)]+)\)/.exec(group)[1].split(/[ ,]+/).map(Number)));
const reference=ink.clone({insert:false});
function hole(point){return ink.children.filter(c=>c.contains(new scope.Point(...point))).sort((a,b)=>Math.abs(a.area)-Math.abs(b.area))[0];}
// Copy the short original Bezier arc, discarding unused endpoint handles.
function section(path,a,b){let p=path.clone({insert:false});const start=path.getNearestLocation(new scope.Point(...a)).point,end=path.getNearestLocation(new scope.Point(...b)).point;p.splitAt(p.getNearestLocation(start));const rest=p.splitAt(p.getNearestLocation(end));if(p.length>rest.length){p=rest;p.reverse();}p.firstSegment.handleIn=new scope.Point(0,0);p.lastSegment.handleOut=new scope.Point(0,0);return p;}
function follow(path,arc){for(const c of arc.curves)path.cubicCurveTo(c.point1.add(c.handle1),c.point2.add(c.handle2),c.point2);}
function ribbon(arc,dx){const p=arc.clone({insert:false}),other=arc.clone({insert:false});other.translate(new scope.Point(dx,0));other.reverse();p.lineTo(other.firstSegment.point);follow(p,other);p.closePath();return p;}
const lh=hole([125,180]),rh=hole([144,195]);
const left=section(lh,[131,163.5],[123,216]);if(left.firstSegment.point.y>left.lastSegment.point.y)left.reverse();
const right=section(rh,[156,179],[131.5,216]);if(right.firstSegment.point.y>right.lastSegment.point.y)right.reverse();
// Avoid coincident erase edges, then rebuild borders along the original arcs.
const ml=left.clone({insert:false}),mr=right.clone({insert:false});ml.translate([-.1,0]);mr.translate([.1,0]);
const clear=new scope.Path({insert:false});clear.moveTo(ml.firstSegment.point);clear.cubicCurveTo([134.5,168.5],[140,172],[148,171.3]);clear.lineTo([151,178]);clear.lineTo(mr.firstSegment.point);follow(clear,mr);clear.lineTo(ml.lastSegment.point);const reverse=ml.clone({insert:false});reverse.reverse();follow(clear,reverse);clear.closePath();
// Overlap old and new borders so native paths and raster analysis both close.
function extended(path,arc){const a=path.getNearestLocation(arc.firstSegment.point).offset,b=path.getNearestLocation(arc.lastSegment.point).offset,len=path.length,dir=(b-a+len)%len<len/2?1:-1;const point=offset=>{const p=path.getPointAt((offset+len)%len);return[p.x,p.y];};return section(path,point(a-dir*.6),point(b+dir*.6));}
const lr=ribbon(extended(lh,left),1.1),rr=ribbon(extended(rh,right),-1.1);
// Remove only the rear-lock spur below the retained front curl.
const tip=new scope.Path({pathData:'M139 168.7C140.2 169.25 141.5 169.7 143 169.95L143 173H139Z',insert:false});
ink=ink.subtract(clear.unite(tip,{insert:false}),{insert:false});ink=ink.unite(lr,{insert:false});ink=ink.unite(rr,{insert:false});

ink=ink.subtract(new scope.Path.Rectangle({rectangle:[136.4,153.5,1.4,6.6],insert:false}),{insert:false});
// Keep the native belt/skirt junction intact, including its original line width.
ink=ink.unite(reference.intersect(new scope.Path.Rectangle({rectangle:[149,176,10,8.5],insert:false}),{insert:false}),{insert:false});
const fold=new scope.Path({pathData:'M138 184C134.3 191.5 130.7 201.2 127.6 208.5C130.1 200.4 133.7 190.1 138 184Z',insert:false});ink=ink.unite(fold,{insert:false});
const output=`<svg xmlns="http://www.w3.org/2000/svg" width="340" height="480" viewBox="0 0 340 480"><g fill="black" stroke="none"><path d="${ink.pathData}"/></g></svg>`;
fs.writeFileSync('art/source/fantasy/moon-sorceress.svg',output);
scope.remove();
