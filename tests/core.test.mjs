import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let server, createRepository, createBridge, createColoringPage, outputTitle, EditorSession;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', plugins: [{
    name: 'session-artwork-double', enforce: 'pre',
    resolveId(source, importer) {
      if (source === './Artwork' && importer?.replaceAll('\\', '/').endsWith('/src/editor/EditorSession.ts'))
        return fileURLToPath(new URL('./fixtures/artwork.mjs', import.meta.url));
    },
  }], optimizeDeps: { noDiscovery: true, include: [] } });
  ({ createLocalPictureRepository: createRepository } = await server.ssrLoadModule('/src/platform/localPictureRepository.ts'));
  ({ createEditorBridge: createBridge } = await server.ssrLoadModule('/src/editor/bridge.ts'));
  ({ createColoringPage } = await server.ssrLoadModule('/src/editor/coloringPage.ts'));
  ({ EditorSession } = await server.ssrLoadModule('/src/editor/EditorSession.ts'));
  ({ outputTitle } = await server.ssrLoadModule('/src/editor/pictureTitles.ts'));
});
after(async () => { await server?.close(); });

function fixture(id = 'picture-1') {
  return {
    id, version: 3, title: 'Blank Page', format: 'landscape',
    size: { width: 32, height: 24 }, background: '#ffffff', leafColor: 0x242428, updatedAt: 1,
    document: { version: 3, width: 32, height: 24, surfaces: [
      { id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff, paint: [] },
    ] },
  };
}

function storage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
}

function library() {
  const store = storage();
  const pictures = createRepository('studioodle.v3.picture.', () => store);
  const pages = createRepository('studioodle.v3.coloring.', () => store);
  return { store, pictures, pages };
}

test('existing v3 keys round-trip and picture/template libraries stay isolated', () => {
  const { store, pictures, pages } = library();
  const picture = fixture();
  pictures.save(picture); pages.save({ ...picture, title: 'Template' });
  assert.deepEqual(JSON.parse(store.getItem('studioodle.v3.picture.picture-1')), picture);
  assert.deepEqual(pictures.load(), [picture]);
  assert.equal(pages.load()[0].title, 'Template');
  pictures.delete(picture.id);
  assert.deepEqual(pictures.load(), []);
  assert.equal(pages.load().length, 1);
});

test('corrupt, foreign and mismatched records do not hide valid pictures', () => {
  const { store, pictures } = library();
  pictures.save(fixture());
  store.setItem('studioodle.v3.picture.bad-json', '{');
  store.setItem('studioodle.v3.picture.null', 'null');
  store.setItem('studioodle.v3.picture.wrong-id', JSON.stringify(fixture('another-id')));
  store.setItem('unrelated', JSON.stringify(fixture('other')));
  assert.deepEqual(pictures.load(), [fixture()]);
});

test('validation rejects unsafe geometry, paint runs and unsupported stickers', () => {
  const changes = [
    p => { p.size.width = 0; },
    p => { p.document.width++; },
    p => { p.document.surfaces[0].flipX = true; },
    p => { p.document.surfaces[0].paint = [[0, 99999999, 0]]; },
    p => { p.document.surfaces[0].paint = [[4, 2, 0], [5, 2, 0]]; },
    p => { p.document.surfaces.push({ ...p.document.surfaces[0] }); },
    p => { p.document.surfaces.push({ id: 'unknown', kind: 'not-a-sticker', x: 1, y: 1, color: 0, paint: [] }); },
    p => { p.version = 2; },
  ];
  for (const change of changes) {
    const { pictures } = library(); const picture = fixture(); change(picture);
    pictures.save(picture);
    assert.deepEqual(pictures.load(), []);
  }
});

test('library normalizes titles and sorts newest first', () => {
  const { pictures } = library();
  pictures.save({ ...fixture('older'), title: 'sunny beach day' });
  pictures.save({ ...fixture('newer'), updatedAt: 2 });
  assert.deepEqual(pictures.load().map(p => p.id), ['newer', 'older']);
  assert.equal(pictures.load()[1].title, 'Sunny Beach Day');
});

test('storage is resolved lazily and failures propagate for UI recovery', () => {
  const repository = createRepository('pictures.', () => { throw new Error('Storage unavailable'); });
  assert.throws(() => repository.load(), /Storage unavailable/);
  assert.throws(() => repository.save(fixture()), /Storage unavailable/);
  assert.throws(() => repository.delete('id'), /Storage unavailable/);
});

test('custom coloring pages preserve transforms but clear paint without changing the source', () => {
  const source = fixture(); source.background = '#123456';
  source.document.surfaces[0].paint = [[0, 2, 0xff0000]];
  source.document.surfaces.push({ id: 'animal', kind: 'animal-lion', x: 5, y: 10, scale: .5, rotation: 90, flipX: true, color: 0x123456, paint: [[0, 3, 0xabcdef]] });
  const original = structuredClone(source);
  const page = createColoringPage(source, 'My Template');
  assert.notEqual(page.id, source.id);
  assert.equal(page.background, '#ffffff');
  assert.deepEqual(page.document.surfaces[1], { ...source.document.surfaces[1], color: 0, paint: [] });
  assert.deepEqual(page.document.surfaces[0].paint, []);
  assert.deepEqual(source, original);
});

test('blank output names are stable per picture while named pages retain their title', () => {
  const picture = fixture();
  assert.match(outputTitle(picture), /^Picture \d{6}$/);
  assert.equal(outputTitle(picture), outputTitle({ ...picture }));
  assert.notEqual(outputTitle(picture), outputTitle(fixture('different')));
  assert.equal(outputTitle({ ...picture, title: 'safari watering hole' }), 'Safari Watering Hole');
});

test('bridge sends initial state, suppresses unchanged redraws and publishes real changes', () => {
  const bridge = createBridge(); const tools = [], selections = [], focuses = [];
  bridge.onTool(tool => tools.push(tool));
  bridge.onFocus(id => focuses.push(id));
  bridge.onSelection((id, order) => selections.push({ id, order }));
  for (let i = 0; i < 3; i++) {
    bridge.toolChanged('bucket'); bridge.focusChanged();
    bridge.selectionChanged(undefined, { forward: false, backward: false });
  }
  assert.deepEqual(tools, ['bucket']); assert.deepEqual(focuses, [undefined]); assert.equal(selections.length, 1);
  bridge.toolChanged('select'); bridge.focusChanged('lion');
  bridge.selectionChanged('lion', { forward: false, backward: true });
  bridge.selectionChanged('lion', { forward: true, backward: true });
  assert.deepEqual(tools, ['bucket', 'select']); assert.deepEqual(focuses, [undefined, 'lion']); assert.equal(selections.length, 3);
});

test('bridge commands are synchronous and removed subscriptions stay removed', () => {
  const bridge = createBridge(); const seen = [];
  const stop = bridge.subscribe(command => seen.push(command.type));
  bridge.send({ type: 'undo' }); assert.deepEqual(seen, ['undo']);
  stop(); stop(); bridge.send({ type: 'exit-focus' }); assert.deepEqual(seen, ['undo']);
  let tools = 0; const stopTool = bridge.onTool(() => tools++);
  stopTool(); bridge.toolChanged('brush'); assert.equal(tools, 0);
});

function session() {
  const saved = [];
  const editor = new EditorSession(fixture(), { save: p => saved.push(p), changed() {} });
  return { editor, saved };
}

test('session saves through its port and reports a failed save without changing the artwork', () => {
  const { editor, saved } = session(); let succeeded;
  editor.execute({ type: 'save', onComplete: value => { succeeded = value; } });
  assert.equal(succeeded, true); assert.equal(saved[0].id, 'picture-1');
  const failing = new EditorSession(fixture(), { save() { throw new Error('Disk full'); }, changed() {} });
  failing.execute({ type: 'save', onComplete: value => { succeeded = value; } });
  assert.equal(succeeded, false); assert.deepEqual(failing.artwork.serialize(), fixture().document);
});

test('session records a multi-sample stroke as one undo and restores cancelled gesture history', () => {
  const { editor } = session();
  const before = editor.artwork.serialize();
  editor.execute({ type: 'set-tool', tool: 'erase' });
  editor.begin({ x: 1, y: 1 }, 1, 0);
  editor.move({ x: 2, y: 2 }, 1, true, 1);
  editor.release({ x: 2, y: 2 }, 1, 1);
  assert.notDeepEqual(editor.artwork.serialize(), before);
  const committed = editor.artwork.serialize();
  editor.begin({ x: 4, y: 4 }, 1, 0);
  editor.move({ x: 5, y: 5 }, 1, true, 1);
  editor.execute({ type: 'cancel-input' });
  assert.deepEqual(editor.artwork.serialize(), committed);
  editor.execute({ type: 'undo' }); assert.deepEqual(editor.artwork.serialize(), before);
});

test('focused session blocks structural edits and prevents undo crossing the focus boundary', () => {
  const { editor } = session();
  editor.execute({ type: 'add-sticker', sticker: 'animal-lion', outlineColor: 0, point: { x: 5, y: 5 } });
  editor.execute({ type: 'focus-selection', onFocus() {} });
  const focused = editor.artwork.serialize();
  for (const type of ['delete-selection', 'duplicate-selection', 'clear-selection', 'undo']) editor.execute({ type });
  assert.deepEqual(editor.artwork.serialize(), focused);
  editor.execute({ type: 'fill-at', point: { x: 1, y: 1 } });
  assert.notDeepEqual(editor.artwork.serialize(), focused);
  editor.execute({ type: 'undo' }); assert.deepEqual(editor.artwork.serialize(), focused);
  editor.execute({ type: 'exit-focus' }); editor.execute({ type: 'undo' });
  assert.equal(editor.artwork.serialize().surfaces.length, 1);
});

test('flipping through the session is undoable and releases do not paint with another pointer', () => {
  const { editor } = session();
  editor.execute({ type: 'add-sticker', sticker: 'animal-lion', outlineColor: 0, point: { x: 5, y: 5 } });
  const before = editor.artwork.serialize();
  editor.execute({ type: 'flip-selection', axis: 'horizontal' });
  assert.equal(editor.artwork.serialize().surfaces[1].flipX, true);
  editor.execute({ type: 'undo' }); assert.deepEqual(editor.artwork.serialize(), before);
  editor.execute({ type: 'set-tool', tool: 'erase' });
  editor.begin({ x: 1, y: 1 }, 1, 0);
  const pressed = editor.artwork.serialize();
  editor.move({ x: 3, y: 3 }, 2, true, 1); editor.release({ x: 3, y: 3 }, 2, 1);
  assert.deepEqual(editor.artwork.serialize(), pressed);
  editor.execute({ type: 'cancel-input' }); assert.deepEqual(editor.artwork.serialize(), before);
});

test('workshop snapshots read current geometry without saving or exporting editor metadata', () => {
  let saves = 0;
  const editor = new EditorSession({ ...fixture(), authoringPageId: 'winter' }, { save() { saves++; }, changed() {} });
  assert.equal(editor.state.tool, 'select');
  editor.execute({ type: 'add-sticker', sticker: 'animal-lion', outlineColor: 0, point: { x: 5, y: 5 } });
  let snapshot;
  editor.execute({ type: 'snapshot', onComplete: value => { snapshot = value; } });
  assert.equal(saves, 0);
  assert.equal(snapshot.id, fixture().id);
  assert.equal(snapshot.authoringPageId, undefined);
  assert.deepEqual(snapshot.document, editor.artwork.serialize());
  assert.equal(snapshot.document.surfaces.length, 2);
});


test('coloring page creation strips vector paint without mutating the saved drawing', () => {
  const source=fixture();
  source.document.surfaces.push({id:'moon',kind:'fantasy-moon-sorceress',x:10,y:10,color:0,paint:[],vectorPaint:{version:1,regions:[{id:1,base:0x773399,blobs:[]}]}});
  const page=createColoringPage(source,'Clean');
  assert.equal(page.document.surfaces[1].vectorPaint,undefined);
  assert.equal(source.document.surfaces[1].vectorPaint.regions[0].base,0x773399);
});


test('vector-painted v4 pictures round-trip beside existing v3 pictures', () => {
  const {pictures}=library();
  const raster=fixture('legacy');const vector=fixture('vector');
  vector.version=4;vector.document.version=4;
  vector.document.surfaces.push({id:'moon',kind:'fantasy-moon-sorceress',x:10,y:10,color:0,paint:[],vectorPaint:{version:1,regions:[{id:1,base:0x773399,blobs:[]}]}});
  pictures.save(raster);pictures.save(vector);
  const loaded=pictures.load();
  assert.equal(loaded.length,2);
  assert.deepEqual(loaded.find(p=>p.id==='vector'),vector);
  assert.deepEqual(loaded.find(p=>p.id==='legacy'),raster);
});
