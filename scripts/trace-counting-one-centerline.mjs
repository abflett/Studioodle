import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync, brotliCompressSync } from 'node:zlib';
const tool = process.env.AUTOTRACE_PATH ?? 'work/tools/autotrace-static.exe';
const out = 'art/vector-prototypes/counting-01';
const work = 'work/vector-counting-01';
fs.mkdirSync(work, { recursive: true });
execFileSync('magick', ['art/source/counting/01.png', '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-colorspace', 'Gray', '-blur', '0x0.6', '-threshold', '50%', `${work}/ink.pbm`]);
const report = [];
for (const [name, error, iterations] of [['centerline', 2, 4], ['centerline-smooth', 4, 8]]) {
  const raw = `${out}/${name}-raw.svg`;
  execFileSync(tool, [`${work}/ink.pbm`, '-centerline', '-background-color', 'FFFFFF', '-error-threshold', `${error}`, '-filter-iterations', `${iterations}`, '-output-file', raw]);
  const data = [...fs.readFileSync(raw, 'utf8').matchAll(/\sd="([^"]+)"/g)].map(m => m[1].replace(/-?\d*\.\d+/g, n => String(Math.round(Number(n) * 10) / 10)));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536"><g fill="none" stroke="black" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${data.map(d => `<path d="${d}"/>`).join('')}</g></svg>`;
  fs.writeFileSync(`${out}/${name}.svg`, svg);
  report.push({ name, error, iterations, strokeWidth: 12, curves: data.join('').match(/[Cc]/g)?.length ?? 0, lines: data.join('').match(/[Ll]/g)?.length ?? 0, bytes: Buffer.byteLength(svg), gzip: gzipSync(svg, { level: 9 }).length, brotli: brotliCompressSync(svg).length });
  execFileSync('magick', ['-background', 'white', '-density', '144', `${out}/${name}.svg`, '-resize', '512x768', `${work}/${name}.png`]);
}
fs.writeFileSync(`${out}/centerline-comparison.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
