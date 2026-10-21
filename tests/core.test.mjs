import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let server, createRepository, createBridge, createColoringPage, outputTitle, EditorSession;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', plugins: [{
    name: 'session-artwork-double', enforce: 'pre',
    resolveId(source, importer) {
      if (source === './Artwork' && importer?.replaceAll('\\', '/').endsWith('/src/editor/EditorSession.ts'))
        return fileURLToPath(new URL('./fixtures/artwork.mjs', import.meta.url));
    },
  }], optimizeDeps: { noDiscovery: true, include: [] } });
  ({ createLocalTemplateRepository: createRepository } = await server.ssrLoadModule('/src/platform/localTemplateRepository.ts'));
  ({ createEditorBridge: createBridge } = await server.ssrLoadModule('/src/editor/bridge.ts'));
  ({ createColoringPage } = await server.ssrLoadModule('/src/editor/coloringPage.ts'));
  ({ EditorSession } = await server.ssrLoadModule('/src/editor/EditorSession.ts'));
  ({ outputTitle } = await server.ssrLoadModule('/src/editor/pictureTitles.ts'));
});
after(async () => { await server?.close(); });

function fixture(id = 'picture-1') {
  return {
    id, version: 5, title: 'Blank Page', format: 'landscape',
    size: { width: 32, height: 24 }, background: '#ffffff', leafColor: 0x242428, updatedAt: 1,
    document: { version: 5, width: 32, height: 24, surfaces: [
      { id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff },
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
  const pages = createRepository(() => store);
  return { store, pages };
}

test('current template keys round-trip and deletion removes the template', () => {
  const { store, pages } = library();
  const page = fixture();pages.save(page);
  assert.deepEqual(JSON.parse(store.getItem('studioodle.v5.coloring.picture-1')), page);
  assert.deepEqual(pages.load(), [page]);pages.delete(page.id);
  assert.deepEqual(pages.load(), []);
});

test('corrupt, foreign and mismatched records do not hide valid pages', () => {
  const { store, pages } = library();
  pages.save(fixture());
  store.setItem('studioodle.v5.coloring.bad-json', '{');
  store.setItem('studioodle.v5.coloring.null', 'null');
  store.setItem('studioodle.v5.coloring.wrong-id', JSON.stringify(fixture('another-id')));
  store.setItem('unrelated', JSON.stringify(fixture('other')));
  assert.deepEqual(pages.load(), [fixture()]);
});

test('validation rejects unsafe geometry, obsolete paint fields and unsupported stickers', () => {
  const changes = [
    p => { p.size.width = 0; },
    p => { p.document.width++; },
    p => { p.document.surfaces[0].flipX = true; },
    p => { p.document.surfaces[0].paint = [[0, 99999999, 0]]; },
    p => { p.document.surfaces[0].paint = [[4, 2, 0], [5, 2, 0]]; },
    p => { p.document.surfaces.push({ ...p.document.surfaces[0] }); },
    p => { p.document.surfaces.push({ id: 'unknown', kind: 'not-a-sticker', x: 1, y: 1, color: 0 }); },
    p => { p.version = 2; },
  ];
  for (const change of changes) {
    const { pages } = library(); const picture = fixture(); change(picture);
    pages.save(picture);
    assert.deepEqual(pages.load(), []);
  }
});

test('library normalizes titles and sorts newest first', () => {
  const { pages } = library();
  pages.save({ ...fixture('older'), title: 'sunny beach day' });
  pages.save({ ...fixture('newer'), updatedAt: 2 });
  assert.deepEqual(pages.load().map(p => p.id), ['newer', 'older']);
  assert.equal(pages.load()[1].title, 'Sunny Beach Day');
});

test('storage is resolved lazily and failures propagate for UI recovery', () => {
  const repository = createRepository(() => { throw new Error('Storage unavailable'); });
  assert.throws(() => repository.load(), /Storage unavailable/);
  assert.throws(() => repository.save(fixture()), /Storage unavailable/);
  assert.throws(() => repository.delete('id'), /Storage unavailable/);
});

test('custom coloring pages preserve transforms but clear paint without changing the source', () => {
  const source = fixture(); source.background = '#123456';
  source.document.surfaces[0].vectorPaint = {version:1,regions:[{id:1,base:0xff0000,blobs:[]}]};
  source.document.surfaces.push({ id: 'animal', kind: 'animal-lion', x: 5, y: 10, scale: .5, rotation: 90, flipX: true, color: 0x123456 });
  const original = structuredClone(source);
  const page = createColoringPage(source, 'My Template');
  assert.notEqual(page.id, source.id);
  assert.equal(page.background, '#ffffff');
  assert.deepEqual(page.document.surfaces[1], { ...source.document.surfaces[1], color: 0 });
  assert.equal(page.document.surfaces[0].vectorPaint, undefined);
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

test('worker fill queues following brush input, save and undo in order', async () => {
  const {editor,saved}=session(),before=editor.artwork.serialize();
  const original=editor.artwork.fill.bind(editor.artwork);let complete;
  editor.artwork.fill=(...args)=>new Promise(resolve=>{complete=()=>resolve(original(...args));});
  editor.execute({type:'set-tool',tool:'bucket'});
  editor.execute({type:'fill-at',point:{x:2,y:2}});
  editor.artwork.fill=original;
  editor.execute({type:'set-tool',tool:'brush'});
  editor.begin({x:3,y:3},1,0);editor.move({x:6,y:6},1,true,1);editor.release({x:6,y:6},1,1);
  editor.execute({type:'save',onComplete:()=>{}});
  editor.execute({type:'undo'});
  assert.deepEqual(editor.artwork.serialize(),before);assert.equal(saved.length,0);
  complete();await new Promise(resolve=>editor.execute({type:'snapshot',onComplete:resolve}));
  assert.equal(saved.length,1);
  assert.ok(saved[0].document.surfaces[0].vectorPaint.regions[0].blobs.length>1);
  assert.equal(editor.artwork.serialize().surfaces[0].vectorPaint.regions[0].blobs.length,1);
  editor.execute({type:'undo'});assert.deepEqual(editor.artwork.serialize(),before);
});

test('session saves through its port and reports a failed save without changing the artwork', async () => {
  const { editor, saved } = session(); let succeeded;
  await new Promise(resolve=>editor.execute({ type: 'save', onComplete: value => { succeeded = value; resolve(); } }));
  assert.equal(succeeded, true); assert.equal(saved[0].id, 'picture-1');
  const failing = new EditorSession(fixture(), { save() { throw new Error('Disk full'); }, changed() {} });
  await new Promise(resolve=>failing.execute({ type: 'save', onComplete: value => { succeeded = value; resolve(); } }));
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
  source.document.surfaces.push({id:'moon',kind:'fantasy-moon-sorceress',x:10,y:10,color:0,vectorPaint:{version:1,regions:[{id:1,base:0x773399,blobs:[]}]}});
  const page=createColoringPage(source,'Clean');
  assert.equal(page.document.surfaces[1].vectorPaint,undefined);
  assert.equal(source.document.surfaces[1].vectorPaint.regions[0].base,0x773399);
});


test('current vector pages round-trip and obsolete formats are ignored', () => {
  const {pages}=library();
  const first=fixture('first');const vector=fixture('vector');
  vector.version=5;vector.document.version=5;
  vector.document.surfaces.push({id:'moon',kind:'fantasy-moon-sorceress',x:10,y:10,color:0,vectorPaint:{version:1,regions:[{id:1,base:0x773399,blobs:[]}]}});
  pages.save(first);pages.save(vector);
  const loaded=pages.load();
  assert.equal(loaded.length,2);
  assert.deepEqual(loaded.find(p=>p.id==='vector'),vector);
  assert.deepEqual(loaded.find(p=>p.id==='first'),first);
});


test('late UI subscriptions receive the current session state', () => {
 const bridge=createBridge();
 bridge.toolChanged('select');bridge.focusChanged('moon');bridge.selectionChanged('moon',{forward:false,backward:true});
 let tool,focus,selection;
 bridge.onTool(value=>{tool=value;});bridge.onFocus(value=>{focus=value;});bridge.onSelection((id,order)=>{selection={id,order};});
 assert.equal(tool,'select');assert.equal(focus,'moon');assert.deepEqual(selection,{id:'moon',order:{forward:false,backward:true}});
});

test('disposing a session drops queued commands and late asynchronous fill notifications', async () => {
 let notifications=0,complete,saves=0;
 const editor=new EditorSession(fixture(),{save(){saves++;},changed(){notifications++;}});
 editor.artwork.fill=()=>new Promise(resolve=>{complete=resolve;});
 editor.execute({type:'fill-at',point:{x:2,y:2}});
 editor.execute({type:'save',onComplete:()=>{throw Error('Disposed save must not run');}});
 const before=notifications;editor.dispose();complete(true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(notifications,before);assert.equal(saves,0);
});

test('save completion waits for asynchronous storage and reports rejection', async()=>{
 const {editor}=session();let release,completed;
 const failing=new EditorSession(fixture(),{save:()=>new Promise((_,reject)=>{release=reject;}),changed(){}});
 failing.execute({type:'save',onComplete:value=>{completed=value;}});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(completed,undefined);release(new Error('Quota exceeded'));
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(completed,false);
 editor.dispose();failing.dispose();
});
