import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('every production sticker is a single region SVG, without serialized maps', () => {
  const inventory = JSON.parse(fs.readFileSync('art/stickers.json', 'utf8'));
  assert.deepEqual(fs.readdirSync('src/assets/vector').filter(file => file.endsWith('.json')), ['catalog.json']);
  for (const asset of inventory) {
    assert.ok(fs.existsSync(asset.source),`${asset.id}: missing source`);
    const text = fs.readFileSync(`src/assets/vector/${asset.id}.svg`, 'utf8');
    const regions = [...text.matchAll(/id="region-(\d+)"/g)].map(match => Number(match[1]));
    assert.deepEqual(regions, Array.from({ length: regions.length }, (_, index) => index + 1), asset.id);
    assert.ok(text.includes('data-region-format="1"'), asset.id);
    assert.ok(text.includes('data-region-scale="'), asset.id);
    assert.equal(/<image\b|data:image|regionRuns|hitCoverage/.test(text), false, asset.id);
    assert.ok(regions.length>0,asset.id);
    assert.ok(text.includes(`viewBox="0 0 ${asset.width} ${asset.height}"`),asset.id);
    const ids = new Set([...text.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    for (const match of text.matchAll(/clip-path="url\(#([^)]*)\)"/g)) assert.ok(ids.has(match[1]), `${asset.id}: missing clip`);
  }

});
