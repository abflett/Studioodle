import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const directory = 'experiments/moon-sorceress/thresholds';
const variants = [{ prefix: 'a-', threshold: 40 }, { prefix: 'b-', threshold: 50 }, { prefix: 'c-', threshold: 60 }];
if (process.argv.includes('--capture')) {
  for (const v of variants) execFileSync(process.execPath, ['scripts/build-stickers.mjs', 'fantasy-moon-sorceress', `--inspect=${directory}`, `--inspect-threshold=${v.threshold}`, `--inspect-prefix=${v.prefix}`, '--inspect-shared-source=../'], { stdio: 'inherit' });
}
const previews = path.join(directory, 'previews');
fs.mkdirSync(previews, { recursive: true });
const magick = (...args) => execFileSync('magick', args, { maxBuffer: 64e6 });
const rows = variants.map(v => {
  const settings = JSON.parse(fs.readFileSync(path.join(directory, `${v.prefix}00-settings.json`), 'utf8'));
  const pixels = magick(path.join(directory, `${v.prefix}05-threshold.png`), '-depth', '8', 'gray:-');
  return { ...v, inkPaths: settings.ink.paths, inkContours: settings.ink.closedContours, regionPaths: settings.regionCount, blackPixels: pixels.reduce((count, p) => count + (p === 0 ? 1 : 0), 0) };
});
const stages = [
  ['Binary threshold', '05-threshold.png', '05-threshold.pbm'],
  ['First traced SVG', '06-traced-ink.png', '06-traced-ink.svg'],
  ['Regions before extension', '08-discovered-regions.png'],
  ['Regions beneath ink', '09-regions-extended-under-ink.png'],
  ['Final regions only', '12-final-colored-regions.png', '12-final-colored-regions.svg'],
  ['Final regions and ink', '13-final-colored-regions-with-ink.png', '10-final.svg'],
];
const details = [
  { name: 'hair', title: 'Hair and open strands', x: 14, y: 68, width: 110, height: 140 },
  { name: 'folds', title: 'Upper dress folds and intersections', x: 100, y: 105, width: 115, height: 105 },
  { name: 'diamonds', title: 'Diamond details', x: 167, y: 197, width: 45, height: 85 },
];
function thumbnail(source, name) {
  magick(source, '-resize', '360x400', '-background', 'white', '-gravity', 'center', '-extent', '360x400', path.join(previews, name));
}
for (const v of variants) {
  for (const [, image] of stages) thumbnail(path.join(directory, v.prefix + image), v.prefix + image);
  for (const d of details) {
    const name = `${v.prefix}detail-${d.name}.png`;
    magick(path.join(directory, `${v.prefix}07-analysis-render.png`), '-crop', `${d.width * 8}x${d.height * 8}+${d.x * 8}+${d.y * 8}`, '+repage', path.join(directory, name));
    thumbnail(path.join(directory, name), name);
    const labeled = path.join(previews, `${v.prefix}sheet-${d.name}.png`);
    magick(path.join(previews, name), '-background', 'white', '-gravity', 'north', '-splice', '0x32', '-font', 'Arial', '-pointsize', '18', '-fill', '#203147', '-annotate', '+0+7', `${v.prefix[0].toUpperCase()} - ${v.threshold}%`, labeled);
  }
}
const sheets = details.flatMap(d => variants.map(v => path.join(previews, `${v.prefix}sheet-${d.name}.png`)));
magick('montage', ...sheets, '-tile', '3x3', '-geometry', '+4+4', '-background', '#e3e8ed', path.join(directory, 'threshold-detail-comparison.png'));
const table = `<table><tr><th>Variant</th><th>Threshold</th><th>Ink paths</th><th>Closed ink contours</th><th>Regions</th></tr>${rows.map(r => `<tr><td><a href="${r.prefix}index.html">${r.prefix[0].toUpperCase()}</a></td><td>${r.threshold}%</td><td>${r.inkPaths}</td><td>${r.inkContours}</td><td>${r.regionPaths}</td></tr>`).join('')}</table>`;
const cards = (image, vector) => variants.map(v => `<article><h3>${v.prefix[0].toUpperCase()} - ${v.threshold}%</h3><a href="${v.prefix}${image}"><img loading="lazy" src="previews/${v.prefix}${image}" alt="${v.prefix[0].toUpperCase()} ${image}"></a><p><a href="${v.prefix}${image}">Full-resolution PNG</a>${vector ? ` | <a href="${v.prefix}${vector}">${vector.endsWith('pbm') ? 'PBM' : 'SVG'}</a>` : ''}</p></article>`).join('');
const detailHtml = details.map(d => `<section><h2>${d.title}</h2><p>Same crop from each traced SVG rendered at 8x. Click for native pixels.</p><div class="grid">${cards(`detail-${d.name}.png`)}</div></section>`).join('');
const stageHtml = stages.map(([title, image, svg]) => `<section><h2>${title}</h2><div class="grid">${cards(image, svg)}</div></section>`).join('');
fs.writeFileSync(path.join(directory, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moon Sorceress - threshold comparison</title><style>body{font:16px system-ui;color:#203147;background:#edf0f3;max-width:1200px;margin:24px auto;padding:0 16px}p{line-height:1.5}table{border-collapse:collapse;background:white}th,td{padding:10px;border:1px solid #a9bac8;text-align:left}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}article{background:white;border:1px solid #b6c4cf;border-radius:12px;padding:12px;min-width:0}img{display:block;width:100%;height:auto}a{color:#315e83}section{margin:32px 0}h3{margin:0 0 12px}@media(max-width:600px){body{font-size:13px}.grid{gap:5px}article{padding:5px}th,td{padding:5px}}</style><h1>Moon Sorceress: A / B / C thresholds</h1><p>A = 40% (thinner), B = 50% (current), C = 60% (thicker). Only the initial threshold changes; crop, blur, tracing and region-generation settings stay the same. No production asset is replaced. Colors show region IDs, which can change between variants; compare boundaries rather than matching colors.</p>${table}<p><a href="threshold-detail-comparison.png">Open detail comparison sheet</a> | <a href="../index.html">Original numbered baseline</a></p>${detailHtml}${stageHtml}`);
fs.writeFileSync(path.join(directory, 'comparison.json'), JSON.stringify(rows, null, 2) + '\n');
fs.writeFileSync(path.join(directory, 'README.md'), `# Moon Sorceress threshold comparison\n\nOpen [index.html](index.html) for aligned A/B/C previews and close-ups, or [the comparison sheet](threshold-detail-comparison.png).\n\n- **a-**: 40%, generally thinner ink.\n- **b-**: 50%, current production baseline.\n- **c-**: 60%, generally thicker ink.\n\nStages retain their original numbers. Shared stages 01-04 are in the parent folder; each variant has its own 05-13 files, settings, and numbered gallery. The detail crops are taken from stage 07, a direct high-resolution render of stage 06's traced ink. Colors in region previews are diagnostic IDs and need not correspond between variants.\n\n| Variant | Threshold | Ink paths | Closed ink contours | Regions |\n| --- | --- | --- | --- | --- |\n${rows.map(r => `| ${r.prefix[0].toUpperCase()} | ${r.threshold}% | ${r.inkPaths} | ${r.inkContours} | ${r.regionPaths} |`).join('\n')}\n\nReproduce all captures and comparisons from the repository root:\n\n\`\`\`sh\nnode scripts/compare-moon-thresholds.mjs --capture\n\`\`\`\n\nWithout \`--capture\`, the command only rebuilds comparison previews from existing captures. Production assets are unchanged.\n`);
console.table(rows);
