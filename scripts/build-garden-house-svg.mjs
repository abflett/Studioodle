import fs from 'node:fs';
import { regionSvg } from './svg-regions.mjs';

// Reproducible pilot from the pinned pre-conversion definition.
const source = JSON.parse(fs.readFileSync('experiments/garden-house/baseline/garden-house.json', 'utf8'));
const bytes = Buffer.from(source.regionRuns, 'base64');
const labels = new Uint16Array(source.width * source.height * source.regionScale ** 2);
let cursor = 0;
for (let i = 0; i < bytes.length; i += 8) {
  const count = bytes.readUInt32LE(i), id = bytes.readUInt32LE(i + 4);
  labels.fill(id, cursor, cursor + count); cursor += count;
}
if (cursor !== labels.length) throw new Error('Invalid baseline region map');
const svg = regionSvg({ ...source, scale: source.regionScale, labels });
fs.writeFileSync('src/assets/vector/garden-house.svg', svg);
console.log(`Garden house: ${source.regionCount} region paths, ${Buffer.byteLength(svg)} SVG bytes`);
