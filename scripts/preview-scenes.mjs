// Offline artwork composition review, independent of app/browser tests.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const out = 'work/hybrid/scenes'; fs.mkdirSync(out, { recursive: true });
const requested = process.argv.slice(2);
const catalog = JSON.parse(fs.readFileSync('src/assets/vector/catalog.json', 'utf8'));
for (const name of requested.length ? requested : ['garden','counting','spring','beach','winter','safari']) {
  if (!['garden','counting','spring','beach','winter','safari'].includes(name)) throw new Error(`Unknown scene: ${name}`);
  const source = fs.readFileSync(`src/editor/${name}Scene.ts`, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const module = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  const scene = module[`${name}Scene`], doc = scene.document;
  const scale = Math.min(1123 / doc.width, 794 / doc.height);
  const dx = (1123 - doc.width * scale) / 2, dy = (794 - doc.height * scale) / 2;
  doc.surfaces = doc.surfaces.map(s => s.kind === 'canvas' ? s : ({...s, x: s.x * scale + dx, y: s.y * scale + dy, scale: (s.scale ?? 1) * scale}));
  doc.width = 1123; doc.height = 794;
  let body = `<rect width="${doc.width}" height="${doc.height}" fill="${scene.background}"/>`;
  for (const surface of doc.surfaces.slice(1)) {
    const definition = catalog[surface.kind];
    const prefix = `instance-${surface.id}-`;
    const svg = fs.readFileSync(`src/assets/vector/${surface.kind}.svg`, 'utf8').replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`).replace(/url\(#([^)]*)\)/g, (_, id) => `url(#${prefix}${id})`);
    body += `<g transform="translate(${surface.x} ${surface.y}) rotate(${surface.rotation??0}) scale(${(surface.scale??1)*(surface.flipX?-1:1)} ${(surface.scale??1)*(surface.flipY?-1:1)}) translate(${-Math.floor(definition.width/2)} ${-Math.floor(definition.height/2)})">${svg}</g>`;
  }
  fs.writeFileSync(`${out}/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}">${body}</svg>`);
  execFileSync('magick', [`${out}/${name}.svg`, '-resize', '1200x800', `${out}/${name}.png`]);
  console.log(`Rendered ${scene.title}`);
}
