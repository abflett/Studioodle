import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { mergeReviewLines } from './merge-review-lines.mjs';

const file = process.argv[2], directory = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'work/line-repair-2026-10-24';
if (!file) throw Error('Provide a review JSON');
const reviewBytes = fs.readFileSync(file), review = JSON.parse(reviewBytes);
if (review.kind !== 'studioodle-artwork-review' || review.version !== 1 || review.coordinateSpace !== 'svg-viewBox') throw Error('Unsupported review');
const manifest = JSON.parse(fs.readFileSync('art/stickers.json', 'utf8'));
const entries = review.assets.filter(a => a.closures?.length);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (!entries.length || new Set(entries.map(a => a.assetId)).size !== entries.length) throw Error('Empty or duplicate repair set');
for (const entry of entries) {
  const asset = manifest.find(a => a.id === entry.assetId);
  if (!asset || entry.vectorPath !== `src/assets/vector/${asset.id}.svg` || digest(fs.readFileSync(entry.vectorPath)) !== entry.sha256 || JSON.stringify(entry.viewBox) !== JSON.stringify([0, 0, asset.width, asset.height])) throw Error(`Stale or invalid review: ${entry.assetId}`);
}
fs.mkdirSync(path.join(directory, 'ink'), { recursive: true });
const results = [];
for (const entry of entries) {
  const asset = manifest.find(a => a.id === entry.assetId);
  const merged = mergeReviewLines(fs.readFileSync(entry.vectorPath, 'utf8'), entry.closures, asset.width, asset.height);
  fs.writeFileSync(path.join(directory, 'ink', `${asset.id}.svg`), merged.svg);
  results.push({ assetId: asset.id, beforeSha256: entry.sha256, sourceHash: digest(fs.readFileSync(asset.source)), inkHash: digest(merged.svg), lines: merged.lines, addedArea: merged.addedArea, appliedClosureIds: entry.closures.map(line => line.id) });
  fs.writeFileSync(path.join(directory, 'line-merge.json'), JSON.stringify({ review: file, reviewHash: digest(reviewBytes), results }, null, 2) + '\n');
  console.log(`${results.length}/${entries.length} ${asset.id}: ${merged.lines} lines merged`);
}
fs.writeFileSync(path.join(directory, 'targets.json'), JSON.stringify(entries.map(a => a.assetId), null, 2) + '\n');
if (process.argv.includes('--apply')) {
  const accepted = 'art/source/stickers/line-repairs'; fs.mkdirSync(accepted, { recursive: true });
  for (const result of results) {
    const asset = manifest.find(a => a.id === result.assetId);
    asset.inkSource = `${accepted}/${asset.id}.svg`;
    fs.copyFileSync(path.join(directory, 'ink', `${asset.id}.svg`), asset.inkSource);
  }
  fs.writeFileSync('art/stickers.json', JSON.stringify(manifest, null, 2) + '\n');
}
