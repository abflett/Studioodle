// Authoring experiment only: no runtime asset replacement.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { brotliCompressSync } from 'node:zlib';
const potrace = process.env.POTRACE_PATH ?? 'work/tools/potrace/potrace-1.16.win64/potrace.exe';
const out = 'art/vector-prototypes/pipeline';
const work = 'work/vector-pipeline';
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(work, { recursive: true });
const assets = [ ['beach-ball', 'art/source/beach/ball.png'], ['cottage', 'art/source/generated/house.png'], ['astronaut', 'art/source/counting/01.png'] ];
const profiles = [
  { name: 'light', smoothing: .04, alpha: 1.2, tolerance: .5 },
  { name: 'balanced', smoothing: .08, alpha: 1.3, tolerance: 1 },
  { name: 'strong', smoothing: .18, alpha: 1.334, tolerance: 2 },
];
const report = [];
for (const [name, source] of assets) {
  const gray = `${work}/${name}-gray.png`;
  execFileSync('magick', [source, '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-colorspace', 'Gray', gray]);
  const [width, height] = execFileSync('magick', ['identify', '-format', '%w %h', gray]).toString().split(' ').map(Number);
  const pixels = execFileSync('magick', [gray, '-depth', '8', 'gray:-'], { maxBuffer: 32e6 });
  // Estimate characteristic ink width from the modal short horizontal/vertical
  // run. This is a heuristic, not a thickness guarantee; retain it in the report.
  const histogram = new Uint32Array(Math.ceil(Math.min(width, height) * .04) + 1);
  function run(length) { if (length >= 3 && length < histogram.length) histogram[length]++; }
  for (let y = 0; y < height; y++) { let n = 0; for (let x = 0; x <= width; x++) { if (x < width && pixels[y * width + x] < 128) n++; else { run(n); n = 0; } } }
  for (let x = 0; x < width; x++) { let n = 0; for (let y = 0; y <= height; y++) { if (y < height && pixels[y * width + x] < 128) n++; else { run(n); n = 0; } } }
  let stroke = 3; for (let n = 4; n < histogram.length; n++) if (histogram[n] > histogram[stroke]) stroke = n;
  const previews = [];
  execFileSync('magick', [gray, '-resize', '440x470', '+repage', '-density', '72', '-gravity', 'center', '-background', 'white', '-extent', '460x540', '-font', 'Arial', '-pointsize', '20', '-gravity', 'south', '-annotate', '+0+10', 'Original raster', `${work}/${name}-original.png`]);
  previews.push(`${work}/${name}-original.png`);
  for (const p of profiles) {
    const sigma = Number((stroke * p.smoothing).toFixed(2));
    const tolerance = Number((p.tolerance * stroke / 12).toFixed(3));
    const speckle = Math.max(2, Math.round(8 * (stroke / 12) ** 2));
    const pbm = `${work}/${name}-${p.name}.pbm`, file = `${out}/${name}-${p.name}.svg`;
    execFileSync('magick', [gray, '-blur', `0x${sigma}`, '-threshold', '50%', pbm]);
    execFileSync(potrace, [pbm, '--svg', '--output', file, '--turdsize', `${speckle}`, '--alphamax', `${p.alpha}`, '--opttolerance', `${tolerance}`]);
    let svg = fs.readFileSync(file, 'utf8').replace(/width="([\d.]+)pt"/, 'width="$1"').replace(/height="([\d.]+)pt"/, 'height="$1"');
    fs.writeFileSync(file, svg);
    let curves = 0, contours = 0, lines = 0;
    for (const path of svg.matchAll(/<path\s+d="([^"]+)"/g)) for (const m of path[1].matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)) {
      const n = (m[2].match(/[-+]?(?:\d*\.\d+|\d+)/g) ?? []).length;
      if (m[1].toLowerCase() === 'c') curves += n / 6;
      if (m[1].toLowerCase() === 'l') lines += n / 2;
      if (m[1].toLowerCase() === 'm') { contours++; lines += Math.max(0, n / 2 - 1); }
    }
    report.push({ asset: name, profile: p.name, width, height, estimatedStroke: stroke, sigma, alpha: p.alpha, tolerance, speckle, curves, lines, contours, bytes: Buffer.byteLength(svg), brotli: brotliCompressSync(svg).length });
    const preview = `${work}/${name}-${p.name}.png`;
    execFileSync('magick', ['-background', 'white', '-density', '144', file, '-resize', '440x470', '+repage', '-density', '72', '-gravity', 'center', '-background', 'white', '-extent', '460x540', '-font', 'Arial', '-pointsize', '20', '-gravity', 'south', '-annotate', '+0+10', p.name, preview]);
    previews.push(preview);
  }
  execFileSync('magick', ['montage', ...previews, '-tile', '4x1', '-geometry', '+8+8', '-background', '#eeeeee', `${work}/${name}-comparison.png`]);
}
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
