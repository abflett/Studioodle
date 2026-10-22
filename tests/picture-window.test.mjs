import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
let server, PictureWindow;
before(async()=>{server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});({PictureWindow}=await server.ssrLoadModule('/src/app/pictureWindow.ts'));});
after(async()=>{await server?.close();});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const summaries=Array.from({length:120},(_,i)=>({id:String(i),updatedAt:i,title:'Picture '+i}));
const picture=summary=>({...summary,document:{surfaces:[]}});
const ids=window=>[...Reflect.get(window,'cache').keys()];

test('prefetches current, next, back, next-next, back-back and retains only five',async()=>{
 const calls=[],window=new PictureWindow(async id=>{calls.push(id);return picture(summaries[Number(id)]);});
 window.select(summaries,0);await tick();
 assert.deepEqual(calls,['0','1','119','2','118']);assert.equal(ids(window).length,5);
 window.select(summaries,60);await tick();
 assert.deepEqual(calls.slice(5),['60','61','59','62','58']);assert.deepEqual(ids(window),calls.slice(5));
 window.select(summaries,61);await tick();assert.deepEqual(calls.slice(10),['63']);assert.equal(ids(window).length,5);
 window.dispose();assert.deepEqual(ids(window),[]);
});

test('navigation preempts stale reads and ignores late completions',async()=>{
 const calls=[],gates=new Map(),signals=new Map();
 const window=new PictureWindow((id,signal)=>{calls.push(id);signals.set(id,signal);if(id==='0'||id==='60')return new Promise(resolve=>gates.set(id,resolve));return Promise.resolve(picture(summaries[Number(id)]));});
 window.select(summaries,0);window.select(summaries,60);
 assert.deepEqual(calls,['0','60']);assert.equal(signals.get('0').aborted,true);
 gates.get('0')(picture(summaries[0]));await tick();assert.equal(window.getSnapshot().picture,undefined);assert.equal(ids(window).includes('0'),false);
 gates.get('60')(picture(summaries[60]));await tick();assert.equal(window.getSnapshot().picture.id,'60');assert.equal(ids(window).length,5);
 window.dispose();
});

test('failed prefetches do not block neighbors; current errors can be retried',async()=>{
 let fails=true;const calls=[];
 const window=new PictureWindow(async id=>{calls.push(id);if(id==='1'&&fails)throw Error('Unavailable');return picture(summaries[Number(id)]);});
 window.select(summaries,0);await tick();assert.equal(window.getSnapshot().error,false);assert.deepEqual(calls,['0','1','119','2','118']);
 window.select(summaries,1);await tick();assert.equal(window.getSnapshot().error,true);
 fails=false;window.select(summaries,1);await tick();assert.equal(window.getSnapshot().picture.id,'1');window.dispose();
});

test('revision changes discard old data and small libraries never load duplicates',async()=>{
 let revision=0;const calls=[];
 const window=new PictureWindow(async id=>{calls.push(id);return picture({...summaries[0],updatedAt:revision});});
 window.select([summaries[0]],0);await tick();assert.deepEqual(calls,['0']);
 revision=5;window.select([{...summaries[0],updatedAt:5}],0);await tick();assert.equal(window.getSnapshot().picture.updatedAt,5);assert.equal(calls.length,2);
 window.invalidate('0');window.select([{...summaries[0],updatedAt:5}],0);await tick();assert.equal(calls.length,3);
 window.select([],0);await tick();assert.equal(ids(window).length,0);window.dispose();
});
