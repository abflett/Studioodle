import { waitForEdits } from './helpers';
import { EditorSession } from '../../src/editor/EditorSession';
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
export async function checkFirstFill(){
 const session=new EditorSession({id:'cold-fill',title:'Cold fill',format:'landscape',size:{width:1754,height:1240},background:'#cce8ff',leafColor:0x242428},{save:()=>{},changed:()=>{}});
 session.execute({type:'set-tool',tool:'brush'});session.execute({type:'set-brush',options:{tip:'round',size:5}});
 session.begin({x:310,y:160},1,0);
 for(let i=1;i<=2400;i++){const t=i/2400*Math.PI*2,jitter=Math.sin(i*13)*.8;session.move({x:240+(70+jitter)*Math.cos(t),y:160+(85+jitter)*Math.sin(t)},1,true,.47);}
 session.release({x:310,y:160},1,.47);
 session.execute({type:'set-tool',tool:'bucket'});session.execute({type:'set-color',color:0xff8811});
 const start=performance.now();session.execute({type:'fill-at',point:{x:240,y:160}});await waitForEdits(session);
 const firstFillMs=performance.now()-start;
 assert(firstFillMs<1500,`First blank-page ink fill took ${firstFillMs.toFixed(1)}ms`);
 session.execute({type:'set-color',color:0xff11aa});const next=performance.now();session.execute({type:'fill-at',point:{x:240,y:160}});await waitForEdits(session);
 const nextFillMs=performance.now()-next;
 return {firstFillMs,nextFillMs,inputSamples:2400};
}
