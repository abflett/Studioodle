import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const commit = 'c460b3e16d31cd67754b40531271b4f36612a8c8';
const inventory = JSON.parse(execFileSync('git', ['show', `${commit}:art/stickers.json`], { maxBuffer: 32e6 }));
const dir = 'work/svg-migration/baseline'; fs.mkdirSync(dir, { recursive: true });
const assets = inventory.map(asset => {
  const id = asset.id;
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid baseline ID');
  const data = execFileSync('git', ['show', `${commit}:src/assets/vector/${id}.json`], { maxBuffer: 32e6 });
  const svg = execFileSync('git', ['show', `${commit}:src/assets/vector/${id}.svg`], { maxBuffer: 32e6 });
  fs.writeFileSync(`${dir}/${id}.json`, data); fs.writeFileSync(`${dir}/${id}.svg`, svg);
  const d = JSON.parse(data);
  return { id, width: d.width, height: d.height, regionCount: d.regionCount, scale: d.regionScale,
    jsonBytes: data.length, svgBytes: svg.length, gzipBytes: gzipSync(data).length + gzipSync(svg).length,
    mapBytes: d.width * d.height * d.regionScale ** 2 * 2 + Buffer.from(d.hitCoverage, 'base64').length,
    sha256: createHash('sha256').update(data).digest('hex') };
});
fs.mkdirSync('experiments/svg-migration', { recursive: true });
fs.writeFileSync('experiments/svg-migration/baseline.json', JSON.stringify({ commit, compression: 'Node gzipSync default level 6, separate files', assets }, null, 2) + '\n');
console.log(`Captured ${assets.length} assets from ${commit}`);
