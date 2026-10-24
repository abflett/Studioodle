import fs from 'node:fs';
import path from 'node:path';
import paper from 'paper';
import { reviewRegions } from './artwork-review-repairs.mjs';

const directory = process.argv[2];
if (!directory) throw Error('Provide the audited marker stage');
const report = JSON.parse(fs.readFileSync(path.join(directory, 'restorations.json'), 'utf8'));
const problems = [], results = [];
for (const asset of report.results) {
  const before = fs.readFileSync(path.join(directory, 'before', `${asset.assetId}.svg`), 'utf8');
  const after = fs.readFileSync(path.join(directory, 'vector', `${asset.assetId}.svg`), 'utf8');
  const fail = reason => problems.push({ assetId: asset.assetId, reason });
  if (before.slice(before.indexOf('<g id="ink"')) !== after.slice(after.indexOf('<g id="ink"'))) fail('Restoring cutouts changed ink');
  const scope = new paper.PaperScope(); scope.setup(new scope.Size(100, 100));
  try {
    const old = reviewRegions(before, scope), next = reviewRegions(after, scope);
    for (const item of asset.restorations) {
      const point = new scope.Point(...item.point);
      if (old.some(r => r.geometry.contains(point))) fail(`Point was already paintable: ${item.markerId}`);
      if (!next.some(r => r.geometry.contains(point))) fail(`Requested fill missing: ${item.markerId}`);
    }
    for (const region of old) if (!next.some(r => r.geometry.contains(region.geometry.interiorPoint))) fail(`Existing region ${region.id} lost its interior`);
    results.push({ assetId: asset.assetId, beforeRegions: old.length, afterRegions: next.length, markers: asset.restorations.length });
  } finally { scope.remove(); }
}
fs.writeFileSync(path.join(directory, 'restoration-validation.json'), JSON.stringify({ results, problems }, null, 2) + '\n');
console.log(JSON.stringify({ restored: results.reduce((n, a) => n + a.markers, 0), problems }));
if (problems.length) process.exitCode = 1;
