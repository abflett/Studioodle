import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const svg = fs.readFileSync('src/assets/vector/garden-house.svg', 'utf8').replaceAll('\r\n', '\n');
const baseline = JSON.parse(fs.readFileSync('experiments/garden-house/baseline/garden-house.json', 'utf8'));

test('house SVG carries every stable region ID and original ink path', () => {
  const ids = [...svg.matchAll(/id="region-(\d+)"/g)].map(match => Number(match[1])).sort((a, b) => a - b);
  assert.deepEqual(ids, Array.from({ length: baseline.regionCount }, (_, index) => index + 1));
  assert.equal([...svg.matchAll(/id="ink-\d+"/g)].length, baseline.commands.length);
  for (const command of baseline.commands) assert.ok(svg.includes(`d="${command.d}"`));
  assert.ok(svg.includes(`viewBox="0 0 ${baseline.width} ${baseline.height}"`));
  assert.equal(/<image\b|data:image|regionRuns|hitCoverage/.test(svg), false);
});

test('every production sticker is a single region SVG, without serialized maps', () => {
  const inventory = JSON.parse(fs.readFileSync('art/stickers.json', 'utf8'));
  const report = JSON.parse(fs.readFileSync('art/conversion-report.json', 'utf8'));
  assert.deepEqual(fs.readdirSync('src/assets/vector').filter(file => file.endsWith('.json')), ['catalog.json']);
  for (const asset of inventory) {
    const text = fs.readFileSync(`src/assets/vector/${asset.id}.svg`, 'utf8');
    const expected = report.find(row => row.id === asset.id).regionCount;
    const regions = [...text.matchAll(/id="region-(\d+)"/g)].map(match => Number(match[1]));
    assert.deepEqual(regions, Array.from({ length: expected }, (_, index) => index + 1), asset.id);
    assert.ok(text.includes('data-region-format="1"'), asset.id);
    assert.ok(text.includes('data-region-scale="'), asset.id);
    assert.equal(/<image\b|data:image|regionRuns|hitCoverage/.test(text), false, asset.id);
    const ids = new Set([...text.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    for (const match of text.matchAll(/clip-path="url\(#([^)]*)\)"/g)) assert.ok(ids.has(match[1]), `${asset.id}: missing clip`);
  }
  assert.equal(fs.existsSync('experiments/garden-house/baseline/garden-house.json'), true);
});
