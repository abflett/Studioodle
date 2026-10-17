// Region-inspection prototype only; no runtime migration.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
const out = 'art/vector-prototypes/cottage-regions';
const work = 'work/cottage-regions';
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(work, { recursive: true });
const width = 2624, height = 2398, count = width * height;
const source = 'art/vector-prototypes/pipeline/cottage-light.svg';
execFileSync('magick', ['-background', 'white', '-density', '144', source, '-resize', `${width}x${height}!`, '-alpha', 'remove', '-colorspace', 'Gray', '-depth', '8', `${work}/ink.gray`]);
const gray = fs.readFileSync(`${work}/ink.gray`);
if (gray.length !== count) throw new Error('Unexpected render dimensions');
const labels = new Int32Array(count); labels.fill(-1);
for (let i = 0; i < count; i++) if (gray[i] < 128) labels[i] = -2;
const queue = new Int32Array(count);
const regions = [];
function flood(seed, id) {
  let head = 0, tail = 1, area = 0, sx = 0, sy = 0;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  queue[0] = seed; labels[seed] = id;
  while (head < tail) {
    const i = queue[head++], x = i % width, y = Math.floor(i / width);
    area++; sx += x; sy += y; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    const visit = n => { if (labels[n] === -1) { labels[n] = id; queue[tail++] = n; } };
    if (x) visit(i - 1); if (x + 1 < width) visit(i + 1); if (y) visit(i - width); if (y + 1 < height) visit(i + width);
  }
  return { id, pixels: area, sourcePixelArea: area / 4, bounds: [minX, minY, maxX + 1, maxY + 1], centroid: [sx / area, sy / area] };
}
// Every border-connected component is outside, even if ink touches the border.
for (let x = 0; x < width; x++) for (const i of [x, (height - 1) * width + x]) if (labels[i] === -1) flood(i, 0);
for (let y = 0; y < height; y++) for (const i of [y * width, y * width + width - 1]) if (labels[i] === -1) flood(i, 0);
for (let i = 0; i < count; i++) if (labels[i] === -1) regions.push(flood(i, regions.length + 1));
// Extend labels beneath the ink. Multi-source 4-neighbor propagation partitions
// ink at nearest-region boundaries; this is a Manhattan approximation, not an
// exact vector medial axis. The visible vector ink hides these internal seams.
let head = 0, tail = 0;
for (let i = 0; i < count; i++) {
  if (labels[i] < 0) continue;
  const x = i % width;
  if ((x && labels[i - 1] === -2) || (x + 1 < width && labels[i + 1] === -2) || (i >= width && labels[i - width] === -2) || (i + width < count && labels[i + width] === -2)) queue[tail++] = i;
}
while (head < tail) {
  const i = queue[head++], x = i % width;
  const visit = n => { if (labels[n] === -2) { labels[n] = labels[i]; queue[tail++] = n; } };
  if (x) visit(i - 1); if (x + 1 < width) visit(i + 1); if (i >= width) visit(i - width); if (i + width < count) visit(i + width);
}
const map = Buffer.alloc(count * 2);
if (regions.length > 65535) throw new Error('Too many regions');
for (let i = 0; i < count; i++) map.writeUInt16LE(labels[i], i * 2);
const compressed = gzipSync(map, { level: 9 });
fs.writeFileSync(`${out}/regions.u16le.gz`, compressed);
const report = { source, width, height, scale: 2, encoding: 'gzip uint16 little-endian row-major; 0 = exterior', connectivity: 4, threshold: 128, regionCount: regions.length, tinyRegions: regions.filter(r => r.sourcePixelArea < 16).map(r => r.id), regions };
fs.writeFileSync(`${out}/regions.json`, JSON.stringify(report, null, 2));
const rgb = Buffer.alloc(count * 3), flat = Buffer.alloc(count * 3);
function color(id) { if (!id) return [245, 247, 250]; const h = (id * .61803398875) % 1, a = h * 6, c = .38, m = .55; return [5, 3, 1].map(n => Math.round(255 * (m + c * Math.max(0, Math.min(1, Math.abs((a + n) % 6 - 3) - 1))))); }
const palette = Array.from({ length: regions.length + 1 }, (_, id) => color(id));
for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { flat[i * 3 + k] = palette[labels[i]][k]; rgb[i * 3 + k] = Math.round(flat[i * 3 + k] * gray[i] / 255); }
for (const [name, data] of [['regions', rgb], ['labels-only', flat]]) {
  fs.writeFileSync(`${work}/${name}.rgb`, data);
  execFileSync('magick', ['-size', `${width}x${height}`, '-depth', '8', `${work}/${name}.rgb`, '-resize', '1312x1199', `${out}/${name}.png`]);
}
// Self-contained interactive inspection: full-resolution IDs stay unblended.
const png = fs.readFileSync(`${out}/regions.png`).toString('base64');
const flatPng = fs.readFileSync(`${out}/labels-only.png`).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><title>Cottage coloring regions</title><style>body{margin:0;background:#18202b;color:#eef3fa;font:16px system-ui}header{padding:16px;position:sticky;top:0;background:#18202b}main{max-width:1100px;margin:auto}img{width:100%;display:block}#status{font-weight:600}p{margin:6px 0}</style><header><div id="status">Loading ${regions.length} regions…</div><p>Move or tap over a colored area to inspect its ID. Colors identify regions, not suggested paint colors.</p></header><main><img id="picture" src="data:image/png;base64,${png}"></main><script>
const metadata=${JSON.stringify(report)};
(async()=>{const bytes=Uint8Array.from(atob('${compressed.toString('base64')}'),c=>c.charCodeAt(0));const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();const ids=new DataView(raw),pic=document.getElementById('picture'),status=document.getElementById('status');status.textContent=metadata.regionCount+' enclosed regions · '+metadata.tinyRegions.length+' smaller than 16 source pixels²';pic.addEventListener('pointermove',show);pic.addEventListener('pointerdown',show);function show(e){const b=pic.getBoundingClientRect(),x=Math.min(metadata.width-1,Math.max(0,Math.floor((e.clientX-b.left)/b.width*metadata.width))),y=Math.min(metadata.height-1,Math.max(0,Math.floor((e.clientY-b.top)/b.height*metadata.height)));const id=ids.getUint16((y*metadata.width+x)*2,true),r=metadata.regions[id-1];status.textContent=id?'Region '+id+' · '+Math.round(r.sourcePixelArea)+' source pixels²'+(r.sourcePixelArea<16?' · tiny region':''):'Outside the cottage';}})().catch(e=>document.getElementById('status').textContent=e.message);
</script>`;
const inspection = html.replace('</header>', '<button id="toggle" type="button">Hide outlines</button></header>')
  .replace('</script>', `const outlined='data:image/png;base64,${png}',flat='data:image/png;base64,${flatPng}';let showInk=true;document.getElementById('toggle').onclick=()=>{showInk=!showInk;document.getElementById('picture').src=showInk?outlined:flat;document.getElementById('toggle').textContent=showInk?'Hide outlines':'Show outlines';};</script>`);
fs.writeFileSync(`${out}/inspect.html`, inspection);
console.log(JSON.stringify({ regions: regions.length, tinyRegions: report.tinyRegions, compressedBytes: compressed.length }));
