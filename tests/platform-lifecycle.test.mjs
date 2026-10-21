import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, guardDesktopClose, computePaint;
before(async () => {
 server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},plugins:[{
  name:'native-window-port', enforce:'pre',
  transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/platform/desktop.ts'))return code.replaceAll('@tauri-apps/api/window','virtual:native-window').replaceAll('@tauri-apps/api/core','virtual:native-core');},
  resolveId(source){if(source==='virtual:native-window')return '\0native-window';if(source==='virtual:native-core')return '\0native-core';},
  load(id){if(id==='\0native-window')return 'export const getCurrentWindow=()=>globalThis.testNativeWindow;';if(id==='\0native-core')return 'export const isTauri=()=>true; export const invoke=async()=>{};';},
 }]});
 ({guardDesktopClose}=await server.ssrLoadModule('/src/platform/desktop.ts'));
 ({computePaint}=await server.ssrLoadModule('/src/editor/paintWorker.ts'));
});
after(async()=>{delete globalThis.testNativeWindow;await server?.close();});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function nativeWindow(){
 let listener,closed=0,stopped=0,prevented=0;
 globalThis.testNativeWindow={onCloseRequested:async callback=>{listener=callback;return ()=>{stopped++;};},close:async()=>{closed++;}};
 return {request:()=>listener({preventDefault(){prevented++;}}),get closed(){return closed;},get stopped(){return stopped;},get prevented(){return prevented;}};
}

test('native close waits for the real save result, deduplicates requests and permits retry',async()=>{
 const window=nativeWindow(), gate=deferred();let saves=0,errors=0;
 const stop=await guardDesktopClose(()=>{saves++;return saves===1?gate.promise:Promise.resolve(true);},()=>errors++);
 const first=window.request();await window.request();
 assert.equal(saves,1);assert.equal(window.closed,0);assert.equal(window.prevented,2);
 gate.resolve(false);await first;assert.equal(errors,1);
 await window.request();assert.equal(saves,2);assert.equal(window.closed,1);
 await window.request();assert.equal(window.prevented,3);assert.equal(saves,2);
 stop();assert.equal(window.stopped,1);
});

test('unsubscribing a native guard prevents a late save from closing another screen',async()=>{
 const window=nativeWindow(),gate=deferred();let errors=0;
 const stop=await guardDesktopClose(()=>gate.promise,()=>errors++);
 const pending=window.request();stop();gate.resolve(true);await pending;
 assert.equal(window.closed,0);assert.equal(errors,0);
});

test('native save and close failures remain retryable without unhandled rejection',async()=>{
 const window=nativeWindow();let errors=0,attempt=0;
 const stop=await guardDesktopClose(async()=>{if(++attempt===1)throw Error('Storage failed');return true;},()=>errors++);
 await window.request();assert.equal(errors,1);
 globalThis.testNativeWindow.close=async()=>{throw Error('Window close failed');};
 await window.request();assert.equal(errors,2);
 await window.request();assert.equal(attempt,3);assert.equal(errors,3);
 stop();
});

test('worker message decode failures reject every waiter and permit a fresh worker',async()=>{
 const original=globalThis.Worker,workers=[];
 globalThis.Worker=class{messages=[];constructor(){workers.push(this);}postMessage(message){this.messages.push(message);}terminate(){this.terminated=true;}};
 try{
  const one=computePaint({regions:[]}),two=computePaint({regions:[]});
  const checks=[assert.rejects(one,/worker failed/),assert.rejects(two,/worker failed/)];
  workers[0].onmessageerror();await Promise.all(checks);assert.equal(workers[0].terminated,true);
  const next=computePaint({regions:[]});assert.equal(workers.length,2);
  workers[0].onerror();assert.notEqual(workers[1].terminated,true,'Late old-worker errors must not terminate its replacement');
  workers[1].onmessage({data:{id:workers[1].messages[0].id,regions:[]}});assert.deepEqual(await next,[]);
  workers[1].onerror();
 }finally{if(original===undefined)delete globalThis.Worker;else globalThis.Worker=original;}
});
