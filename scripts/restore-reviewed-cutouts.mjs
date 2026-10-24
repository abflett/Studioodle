import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { discoverRegions } from './discover-regions.mjs';

// An explicit add marker can reverse an earlier cutout, without inventing line art.
const file = process.argv[2], out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
if (!file || !out) throw Error('Provide a refreshed review JSON and --out');
const review = JSON.parse(fs.readFileSync(file, 'utf8')), manifest = JSON.parse(fs.readFileSync('art/stickers.json', 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(out, { recursive: true });
const results = [];
for (const entry of review.assets) {
  const markers = entry.markers.filter(m => m.kind === 'add-region' && !m.regionId);
  if (!markers.length) continue;
  const asset = manifest.find(a => a.id === entry.assetId);
  const svg = fs.readFileSync(`src/assets/vector/${asset.id}.svg`, 'utf8');
  if (hash(svg) !== entry.sha256) throw Error(`Stale marker geometry: ${asset.id}`);
  if (svg.includes('<clipPath')) throw Error(`Clipped ink requires separate inspection: ${asset.id}`);
  const scale = Number(/data-analysis-scale="([^"]+)"/.exec(svg)?.[1] ?? /data-region-scale="([^"]+)"/.exec(svg)[1]);
  const w = asset.width * scale, h = asset.height * scale;
  const ink = svg.slice(svg.indexOf('<g id="ink"'), svg.lastIndexOf('</svg>'));
  const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${asset.width} ${asset.height}"><rect width="${asset.width}" height="${asset.height}" fill="white"/>${ink}</svg>`;
  const render = path.join(out, `${asset.id}-unmasked.svg`); fs.writeFileSync(render, preview);
  const gray = execFileSync('magick', [render, '-alpha', 'remove', '-colorspace', 'Gray', '-depth', '8', 'gray:-'], { maxBuffer: 64e6 });
  if (gray.length !== w * h) throw Error('Unexpected analysis dimensions');
  const { labels } = discoverRegions(gray, w, h, { ...asset, cutouts: [] }, scale);
  const component = (x, y) => labels[Math.floor(y * scale) * w + Math.floor(x * scale)];
  const originalSeeds = asset.cutouts ?? [], remove = new Set(), restorations = [];
  for (const marker of markers) {
    const id = component(marker.x, marker.y);
    const matching = originalSeeds.flatMap((seed, index) => id > 0 && component(...seed) === id ? [index] : []);
    if (!matching.length) throw Error(`No enclosed existing cutout matches ${asset.id} marker ${marker.id}; inspect the gap instead of inferring a fill.`);
    matching.forEach(index => remove.add(index));
    restorations.push({ markerId: marker.id, point: [marker.x, marker.y], removedSeeds: matching.map(index => originalSeeds[index]) });
  }
  results.push({ assetId: asset.id, beforeSha256: entry.sha256, restorations, originalSeeds });
  if (process.argv.includes('--apply')) asset.cutouts = originalSeeds.filter((_, index) => !remove.has(index));
}
fs.writeFileSync(path.join(out, 'restorations.json'), JSON.stringify({ reviewFile: file, results }, null, 2) + '\n');
if (process.argv.includes('--apply')) fs.writeFileSync('art/stickers.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Restored ${results.reduce((n, a) => n + a.restorations.length, 0)} requested fills across ${results.length} assets by removing only matching cutout seeds.`);
