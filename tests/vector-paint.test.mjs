import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createServer } from 'vite';
let server,geometry,VectorPaint,valid;
before(async()=>{
 server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 geometry=await server.ssrLoadModule('/src/editor/vectorPaintGeometry.ts');
 ({VectorPaint}=await server.ssrLoadModule('/src/editor/VectorPaint.ts'));
 ({isSavedPicture:valid}=await server.ssrLoadModule('/src/editor/pictureValidation.ts'));
});
after(async()=>{await server?.close();});
const count=g=>g.flat(2).length;
test('a thousand repeated strokes compact to one stable color blob',()=>{
 const shape=geometry.brushBlob([5,5],[15,15],2);
 const result=geometry.compactRegion({id:1,base:0xffffff,blobs:Array.from({length:1000},()=>({color:0x773399,geometry:shape}))});
 assert.equal(result.blobs.length,1);
 assert.equal(count(result.blobs[0].geometry),count(shape));
 assert.ok(geometry.containsGeometry(result.blobs[0].geometry,[10,10]));
});
test('different colors remove covered paint instead of retaining hidden layers',()=>{
 const a=geometry.brushBlob([5,5],[15,5],3),b=geometry.brushBlob([10,0],[10,10],2);
 const result=geometry.compactRegion({id:1,base:0xffffff,blobs:[{color:1,geometry:a},{color:2,geometry:b}]});
 assert.equal(result.blobs.length,2);
 assert.equal(geometry.containsGeometry(result.blobs.find(b=>b.color===1).geometry,[10,5]),false);
 assert.equal(geometry.containsGeometry(result.blobs.find(b=>b.color===2).geometry,[10,5]),true);
 const erased=geometry.compactRegion({...result,blobs:[...result.blobs,{color:0xffffff,geometry:geometry.brushBlob([10,5],[10,5],50)}]});
 assert.equal(erased.blobs.length,0);
});
test('input nodes use the fine grid and saved snapshots survive later merging',async()=>{
 const shape=geometry.brushBlob([1.123,2.345],[8.456,9.789],2);
 for(const point of shape.flat(2))for(const n of point)assert.equal(n*64,Math.round(n*64));
 const state=new VectorPaint();state.fill(1,0xff00ff);
 const definition={regions:[{id:1,bounds:[0,0,30,30]}]};
 state.brush(definition,[5,5],[10,10],2,0x00ffff,false);
 const snapshot=state.serialize();
 state.brush(definition,[5,5],[10,10],2,0x00ffff,false);
 await state.settled();
 assert.equal(snapshot.regions[0].blobs.length,1);
 assert.equal(state.serialize().regions[0].blobs.length,1);
 state.fill(1,0x112233,[6,6]);await state.settled();
 assert.equal(state.serialize().regions[0].blobs[0].color,0x112233);
 assert.equal(snapshot.regions[0].blobs[0].color,0x00ffff);
});
test('saved vector paint validates and cannot be mixed with raster runs',()=>{
 const shape=geometry.brushBlob([1,1],[2,2],1);
 const picture={version:4,id:'v',title:'v',format:'landscape',size:{width:100,height:70},background:'#ffffff',leafColor:0,updatedAt:1,
 document:{version:4,width:100,height:70,surfaces:[{id:'page',kind:'canvas',x:0,y:0,color:0xffffff,paint:[]},
 {id:'moon',kind:'fantasy-moon-sorceress',x:50,y:35,color:0,paint:[],vectorPaint:{version:1,regions:[{id:1,base:0xffffff,blobs:[{color:2,geometry:shape}]}]}}]}};
 assert.equal(valid(picture),true);
 picture.version=3;picture.document.version=3;assert.equal(valid(picture),false);
 picture.version=4;picture.document.version=4;
 picture.document.surfaces[1].paint=[[0,1,0]];assert.equal(valid(picture),false);
 picture.document.surfaces[1].paint=[];
 picture.document.surfaces[1].vectorPaint.regions[0].blobs[0].geometry[0][0][0][0]=NaN;
 assert.equal(valid(picture),false);
});
