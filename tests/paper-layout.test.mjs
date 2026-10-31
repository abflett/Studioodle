import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createSsrServer } from '../scripts/lib/ssr-server.mjs';

let server, paperSize, presetSize;
before(async () => {
  server = await createSsrServer();
  ({ paperSize } = await server.ssrLoadModule('/src/editor/document.ts'));
  ({ presetSize } = await server.ssrLoadModule('/src/editor/paperPresets.ts'));
});
after(async () => { await server?.close(); });

test('new-page fallback is normalized while physical authoring presets retain 96 units per inch', () => {
  assert.deepEqual(presetSize('full', 'portrait'), { width: 794, height: 1123 });
  assert.deepEqual(presetSize('full', 'landscape'), { width: 1123, height: 794 });
  assert.deepEqual(paperSize('portrait'), {width:1000,height:1414});
  assert.deepEqual(paperSize('landscape'), {width:1414,height:1000});
  const square = paperSize('square'); assert.equal(square.width, square.height);
  assert.deepEqual(paperSize('portrait', { width: 320, height: 500 }), { width: 320, height: 500 });
});

test('every bundled coloring page uses matching A4 document and page dimensions', async () => {
  const book = JSON.parse(await readFile(new URL('../src/assets/coloringBook.json', import.meta.url), 'utf8'));
  assert.ok(book.pages.length > 0);
  for (const page of book.pages) {
    assert.deepEqual(page.size, presetSize('full', page.format), page.title);
    assert.equal(page.document.width, page.size.width, page.title);
    assert.equal(page.document.height, page.size.height, page.title);
  }
});

test('display documents normalize the shorter side and preserve useful ratio labels',async()=>{
 const {blankPageSize,aspectRatioLabel,normalizedPageSize}=await server.ssrLoadModule('/src/editor/paperPresets.ts');
 assert.deepEqual(blankPageSize('display','landscape',{width:1920,height:1080}),{width:1778,height:1000});
 assert.deepEqual(blankPageSize('display','portrait',{width:3840,height:2160}),{width:1000,height:1778});
 assert.deepEqual(blankPageSize('display','square',{width:1920,height:1080}),{width:1000,height:1000});
 assert.deepEqual(blankPageSize('full','portrait',{width:1,height:1}),{width:1000,height:1414});
 assert.equal(aspectRatioLabel({width:1920,height:1080},'landscape'),'16:9');
 assert.equal(aspectRatioLabel({width:1920,height:1080},'portrait'),'9:16');
 assert.equal(aspectRatioLabel({width:1366,height:768},'landscape'),'16:9');
 assert.equal(aspectRatioLabel({width:1920,height:1080},'square'),'1:1');
 assert.deepEqual(normalizedPageSize({width:0,height:NaN},'landscape'),{width:1333,height:1000});
 assert.deepEqual(normalizedPageSize({width:100000,height:1},'landscape'),{width:8192,height:1000});
});

test('square pages are independent of the remembered paper preset',async()=>{
 const {paperPresets,blankPageSize,presetMillimeters}=await server.ssrLoadModule('/src/editor/paperPresets.ts');
 for(const {id} of paperPresets){
  assert.deepEqual(blankPageSize(id,'square',{width:1920,height:1080}),{width:1000,height:1000});
  assert.deepEqual(presetMillimeters(id,'square'),{width:210,height:210});
 }
});

test('physical output size is independent of normalized vector coordinates',async()=>{
 const {exportDimensions,defaultExportDpi}=await server.ssrLoadModule('/src/editor/exportResolution.ts');
 const {isSavedPicture}=await server.ssrLoadModule('/src/editor/pictureValidation.ts');
 const {makeColoringBook}=await server.ssrLoadModule('/src/editor/coloringBook.ts');
 const {pageSharingCode,parsePageSharingCode}=await server.ssrLoadModule('/src/editor/pageSharing.ts');
 const picture={id:'normalized',title:'A4',version:6,updatedAt:1,format:'portrait',size:{width:1000,height:1414},printSizeMm:{width:210,height:297},background:'#ffffff',leafColor:0,document:{version:6,width:1000,height:1414,surfaces:[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff}]}};
 assert.equal(defaultExportDpi,300);assert(isSavedPicture(picture));
 assert.deepEqual(exportDimensions(picture,300),{width:2481,height:3508,fits:true});
 assert.equal(exportDimensions(picture,600).width,4961);
 assert(!isSavedPicture({...picture,printSizeMm:{width:Infinity,height:297}}));
 assert(!isSavedPicture({...picture,printSizeMm:{width:210,height:210}}));
 assert.deepEqual(parsePageSharingCode(pageSharingCode(makeColoringBook('Book',[picture]))).pages[0].printSizeMm,picture.printSizeMm);
});

test('device display size takes precedence, with a window and final ratio fallback',async()=>{
 const {readDisplaySize}=await server.ssrLoadModule('/src/ui/useDisplayPage.ts');
 assert.deepEqual(readDisplaySize({screen:{width:1920,height:1080},innerWidth:800,innerHeight:600}),{width:1920,height:1080});
 assert.deepEqual(readDisplaySize({screen:{width:0,height:0},innerWidth:800,innerHeight:600}),{width:800,height:600});
 assert.deepEqual(readDisplaySize({innerWidth:0,innerHeight:0}),{width:4,height:3});
});
