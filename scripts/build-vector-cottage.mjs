// Freeze the accepted light trace + region inspection as a versioned definition.
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
const out = 'src/assets/vector';
fs.mkdirSync(out, { recursive: true });
const width = 1312, height = 1199;
const svg = fs.readFileSync('art/vector-prototypes/pipeline/cottage-light.svg', 'utf8');
const ids = gunzipSync(fs.readFileSync('art/vector-prototypes/cottage-regions/regions.u16le.gz'));
execFileSync('magick', ['-background', 'white', '-density', '72', 'art/vector-prototypes/pipeline/cottage-light.svg', '-resize', `${width}x${height}!`, '-alpha', 'remove', '-colorspace', 'Gray', '-depth', '8', 'work/cottage-regions/native.gray']);
const gray = fs.readFileSync('work/cottage-regions/native.gray');
const regions = new Uint16Array(width * height), coverage = Buffer.alloc(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = y * width + x;
  regions[i] = ids.readUInt16LE(((y * 2 + 1) * width * 2 + x * 2 + 1) * 2);
  coverage[i] = regions[i] || gray[i] < 128 ? 0 : 255;
}
if (new Set(regions).size !== 90) throw new Error('Native paint resolution lost a cottage region');
fs.writeFileSync('work/cottage-regions/silhouette.gray', coverage);
// Inset only the rendered backing by two native pixels. Independent silhouette
// tracing can otherwise extend white past the antialiased vector ink. Erode a
// white foreground (then invert back for Potrace); never scale the whole shape,
// which would shift interior alignment. Keep picking and paint regions intact.
execFileSync('magick', ['-size', `${width}x${height}`, '-depth', '8', 'work/cottage-regions/silhouette.gray', '-negate', '-morphology', 'Erode', 'Disk:2', '-negate', 'work/cottage-regions/silhouette.pbm']);
execFileSync(process.env.POTRACE_PATH ?? 'work/tools/potrace/potrace-1.16.win64/potrace.exe', ['work/cottage-regions/silhouette.pbm', '-s', '-a', '1.2', '-O', '.3', '-t', '2', '-o', 'work/cottage-regions/silhouette.svg']);
const paths = text => [...text.matchAll(/<path\s+d="([^"]+)"/g)].map(m => m[1]);
const inkPaths = paths(svg), silhouettePaths = paths(fs.readFileSync('work/cottage-regions/silhouette.svg', 'utf8'));
const hitScale = 2;
const hitSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * hitScale}" height="${height * hitScale}" viewBox="0 0 ${width} ${height}"><g fill="white" transform="translate(0 ${height}) scale(.1 -.1)">${[...silhouettePaths, ...inkPaths].map(d => `<path d="${d}"/>`).join('')}</g></svg>`;
fs.writeFileSync('work/cottage-regions/hit.svg', hitSvg);
const hitAlpha = execFileSync('magick', ['-background', 'none', 'work/cottage-regions/hit.svg', '-alpha', 'extract', '-depth', '8', 'gray:-'], { maxBuffer: 32e6 });
if (hitAlpha.length !== width * height * hitScale ** 2) throw new Error('Unexpected hit mask dimensions');
const hitCoverage = Buffer.alloc(Math.ceil(hitAlpha.length / 8));
hitAlpha.forEach((v, i) => { if (v >= 128) hitCoverage[i >> 3] |= 1 << (i & 7); });
const runs = [];
for (let i = 0; i < regions.length;) { const start = i, id = regions[i++]; while (i < regions.length && regions[i] === id) i++; runs.push(i - start, id); }
const packed = Buffer.alloc(runs.length * 4); runs.forEach((n, i) => packed.writeUInt32LE(n, i * 4));
const covered = Buffer.alloc(Math.ceil(coverage.length / 8)); coverage.forEach((v, i) => { if (!v) covered[i >> 3] |= 1 << (i & 7); });
fs.writeFileSync(`${out}/cottage-v1.json`, JSON.stringify({ width, height, regionCount: 89, regionRuns: packed.toString('base64'), coverage: covered.toString('base64'), hitScale, hitCoverage: hitCoverage.toString('base64'), inkPaths, silhouettePaths }));
fs.copyFileSync('art/vector-prototypes/pipeline/cottage-light.svg', `${out}/cottage-v1.svg`);
console.log('Built immutable cottage-v1 definition with vector ink, silhouette and native paint-region labels.');
