import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const layout = fs.readFileSync('src/editor/gardenScene.ts', 'utf8').split('export const')[0];
let body = '<rect width="1536" height="1024" fill="white"/>';
for (const [, name, xs, ys] of layout.matchAll(/\['(garden-[a-z-]+)', (\d+), (\d+)\]/g)) {
  const svg = fs.readFileSync(`src/assets/stickers/${name}.svg`, 'utf8');
  const [, ws, hs] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const x = Number(xs) - Math.floor(Number(ws) / 2), y = Number(ys) - Math.floor(Number(hs) / 2);
  body += `<g transform="translate(${x} ${y})">${svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replaceAll('#39483e', 'black')}</g>`;
}
fs.mkdirSync('work/garden', { recursive: true });
fs.writeFileSync('work/garden/scene.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" shape-rendering="crispEdges">${body}</svg>`);
execFileSync('magick', ['work/garden/scene.svg', '-threshold', '50%', 'work/garden/scene.png']);
