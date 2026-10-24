import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import paper from 'paper';
import { reviewRegions } from './artwork-review-repairs.mjs';

// Original marker coordinates survive line edits; region IDs do not.
const file = process.argv[2], option = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const lineStage = option('line-stage'), out = option('out');
if (!file || !lineStage || !out) throw Error('Provide review JSON, --line-stage and --out');
const review = JSON.parse(fs.readFileSync(file, 'utf8'));
if (review.kind !== 'studioodle-artwork-review' || review.version !== 1 || review.coordinateSpace !== 'svg-viewBox') throw Error('Unsupported review');
const manifest = JSON.parse(fs.readFileSync('art/stickers.json', 'utf8'));
const merged = JSON.parse(fs.readFileSync(path.join(lineStage, 'line-merge.json'), 'utf8'));
const built = JSON.parse(fs.readFileSync(path.join(lineStage, 'summary.json'), 'utf8'));
if (!fs.existsSync(path.join(lineStage, 'promotion.json'))) throw Error('Promote the validated line pass before interpreting markers');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
if (hash(fs.readFileSync(file)) !== merged.reviewHash) throw Error('Line stage belongs to a different review export');
for (const entry of review.assets) {
  const asset = manifest.find(a => a.id === entry.assetId);
  if (!asset) throw Error(`Unknown asset: ${entry.assetId}`);
  const svg = fs.readFileSync(`src/assets/vector/${asset.id}.svg`, 'utf8'), sha256 = hash(svg);
  const merge = merged.results.find(a => a.assetId === asset.id), result = built.results.find(a => a.id === asset.id);
  if (sha256 !== entry.sha256 && !(merge?.beforeSha256 === entry.sha256 && result?.outputHash === sha256)) throw Error(`Unrecorded revision: ${asset.id}`);
  const scope = new paper.PaperScope(); scope.setup(new scope.Size(asset.width, asset.height));
  try {
    const regions = reviewRegions(svg, scope);
    entry.markers = entry.markers.map(marker => ({ ...marker, regionId: regions.find(r => r.geometry.contains(new scope.Point(marker.x, marker.y)))?.id ?? 0 }));
    entry.sha256 = sha256; entry.closures = [];
  } finally { scope.remove(); }
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'review.json'), JSON.stringify(review, null, 2) + '\n');
console.log(`Refreshed marker region IDs against promoted linework in ${out}/review.json`);
