import { brushBlob } from '../../src/editor/vectorPaintGeometry';
import type { VectorPaint } from '../../src/editor/VectorPaint';
import type { VectorDefinition } from '../../src/editor/vectorDefinition';
import type { Pair } from '../../src/editor/polygonGeometry';
import type { EditorSession } from '../../src/editor/EditorSession';

export function stroke(paint:VectorPaint,definition:VectorDefinition,a:Pair,b:Pair,radius:number,color:number,square:boolean){
  return paint.apply(definition,brushBlob(a,b,radius,square),color).changed;
}
export function waitForEdits(session:EditorSession){
  return new Promise<void>(resolve=>session.execute({type:'snapshot',onComplete:()=>resolve()}));
}
