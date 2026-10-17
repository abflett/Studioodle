// Conversion-only experiment. Does not replace the current runtime sticker.
import fs from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const potrace = process.env.POTRACE_PATH ?? 'work/tools/potrace/potrace-1.16.win64/potrace.exe';
const out = 'art/vector-prototypes/counting-01';
const work = 'work/vector-counting-01';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(work, { recursive: true });
// Trace the full-resolution original, flattening transparency onto white so the
// faint generated halo cannot become ink. No native-size pixel mask is traced.
execFileSync('magick', ['art/source/counting/01.png', '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-colorspace', 'Gray', '-blur', '0x0.6', '-threshold', '50%', `${work}/ink.pbm`]);
const profiles = [
  { name: 'stress-gentle', alpha: 1.334, tolerance: 4 },
  { name: 'stress-bold', alpha: 1.334, tolerance: 12 },
  { name: 'stress-extreme', alpha: 1.334, tolerance: 40 },
];
const report = [];
for (const profile of profiles) {
  const file = `${out}/${profile.name}.svg`;
  execFileSync(potrace, [`${work}/ink.pbm`, '--svg', '--output', file, '--turdsize', '8', '--alphamax', `${profile.alpha}`, '--opttolerance', `${profile.tolerance}`]);
  let svg = fs.readFileSync(file, 'utf8');
  // Use pixel dimensions and retain the original viewBox/registration.
  svg = svg.replace(/width="([\d.]+)pt"/, 'width="$1"').replace(/height="([\d.]+)pt"/, 'height="$1"');
  fs.writeFileSync(file, svg);
  const paths = [...svg.matchAll(/<path\s+d="([^"]+)"/g)].map(match => match[1]);
  let curves = 0, lines = 0, contours = 0;
  for (const path of paths) {
    for (const match of path.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)) {
      const count = (match[2].match(/[-+]?(?:\d*\.\d+|\d+)/g) ?? []).length;
      switch (match[1].toLowerCase()) {
        case 'c': curves += count / 6; break;
        case 'l': lines += count / 2; break;
        case 'm': contours++; lines += Math.max(0, count / 2 - 1); break;
      }
    }
  }
  report.push({ ...profile, paths: paths.length, contours, cubicSegments: curves, lineSegments: lines, bytes: Buffer.byteLength(svg), gzip: gzipSync(svg, { level: 9 }).length, brotli: brotliCompressSync(svg).length });
  // Supersampling is for a display preview only, never region ID data.
  execFileSync('magick', ['-background', 'white', '-density', '144', file, '-resize', '512x768', `${work}/${profile.name}.png`]);
}
fs.writeFileSync(`${out}/stress-comparison.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
