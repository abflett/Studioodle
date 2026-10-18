// Compose the supplied crater line art into an open-edged lunar background.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const work = 'work/hybrid'; fs.mkdirSync(work, { recursive: true });
const source = 'art/source/space/crater.jpg';
const run = (...args) => execFileSync('magick', args, { maxBuffer: 64e6 });
const [width, height] = run('identify', '-format', '%w %h', source).toString().split(' ').map(Number);
run(source, '-colorspace', 'Gray', '-blur', '0x0.12', '-threshold', '50%', `${work}/crater-source.pbm`);
execFileSync(process.env.POTRACE_PATH ?? 'work/tools/potrace/potrace-1.16.win64/potrace.exe', [`${work}/crater-source.pbm`, '-s', '-a', '1.2', '-O', '.125', '-t', '2', '-o', `${work}/crater-source.svg`]);
const traced = fs.readFileSync(`${work}/crater-source.svg`, 'utf8');
// Potrace emits M/m, L/l, H/h, V/v, C/c, and Z/z. Flatten those to logical
// coordinates so the regular authored-SVG pipeline needs no nested transforms.
function flatten(d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g);
  let i = 0, command, x = 0, y = 0, startX = 0, startY = 0; const out = [];
  const point = (px, py) => `${+(256 + px * .1).toFixed(3)} ${+(140 + height - py * .1).toFixed(3)}`;
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
    const upper = command.toUpperCase(), relative = command !== upper;
    if (upper === 'Z') { out.push('Z'); x = startX; y = startY; command = undefined; continue; }
    const arity = { M: 2, L: 2, H: 1, V: 1, C: 6 }[upper];
    if (!arity) throw new Error(`Unsupported Potrace command: ${command}`);
    const v = tokens.slice(i, i + arity).map(Number); i += arity;
    if (upper === 'H') { x = v[0] + (relative ? x : 0); out.push('L' + point(x, y)); continue; }
    if (upper === 'V') { y = v[0] + (relative ? y : 0); out.push('L' + point(x, y)); continue; }
    const pairs = [];
    for (let n = 0; n < arity; n += 2) pairs.push([v[n] + (relative ? x : 0), v[n + 1] + (relative ? y : 0)]);
    [x, y] = pairs.at(-1);
    out.push(upper + pairs.map(([px, py]) => point(px, py)).join(' '));
    if (upper === 'M') { startX = x; startY = y; command = relative ? 'l' : 'L'; }
  }
  return out.join(' ');
}
if (width !== 1408 || height !== 768) throw new Error('Reframe the crater composition for this source size.');
const ink = [...traced.matchAll(/<path\s+d="([^"]+)"/g)].map(m => `<path fill="black" stroke="none" d="${flatten(m[1])}"/>`).join('');
const horizon = 'M0 70C330 20 640 110 960 70S1570 25 1920 70';
const rocks = [[85,280,28],[1775,380,36],[120,650,23],[1760,780,26],[420,1075,30],[1450,1110,22]].map(([x,y,r]) => `<path stroke-width="3.5" d="M${x-r} ${y}l${r*.4} ${-r*.6} ${r} ${-r*.2} ${r*.7} ${r*.7} ${-r*.3} ${r*.6} ${-r} ${r*.1}Z"/>`).join('');
// Continue cracks that meet the source edge so the composition has no cut-paper box.
const gray = run(source, '-colorspace', 'Gray', '-threshold', '50%', '-depth', '8', 'gray:-');
const extensions = [];
function edge(length, sample, make) {
  for (let i = 2; i < length - 2;) {
    if (sample(i) > 127) { i++; continue; }
    const start = i; while (i < length - 2 && sample(i) < 128) i++;
    extensions.push(`<path fill="none" stroke-width="2.5" d="${make((start+i-1)/2)}"/>`);
  }
}
edge(height, y => gray[Math.round(y)*width], y => `M256 ${140+y}q-60 -8 -125 18`);
edge(height, y => gray[Math.round(y)*width+width-1], y => `M1664 ${140+y}q60 8 125 -18`);
edge(width, x => gray[(height-1)*width+Math.round(x)], x => `M${256+x} 908q-15 55 22 110`);
fs.writeFileSync('art/source/space/crater-horizon.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1440"><g fill="white" stroke="black" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="${horizon}V1440H0Z"/><path fill="none" d="${horizon}"/>${rocks}${extensions.join('')}${ink}</g></svg>`);
console.log('Created crater horizon from the supplied line art.');
