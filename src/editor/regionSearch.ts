import type { VectorDefinition } from './vectorDefinition';
type Region = VectorDefinition['regions'][number];
type Bounds = readonly number[];
type Search = (bounds: Bounds) => readonly Region[];
const searches = new WeakMap<readonly Region[], Search>();

/** Conservative bounds grid shared by every instance of a sticker definition.
 * It selects candidates only; exact vector clipping still decides paint coverage.
 */
export function regionsNear(regions: readonly Region[], bounds: Bounds): readonly Region[] {
    if (regions.length < 24) return regions;
    let search = searches.get(regions);
    if (!search) { search = buildSearch(regions); searches.set(regions, search); }
    return search(bounds);
}
function buildSearch(regions: readonly Region[]): Search {
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for (const region of regions) {
        const bounds=region.bounds;
        left=Math.min(left,bounds[0]!);top=Math.min(top,bounds[1]!);
        right=Math.max(right,bounds[2]!);bottom=Math.max(bottom,bounds[3]!);
    }
    const width=Math.max(1,right-left),height=Math.max(1,bottom-top);
    const size=Math.max(32,Math.sqrt(width*height/Math.min(256,regions.length*2)));
    const columns=Math.min(32,Math.max(1,Math.ceil(width/size))),rows=Math.min(32,Math.max(1,Math.ceil(height/size)));
    const cells=Array.from({length:columns*rows},()=>[] as number[]);
    const column=(x:number)=>Math.max(0,Math.min(columns-1,Math.floor((x-left)/width*columns)));
    const row=(y:number)=>Math.max(0,Math.min(rows-1,Math.floor((y-top)/height*rows)));
    for(let index=0;index<regions.length;index++){
        const b=regions[index]!.bounds;
        for(let y=row(b[1]!);y<=row(b[3]!);y++)for(let x=column(b[0]!);x<=column(b[2]!);x++)cells[y*columns+x]!.push(index);
    }
    return bounds=>{
        if(bounds[2]!<left||bounds[0]!>right||bounds[3]!<top||bounds[1]!>bottom)return [];
        const found=new Set<number>();
        for(let y=row(bounds[1]!);y<=row(bounds[3]!);y++)for(let x=column(bounds[0]!);x<=column(bounds[2]!);x++)
            for(const index of cells[y*columns+x]!)found.add(index);
        // Preserve definition order at shared edges and rare overlapping regions.
        return [...found].sort((a,b)=>a-b).map(index=>regions[index]!);
    };
}
