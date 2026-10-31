import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createSsrServer } from '../scripts/lib/ssr-server.mjs';
let server, palette, Artwork, EditorSession, validation;
const OriginalPath = globalThis.Path2D;
before(async () => {
  globalThis.Path2D = class { rect() {} };
  server = await createSsrServer();
  palette = await server.ssrLoadModule('/src/editor/colorPalettes.ts');
  ({ Artwork } = await server.ssrLoadModule('/src/editor/Artwork.ts'));
  ({ EditorSession } = await server.ssrLoadModule('/src/editor/EditorSession.ts'));
  ({ isSavedPicture: validation } = await server.ssrLoadModule('/src/editor/pictureValidation.ts'));
});
after(async () => { await server?.close(); if (OriginalPath === undefined) delete globalThis.Path2D; else globalThis.Path2D = OriginalPath; });

test('versioned palettes have 128 fixed slots and 32 initially empty custom slots', () => {
  assert.equal(palette.paletteVersion, 1);
  assert.deepEqual(palette.fixedPalettes.map(p => p.colors.length), [32,32,32,32]);
  assert.deepEqual(palette.emptyCustomColors(), Array(32).fill(null));
  for (let slot=0;slot<128;slot++) assert.equal(palette.resolveColor(palette.slotColor(slot)), palette.fixedPalettes[Math.floor(slot/32)].colors[slot%32]);
  assert.throws(() => palette.resolveColor(palette.slotColor(128)));
  assert.equal(palette.definedColor(-161, []), false);
});

test('custom edits use tiny undo records and detached table checkpoints without touching geometry', async () => {
  const art = Artwork.create(100,100,'#ffffff');
  art.beginChange(); art.setCustomColor(0,0x3366cc); const assignment = art.endChange();
  assert.deepEqual([...assignment.colors], [[0,null]]);
  art.brush({x:20,y:20},{x:70,y:20},palette.slotColor(128),false,{size:12,tip:'round'});
  await art.compactPaint();
  const before = art.serialize(), checkpoint = art.checkpoint();
  art.beginChange(); art.setCustomColor(0,0x33aa66); const edit = art.endChange();
  assert.equal(edit.regions.size,0); assert.equal(edit.surfaces.size,0); assert.equal(edit.colors.size,1);
  assert.equal(edit.resources().geometry.size,0);
  assert.deepEqual(art.serialize().surfaces,before.surfaces);
  assert.equal((await checkpoint.compact()).customColors[0],0x3366cc);
  assert.equal(art.serialize().customColors[0],0x33aa66);
  art.undoChange(edit); assert.deepEqual(art.serialize(),before);
  const restored = Artwork.restore(before);
  assert.equal(restored.customColors[0],0x3366cc);
  assert.notStrictEqual(restored.customColors,art.customColors);
  restored.dispose(); art.dispose();
});

test('equal RGB custom slots remain distinct through worker compaction and subsequent edits', async () => {
  const art=Artwork.create(100,100,'#ffffff');
  art.setCustomColor(0,0x3366cc);art.setCustomColor(1,0x3366cc);
  for(const [slot,y] of [[128,20],[129,60]])art.brush({x:20,y},{x:70,y},palette.slotColor(slot),false,{size:12,tip:'round'});
  await art.compactPaint();
  const colors=art.serialize().surfaces[0].vectorPaint.regions[0].blobs.map(b=>b.color);
  assert.deepEqual(new Set(colors),new Set([palette.slotColor(128),palette.slotColor(129)]));
  art.setCustomColor(0,0xff0000);
  assert.equal(palette.resolveColor(palette.slotColor(129),art.customColors),0x3366cc);
  art.dispose();
});

test('custom assignment/edit/undo autosave and invalid references are rejected', async () => {
  const saves=[];
  const session=new EditorSession({id:'palette-session',title:'Blank Page',format:'landscape',size:{width:100,height:100},background:'#ffffff',leafColor:0}, {autoSave:true,save:picture=>{saves.push(picture);},changed:()=>{}});
  session.execute({type:'set-custom-color',index:0,color:0x3366cc});
  session.execute({type:'set-color',color:palette.slotColor(128)});
  session.execute({type:'set-custom-color',index:0,color:0xff0000});
  session.execute({type:'undo'});
  assert.equal(session.customColors[0],0x3366cc);
  assert.ok(saves.some(s=>s.document.customColors[0]===0xff0000));
  assert.equal(saves.at(-1).document.customColors[0],0x3366cc);
  assert.equal(validation(saves.at(-1)),true);
  const invalid=structuredClone(saves.at(-1));invalid.document.paletteVersion=2;
  assert.equal(validation(invalid),false);
  invalid.document.paletteVersion=1;invalid.document.customColors[0]=null;
  invalid.document.surfaces[0].vectorPaint={version:1,regions:[{id:1,base:palette.slotColor(128),blobs:[]}]};
  assert.equal(validation(invalid),false);
  session.execute({type:'undo'});
  assert.equal(session.customColors[0],null);
  assert.equal(session.activeColor,palette.slotColor(0));
  session.dispose();
});
