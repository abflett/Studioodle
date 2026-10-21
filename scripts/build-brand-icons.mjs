import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

// Brand.tsx owns the vector geometry; CSS owns both theme palettes.
const brand = await readFile('src/ui/Brand.tsx', 'utf8');
const css = await readFile('src/ui/styles.css', 'utf8');
const declarations = block => [...block.matchAll(/--brand-[\w-]+:\s*#[\da-f]+;/g)].map(m => m[0]).join('');
const light = declarations(css.split(":root[data-theme='dark']")[0]);
const dark = declarations(css.split(":root[data-theme='dark']")[1].split('* {')[0]);
if (!light || !dark) throw Error('Brand theme colors missing');
let svg = brand.match(/<svg[\s\S]*?<\/svg>/)[0]
  .replace('className="brand-icon" viewBox="0 0 180 180" aria-hidden="true"', 'xmlns="http://www.w3.org/2000/svg" viewBox="12 12 156 156"')
  .replaceAll('className=', 'class=')
  .replaceAll('strokeWidth=', 'stroke-width=')
  .replaceAll('strokeLinejoin=', 'stroke-linejoin=')
  .replaceAll('strokeLinecap=', 'stroke-linecap=')
  .replace('fill="currentColor"', 'fill="var(--brand-tile)"');
const style = `<style>:root{${light}}@media(prefers-color-scheme:dark){:root{${dark}}}</style>`;
await writeFile('public/favicon.svg', svg.replace(/(<svg[^>]+>)/, '$1' + style) + '\n');
const colors = Object.fromEntries([...light.matchAll(/(--brand-[\w-]+):\s*(#[\da-f]+);/g)].map(m => [m[1], m[2]]));
const rasterSource = svg.replace(/var\((--brand-[\w-]+)\)/g, (_, name) => colors[name]);
const temp = await mkdtemp(join(tmpdir(), 'studioodle-icons-'));
if (dirname(temp) !== tmpdir() || !basename(temp).startsWith('studioodle-icons-')) throw Error('Unexpected icon working directory');
try {
  const source = join(temp, 'brand.svg');
  const large = join(temp, 'brand.png');
  await writeFile(source, rasterSource);
  execFileSync('magick', ['-background', 'none', '-density', '600', source, '-resize', '1024x1024', '-depth', '8', large]);
  await mkdir('src-tauri/icons', { recursive: true });
  for (const [file, size] of [['public/apple-touch-icon.png', 180], ['src-tauri/icons/32x32.png', 32], ['src-tauri/icons/128x128.png', 128], ['src-tauri/icons/128x128@2x.png', 256]]) {
    execFileSync('magick', [large, '-resize', `${size}x${size}`, file]);
  }
  for (const [file, sizes] of [['public/favicon.ico', '48,32,16'], ['src-tauri/icons/icon.ico', '256,128,64,48,32,16']]) {
    execFileSync('magick', [large, '-define', `icon:auto-resize=${sizes}`, file]);
  }
  console.log('Updated theme-aware SVG favicon, touch icon, and desktop icon assets. No native build.');

} finally { await rm(temp, { recursive: true, force: true }); }
