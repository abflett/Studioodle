import type { Point } from './document';

/** Experimental pixel-only overlay. No particles, polygons or worker jobs survive a dab. */
export const sprayTileSize = 128;
export type SprayTile = { x: number; y: number; pixels: Uint8ClampedArray };
export type RasterSprayData = { version: 1; width: number; height: number; tiles: SprayTile[] };
export type SprayBefore = { surfaceId: string; key: string; tile?: SprayTile };
type Tile = { canvas: HTMLCanvasElement; image: ImageData; saved?: SprayTile; dirty: boolean };
export function sprayResolution(width: number, height: number) {
    const scale = Math.min(1, 1536 / Math.max(width, height), Math.sqrt(1048576 / (width * height)));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}
export function validRasterSpray(value: unknown): value is RasterSprayData {
    if (!value || typeof value !== 'object') return false;
    const data = value as RasterSprayData;
    if (data.version !== 1 || !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width < 1 || data.height < 1 || data.width > 1536 || data.height > 1536 || data.width * data.height > 1048576 || !Array.isArray(data.tiles)) return false;
    const keys = new Set<string>(), columns = Math.ceil(data.width / sprayTileSize), rows = Math.ceil(data.height / sprayTileSize);
    if (data.tiles.length > columns * rows) return false;
    return data.tiles.every(tile => {
        if (!tile || !Number.isInteger(tile.x) || !Number.isInteger(tile.y) || tile.x < 0 || tile.y < 0 || tile.x >= columns || tile.y >= rows) return false;
        const key = `${tile.x}:${tile.y}`;
        if (keys.has(key)) return false; keys.add(key);
        return tile.pixels instanceof Uint8ClampedArray && tile.pixels.length === sprayTileSize * sprayTileSize * 4;
    });
}
export class RasterSpray {
    private tiles = new Map<string, Tile>();
    readonly width: number;
    readonly height: number;
    constructor(private logicalWidth: number, private logicalHeight: number, data?: RasterSprayData, private changing?: (key: string, before: () => SprayTile | undefined) => void) {
        const size = data ?? sprayResolution(logicalWidth, logicalHeight);
        this.width = size.width; this.height = size.height;
        for (const tile of data?.tiles ?? []) this.restore(`${tile.x}:${tile.y}`, tile);
    }
    private maskKey = '';
    private masks = new Map<string, Uint8Array>();
    /** Geometry ownership changes invalidate masks; ordinary paint/palette changes do not. */
    setClipKey(key: string) { if (key !== this.maskKey) { this.maskKey = key; this.masks.clear(); } }
    private create(): Tile {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = sprayTileSize;
        return { canvas, image: new ImageData(sprayTileSize,sprayTileSize), dirty: true };
    }
    private snapshot(key: string, tile: Tile) {
        if (!tile.saved) {
            const [x, y] = key.split(':').map(Number);
            tile.saved = { x: x!, y: y!, pixels: tile.image.data.slice() };
        }
        return tile.saved;
    }
    serialize(): RasterSprayData | undefined {
        if (!this.tiles.size) return;
        return { version: 1, width: this.width, height: this.height, tiles: [...this.tiles].map(([key, tile]) => this.snapshot(key, tile)) };
    }
    restore(key: string, saved?: SprayTile) {
        const old = this.tiles.get(key); if (old) old.canvas.width = old.canvas.height = 1;
        if (!saved) { this.tiles.delete(key); return; }
        const tile = this.create(); tile.image.data.set(saved.pixels);
        tile.saved = saved; this.tiles.set(key, tile);
    }
    private mask(x: number, y: number, clip: (ctx: CanvasRenderingContext2D) => void, path?: Path2D) {
        const key = `${x}:${y}`, cached = !path && this.masks.get(key); if (cached) return cached;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = sprayTileSize;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.setTransform(this.width/this.logicalWidth,0,0,this.height/this.logicalHeight,-x*sprayTileSize,-y*sprayTileSize);
        ctx.beginPath();ctx.rect(0,0,this.logicalWidth,this.logicalHeight);ctx.clip();clip(ctx);
        ctx.fillStyle='#fff'; if (path) ctx.fill(path); else ctx.fillRect(0,0,this.logicalWidth,this.logicalHeight);
        const rgba = ctx.getImageData(0,0,sprayTileSize,sprayTileSize).data, alpha = new Uint8Array(sprayTileSize*sprayTileSize);
        for (let i=0;i<alpha.length;i++) alpha[i]=rgba[i*4+3]!;
        canvas.width=canvas.height=1;
        if (!path) this.masks.set(key,alpha); return alpha;
    }
    private modify(bounds: number[], clip: (ctx: CanvasRenderingContext2D) => void, paint: (pixels: Uint8ClampedArray, alpha: Uint8Array, x: number, y: number) => boolean, erase = false, path?: Path2D) {
        const sx=this.width/this.logicalWidth, sy=this.height/this.logicalHeight;
        const left=Math.max(0,Math.floor(bounds[0]!*sx/sprayTileSize)),top=Math.max(0,Math.floor(bounds[1]!*sy/sprayTileSize));
        const right=Math.min(Math.ceil(this.width/sprayTileSize)-1,Math.floor(bounds[2]!*sx/sprayTileSize)),bottom=Math.min(Math.ceil(this.height/sprayTileSize)-1,Math.floor(bounds[3]!*sy/sprayTileSize));
        let changed=false;
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
            const key=`${x}:${y}`;let tile=this.tiles.get(key);if(!tile&&erase)continue;
            const alpha=this.mask(x,y,clip,path);if(!alpha.some(n=>n))continue;
            const previous=tile;
            this.changing?.(key,()=>previous?this.snapshot(key,previous):undefined);
            if(!tile){tile=this.create();this.tiles.set(key,tile);}
            if(!paint(tile.image.data,alpha,x*sprayTileSize,y*sprayTileSize))continue;
            tile.saved=undefined;tile.dirty=true;changed=true;
            if(erase&&!tile.image.data.some((n,i)=>i%4===3&&n>0)){tile.canvas.width=tile.canvas.height=1;this.tiles.delete(key);}
        }
        return changed;
    }
    dab(point: Point, radius: number, color: number, clip: (ctx: CanvasRenderingContext2D) => void) {
        const sx=this.width/this.logicalWidth,sy=this.height/this.logicalHeight;
        const r=(color>>>16)&255,g=(color>>>8)&255,b=color&255;
        return this.modify([point.x-radius,point.y-radius,point.x+radius,point.y+radius],clip,(pixels,mask,ox,oy)=>{
            const left=Math.max(0,Math.floor((point.x-radius)*sx)-ox),right=Math.min(sprayTileSize-1,Math.ceil((point.x+radius)*sx)-ox);
            const top=Math.max(0,Math.floor((point.y-radius)*sy)-oy),bottom=Math.min(sprayTileSize-1,Math.ceil((point.y+radius)*sy)-oy);
            let changed=false;
            for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
                const index=y*sprayTileSize+x;if(!mask[index])continue;
                const t=Math.hypot((x+ox+.5)/sx-point.x,(y+oy+.5)/sy-point.y)/radius;if(t>=1)continue;
                const a=(t<.45?.85-.2*t/.45:.65*(1-t)/.55)*mask[index]!/255;
                const offset=index*4,old=pixels[offset+3]!/255,out=a+old*(1-a);if(!out)continue;
                pixels[offset]=(r*a+pixels[offset]!*old*(1-a))/out;
                pixels[offset+1]=(g*a+pixels[offset+1]!*old*(1-a))/out;
                pixels[offset+2]=(b*a+pixels[offset+2]!*old*(1-a))/out;
                pixels[offset+3]=out*255;changed=true;
            }
            return changed;
        });
    }
    erase(path: Path2D, bounds: number[], clip: (ctx: CanvasRenderingContext2D) => void) {
        return this.modify(bounds,clip,(pixels,mask)=>{
            let changed=false;
            for(let i=0;i<mask.length;i++)if(mask[i]&&pixels[i*4+3]){pixels[i*4+3]=pixels[i*4+3]!*(1-mask[i]!/255);changed=true;}
            return changed;
        },true,path);
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.logicalWidth, this.logicalHeight); ctx.clip();
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        const sx = this.logicalWidth / this.width, sy = this.logicalHeight / this.height;
        for (const [key, tile] of this.tiles) { const [x, y] = key.split(':').map(Number); if (tile.dirty) { tile.canvas.getContext('2d')!.putImageData(tile.image,0,0); tile.dirty=false; } ctx.drawImage(tile.canvas, x!*sprayTileSize*sx, y!*sprayTileSize*sy, sprayTileSize*sx, sprayTileSize*sy); }
        ctx.restore();
    }
    dispose() { for (const tile of this.tiles.values()) tile.canvas.width = tile.canvas.height = 1; this.tiles.clear(); this.masks.clear(); }
}

/** Embed the same pixels in SVG/PDF/print; never regenerate high-DPI spray. */
export function sprayImages(data: RasterSprayData, logicalWidth: number, logicalHeight: number) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = sprayTileSize;
    try {
        return data.tiles.map(tile => {
            canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(tile.pixels), sprayTileSize, sprayTileSize), 0, 0);
            return { x: tile.x*sprayTileSize*logicalWidth/data.width, y: tile.y*sprayTileSize*logicalHeight/data.height,
                width: sprayTileSize*logicalWidth/data.width, height: sprayTileSize*logicalHeight/data.height, href: canvas.toDataURL('image/png') };
        });
    } finally { canvas.width = canvas.height = 1; }
}
