import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
let server, domain, createStore, pages;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  domain = await server.ssrLoadModule('/src/editor/coloringBook.ts');
  ({ createLocalColoringBook: createStore } = await server.ssrLoadModule('/src/platform/localColoringBook.ts'));
  ({ coloringPages: pages } = await server.ssrLoadModule('/src/app/coloringPages.ts'));
});
after(async () => { await server?.close(); });

test('bundled collection shares the portable format and stable IDs', () => {
  const book = domain.makeColoringBook('Collection', pages);
  assert.deepEqual(domain.parseColoringBook(JSON.stringify(book)), book);
  assert.ok(pages.length > 0);
  assert.equal(new Set(pages.map(p => p.id)).size, pages.length);
});

test('book pages remove paint and colors while preserving exact geometry and source', () => {
  const source = structuredClone(pages[0]);
  source.background = '#ff0000'; source.leafColor = 0xff0000;
  source.document.surfaces[1].vectorPaint = {version:1,regions:[{id:1,base:0xff0000,blobs:[]}]};
  source.document.surfaces[1].color = 0xff0000;
  source.document.surfaces[1].flipX = true;
  const before = structuredClone(source);
  const page = domain.coloringBookPage(source, 'revised', ' Revised Page ');
  assert.equal(page.id, 'revised'); assert.equal(page.title, 'Revised Page');
  assert.equal(page.background, '#ffffff');
  for (const [i, s] of page.document.surfaces.entries()) {
    assert.equal(s.vectorPaint, undefined); assert.equal(s.color, i === 0 ? 0xffffff : 0);
    assert.deepEqual([s.kind,s.x,s.y,s.scale,s.rotation,s.flipX,s.flipY], [source.document.surfaces[i].kind,source.document.surfaces[i].x,source.document.surfaces[i].y,source.document.surfaces[i].scale,source.document.surfaces[i].rotation,source.document.surfaces[i].flipX,source.document.surfaces[i].flipY]);
  }
  assert.deepEqual(source, before);
});

test('imports reject unsupported versions, duplicate IDs, missing stickers and unsafe geometry', () => {
  const mutations = [b=>b.version=1, b=>b.pages.push(b.pages[0]), b=>b.pages[0].id='../bad', b=>b.pages[0].document.surfaces[1].kind='unknown-sticker', b=>b.pages[0].document.surfaces[1].scale=-1, b=>b.pages[0].document.width++, b=>b.pages[0].document.version=4];
  for (const change of mutations) { const book = domain.makeColoringBook('Test', pages); change(book); assert.throws(() => domain.parseColoringBook(JSON.stringify(book))); }
  assert.throws(()=>domain.parseColoringBook('{'));
});

test('local imports replace revisions by stable ID, append new pages and write atomically', () => {
  let data = null, fail = false;
  const store = createStore(() => ({ getItem: () => data, setItem: (_, text) => { if (fail) throw Error('Quota'); data = text; } }));
  store.merge(domain.makeColoringBook('First', [pages[0]]));
  store.merge(domain.makeColoringBook('Second', [{...pages[0],title:'Revised'}, {...pages[1],id:'new-page'}]));
  assert.deepEqual(store.load().pages.map(p=>[p.id,p.title]), [[pages[0].id,'Revised'],['new-page',pages[1].title]]);
  const before = data; fail = true;
  assert.throws(()=>store.merge(domain.makeColoringBook('Failed', [pages[2]]))); assert.equal(data,before);
  fail = false; store.delete('new-page'); assert.equal(store.load().pages.length,1);
});

test('corrupt workshop storage is reported without silently overwriting revisions', () => {
  let writes = 0; const store = createStore(() => ({ getItem: () => '{', setItem: () => writes++ }));
  assert.throws(()=>store.load()); assert.throws(()=>store.merge(domain.makeColoringBook('Test',pages))); assert.equal(writes,0);
});
