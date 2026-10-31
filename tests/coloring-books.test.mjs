import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createSsrServer } from '../scripts/lib/ssr-server.mjs';
let server, domain, pages, sharing, favorites, browsing, layoutKey;
before(async () => {
  server = await createSsrServer();
  domain = await server.ssrLoadModule('/src/editor/coloringBook.ts');
  ({ coloringPageLayoutKey: layoutKey } = await server.ssrLoadModule('/src/editor/coloringPageLayout.ts'));
  sharing = await server.ssrLoadModule('/src/app/coloringPageSharing.ts');
  favorites = await server.ssrLoadModule('/src/platform/pageFavorites.ts');
  browsing = await server.ssrLoadModule('/src/app/coloringPageBrowsing.ts');
  ({ coloringPages: pages } = await server.ssrLoadModule('/src/app/coloringPages.ts'));
});
after(async () => { await server?.close(); });

test('bundled collection shares the portable format and stable IDs', () => {
  const book = domain.makeColoringBook('Collection', pages);
  assert.deepEqual(domain.parseColoringBook(JSON.stringify(book)), book);
  assert.ok(pages.length > 0);
  assert.equal(new Set(pages.map(p => p.id)).size, pages.length);
});

test('book pages remove paint and paper color while preserving sticker ink and geometry', () => {
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
    assert.equal(s.vectorPaint, undefined); assert.equal(s.color, i === 0 ? 0xffffff : source.document.surfaces[i].color);
    assert.deepEqual([s.kind,s.x,s.y,s.scale,s.rotation,s.flipX,s.flipY], [source.document.surfaces[i].kind,source.document.surfaces[i].x,source.document.surfaces[i].y,source.document.surfaces[i].scale,source.document.surfaces[i].rotation,source.document.surfaces[i].flipX,source.document.surfaces[i].flipY]);
  }
  assert.deepEqual(source, before);
});

test('imports reject unsupported versions, duplicate IDs, missing stickers and unsafe geometry', () => {
  const mutations = [b=>b.version=1, b=>b.pages.push(b.pages[0]), b=>b.pages[0].id='../bad', b=>b.pages[0].document.surfaces[1].kind='unknown-sticker', b=>b.pages[0].document.surfaces[1].scale=-1, b=>b.pages[0].document.width++, b=>b.pages[0].document.version=4];
  for (const change of mutations) { const book = domain.makeColoringBook('Test', pages); change(book); assert.throws(() => domain.parseColoringBook(JSON.stringify(book))); }
  assert.throws(()=>domain.parseColoringBook('{'));
});





test('browsing metadata survives sharing and rejects invalid filter values', () => {
  for (const page of pages) {
    assert.ok(page.browse.categories.length); assert.ok(page.browse.detail);
    assert.deepEqual(domain.parseColoringBook(JSON.stringify(domain.makeColoringBook('Browse', [page]))).pages[0].browse, page.browse);
  }
  const bad = domain.makeColoringBook('Bad', [pages[0]]); bad.pages[0].browse.categories = ['invented'];
  assert.throws(() => domain.parseColoringBook(JSON.stringify(bad)));
  const custom = structuredClone(pages[0]); delete custom.browse;
  assert.ok(browsing.pageInfo(custom).categories.includes('nature'));
});

test('sharing code preserves Unicode, ink and transforms without paint and imports independent copies', () => {
  const source = structuredClone(pages[0]);
  Object.assign(source.document.surfaces[1], { rotation: 37, scale: 0.75, flipX: true, flipY: true, color: 0xff0000,
    vectorPaint: { version: 1, regions: [{ id: 1, base: 0xff0000, blobs: [] }] } });
  const book = domain.makeColoringBook('Coloring', [{...source, title: 'A snowman \u2603'}]);
  const code = sharing.pageSharingCode(book);
  assert.deepEqual(sharing.parsePageSharingCode(code), book);
  assert.throws(() => sharing.parsePageSharingCode(JSON.stringify(book)));
  const wire = JSON.parse(Buffer.from(code.split(':')[2], 'base64').toString('utf8'));
  assert.equal(code.startsWith('studioodle-page:4:'), true);
  assert.equal(/"(color|background|leafColor|vectorPaint|paint|updatedAt)":/.test(JSON.stringify(wire)), false);
  for (const mutate of [w => w.pages[0].surfaces[1].kind = 'missing-sticker', w => w.pages[0].surfaces[1].scale = -1, w => w.pages[0].size.width = -1, ...[-161, 0x1000000, 1.5, null, 'red'].map(color => w => { w.pages[0].surfaces[1].inkColor = color; })]) {
    const invalid = structuredClone(wire); mutate(invalid);
    assert.throws(() => sharing.parsePageSharingCode('studioodle-page:4:' + Buffer.from(JSON.stringify(invalid)).toString('base64')));
  }
  assert.equal(wire.pages[0].surfaces[1].inkColor, 0xff0000);
  assert.equal(wire.pages[0].surfaces[0].inkColor, undefined);
  for (const mutate of [w => w.pages[0].paletteVersion = 2, w => w.pages[0].customColors = [], w => w.pages[0].customColors[0] = -1]) {
    const invalid = structuredClone(wire); mutate(invalid);
    assert.throws(() => sharing.parsePageSharingCode('studioodle-page:4:' + Buffer.from(JSON.stringify(invalid)).toString('base64')));
  }
  const noInk = structuredClone(wire); delete noInk.pages[0].surfaces[1].inkColor;
  assert.equal(sharing.parsePageSharingCode('studioodle-page:4:' + Buffer.from(JSON.stringify(noInk)).toString('base64')).pages[0].document.surfaces[1].color, 0);
  const copy = sharing.independentPages(book);
  assert.notEqual(copy.pages[0].id, book.pages[0].id);
  assert.deepEqual(copy.pages[0].document, book.pages[0].document);
  assert.throws(() => sharing.parsePageSharingCode('studioodle-page:2:%%%'));
  assert.throws(() => sharing.parsePageSharingCode('unrecognized'));
});

test('favorite storage preserves prior values on failed writes and reports corrupt data', () => {
  let data = null, fail = false;
  const store = favorites.createPageFavorites(() => ({getItem: () => data, setItem: (_, text) => { if (fail) throw Error('Quota'); data = text; }}));
  store.save(['winter', 'winter', 'beach']); assert.deepEqual(store.load(), ['winter','beach']);
  fail = true; assert.throws(() => store.save([])); assert.deepEqual(store.load(), ['winter','beach']);
  data = '{}'; assert.throws(() => store.load());
});




test('added-page identity ignores paint and storage metadata but tracks every exported layout property', () => {
  const original = structuredClone(pages[0]), key = layoutKey(original);
  const painted = structuredClone(original);
  painted.id = 'another'; painted.title = 'Another title'; painted.updatedAt++;
  painted.background = '#ff0000'; painted.leafColor = 0xff0000;
  painted.document.surfaces[0].color = 0xff0000;
  for (const s of painted.document.surfaces) {
    s.id = 'copy-' + s.id;
    s.vectorPaint = { version: 1, regions: [{ id: 1, base: 0x123456, blobs: [] }] };
  }
  assert.equal(layoutKey(painted), key);
  for (const [field, value] of [['x', 123.25], ['y', 456.5], ['color', 0x123456], ['scale', 1.234], ['rotation', 17], ['flipX', true], ['flipY', true], ['kind', 'circle']]) {
    const changed = structuredClone(original); changed.document.surfaces[1][field] = value;
    assert.notEqual(layoutKey(changed), key, field);
  }
  const reordered = structuredClone(original); reordered.document.surfaces.reverse();
  assert.notEqual(layoutKey(reordered), key, 'Sticker layer order');
  const resized = structuredClone(original); resized.size.width++;
  assert.notEqual(layoutKey(resized), key, 'Paper dimensions');
});


test('page identity tracks linked ink slots as well as their resolved colors', () => {
  const first = structuredClone(pages[0]);
  first.document.customColors = Array(32).fill(null);
  first.document.customColors[0] = first.document.customColors[1] = 0x3366cc;
  first.document.surfaces[1].color = -129;
  const second = structuredClone(first); second.document.surfaces[1].color = -130;
  assert.notEqual(layoutKey(first), layoutKey(second));
  const edited = structuredClone(first); edited.document.customColors[0] = 0xff0000;
  assert.notEqual(layoutKey(first), layoutKey(edited));
  const unused = structuredClone(first); unused.document.customColors[1] = 0xff0000;
  assert.equal(layoutKey(first), layoutKey(unused));
});
