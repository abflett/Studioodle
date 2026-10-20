// One-off native-vector art correction. The historical cleanup SVG is kept unchanged.
import fs from 'node:fs';
import paper from 'paper';
const svg=fs.readFileSync('experiments/moon-sorceress/curve-unioned-cleanup.svg','utf8');
const group=svg.slice(svg.indexOf('<g id="ink"'));
const d=/\bd="([^"]+)"/.exec(group)[1];
const matrix=/transform="matrix\(([^)]+)\)/.exec(group)[1].split(/[ ,]+/).map(Number);
const scope=new paper.PaperScope();scope.setup(new scope.Size(340,480));
let ink=new scope.CompoundPath({pathData:d,insert:false});ink.transform(new scope.Matrix(...matrix));
const clear=new scope.Path({pathData:'M135.8 150L141.5 146.5L146 150L153.5 158.5L156.5 165Q158 169 155.5 173L147 181.5L140.5 193L131.7 209L128 216L123.5 216L124.1 209L125.7 199L127.4 190L130.4 180L132.5 169L134.2 158Z',insert:false});
ink=ink.subtract(clear,{insert:false});
ink=ink.resolveCrossings().reorient(true,true);
for(const component of [...(ink.children??[])])if(component.area>0&&component.bounds.left>123&&component.bounds.right<158&&component.bounds.top>146&&component.bounds.bottom<216)component.remove();
const fold=new scope.Path({pathData:'M139.5 183C135.7 190.3 131.5 201.5 127.8 208.8C131.1 200.5 135 188.4 139.5 183Z',insert:false});
ink=ink.unite(fold,{insert:false});
const output=`<svg xmlns="http://www.w3.org/2000/svg" width="340" height="480" viewBox="0 0 340 480"><g fill="black" stroke="none"><path d="${ink.pathData}"/></g></svg>`;
fs.writeFileSync('art/source/fantasy/moon-sorceress.svg',output);
scope.remove();
