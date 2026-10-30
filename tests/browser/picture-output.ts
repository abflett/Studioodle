import { Artwork } from '../../src/editor/Artwork';
import { downloadFile } from '../../src/platform/downloadFile';
import { pictureFile, printPicture } from '../../src/app/pictureOutput';
import { exportDimensions } from '../../src/editor/exportResolution';
import { pictureSvg } from '../../src/editor/pictureSvg';
import { renderPicture } from '../../src/editor/renderPicture';
import { prepareStickers, vectorDefinition } from '../../src/editor/vectorStickers';
import type { EditorSetup } from '../../src/editor/setup';
import type { SurfaceData } from '../../src/editor/document';
import { rectangleGeometry } from '../../src/editor/vectorPaintStyles';

function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
const base64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = ''; for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
};
async function raster(svg: SVGSVGElement, width: number, height: number) {
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d')!.drawImage(image, 0, 0, width, height); return canvas;
  } finally { URL.revokeObjectURL(url); }
}
export async function checkPictureOutput() {
  await prepareStickers(['fantasy-moon-sorceress', 'circle']);
  const moon = vectorDefinition('fantasy-moon-sorceress');
  const surfaces: SurfaceData[] = [{ id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xf6f2e8,
    vectorPaint: { version: 1, regions: [{ id: 1, base: 0xb7d8e8, pattern: { pattern: 'stripes', spacing: 20 }, blobs: [
      { color: 0x763baa, geometry: [[[[10,10],[100,10],[100,100],[10,100],[10,10]], [[30,30],[30,80],[80,80],[80,30],[30,30]]]] },
      { color: 0x31adac, pattern: { pattern: 'dots', spacing: 12 }, geometry: rectangleGeometry(400, 10, 490, 100) },
      { color: 0x996020, pattern: { pattern: 'checker', spacing: 12 }, geometry: rectangleGeometry(400, 300, 490, 390) },
    ] }] } }, ...[0,1].map((i): SurfaceData => ({ id: `moon-${i}`, kind: 'fantasy-moon-sorceress', color: i ? 0x58295c : 0x242428,
      x: i ? 365 : 130, y: 220, scale: .7, rotation: i ? 12 : -12, flipX: !!i, flipY: !!i,
      vectorPaint: { version: 1, regions: moon.regions.map((region, index) => ({ id: region.id,
        base: [0xffee88, 0x6e3ba4, 0xf0c79c, 0x56afcf][index % 4]!,
        pattern: index % 7 === 0 ? { pattern: 'dots', spacing: 8 } : undefined,
        blobs: index % 5 ? [] : [{ color: 0x3b2058, geometry: rectangleGeometry(region.bounds[0]!, region.bounds[1]!, (region.bounds[0]!+region.bounds[2]!)/2, region.bounds[3]!) }],
      })) },
    })), { id: 'circle', kind: 'circle', x: 250, y: 40, scale: .3, color: 0x443355 }];
  const picture: EditorSetup = { title: 'Vector output <test> & curves', format: 'landscape', size: { width: 500, height: 400 }, background: '#f6f2e8', leafColor: 0,
    document: { version: 6, width: 500, height: 400, surfaces } };
  const before = JSON.stringify(picture);
  const svg = await pictureSvg(picture);
  assert(!svg.querySelector('image, foreignObject'), 'SVG output must be vector-only and self-contained');
  const ids = [...svg.querySelectorAll('[id]')].map(node => node.id);
  assert(ids.length === new Set(ids).size, 'Repeated stickers must have unique clip and region IDs');
  assert(svg.querySelector('title')!.textContent === picture.title, 'SVG titles must be escaped as text');
  for (const node of svg.querySelectorAll('*')) for (const attribute of [...node.attributes]) {
    for (const match of attribute.value.matchAll(/url\(#([^)]*)\)/g)) assert(ids.includes(match[1]!), `Missing vector clip/pattern ${match[1]}`);
  }
  const actual = await raster(svg, 500, 400), reference = await renderPicture(picture, 96);
  const a = actual.getContext('2d')!.getImageData(0,0,500,400).data, b = reference.getContext('2d')!.getImageData(0,0,500,400).data;
  let error = 0, different = 0;
  for (let i=0; i<a.length; i+=4) { let pixel = 0; for (let c=0;c<4;c++) { const diff = Math.abs(a[i+c]!-b[i+c]!); error += diff; pixel = Math.max(pixel,diff); } if(pixel>32)different++; }
  const meanError = error/a.length, differentFraction = different/(500*400);
  const pdf = await pictureFile(picture, 'pdf');
  assert((await pdf.slice(0,5).text()) === '%PDF-', 'PDF export must produce a PDF document');
  assert(!/\/Subtype\s*\/Image\b/.test(await pdf.text()), 'PDF export must contain vectors, not image snapshots');
  const png = await pictureFile(picture, 'png', 150);
  const pngImage = await createImageBitmap(png);
  assert(pngImage.width === 782 && pngImage.height === 625, 'PNG must retain 150 DPI output dimensions'); pngImage.close();
  const highResolution = await pictureFile(picture, 'png');
  const highImage = await createImageBitmap(highResolution);
  assert(highImage.width === 1563 && highImage.height === 1250, 'Default PNG export must render vectors at 300 DPI'); highImage.close();
  const bytes = new Uint8Array(await highResolution.arrayBuffer()), view = new DataView(bytes.buffer);
  let density = 0;
  for (let offset=8; offset+12<=bytes.length; offset+=view.getUint32(offset)+12) {
    if (String.fromCharCode(...bytes.subarray(offset+4,offset+8)) === 'pHYs') density = view.getUint32(offset+8);
  }
  assert(density === Math.round(300/.0254), 'PNG metadata must match the selected rendering DPI');
  assert(!exportDimensions({ ...picture, document: undefined, size: { width: 10000, height: 10000 } }, 600).fits, 'Oversized raster exports must retain a pixel budget');
  const originalCreate = document.createElement, originalRender = Artwork.prototype.render;
  let failedCanvas: HTMLCanvasElement | undefined;
  document.createElement = new Proxy(originalCreate, { apply(target, receiver, args) {
    const node = Reflect.apply(target, receiver, args); if (args[0] === 'canvas') failedCanvas = node; return node;
  } });
  Artwork.prototype.render = () => { throw Error('Injected export render failure'); };
  try {
    let failed = false;try { await renderPicture(picture,96); } catch { failed = true; }
    assert(failed && failedCanvas?.width === 1 && failedCanvas.height === 1, 'Failed exports must release their temporary pixel backing');
  } finally { document.createElement = originalCreate; Artwork.prototype.render = originalRender; }
  assert(JSON.stringify(picture) === before, 'Export must not mutate saved paint');

  // Real print adapter, without invoking an OS dialog in automated tests.
  const originalOpen = window.open, preview = document.implementation.createHTMLDocument();
  let printed = 0, printError = false;
  window.open = (() => ({ document: preview, closed: false, opener: null, focus() {}, close() {}, print() { printed++; },
    requestAnimationFrame(callback: FrameRequestCallback) { callback(performance.now()); return 0; },
  })) as typeof window.open;
  try {
    printPicture(picture, () => { printError = true; });
    for (let i=0; i<500 && !printed && !printError; i++) await new Promise(resolve => setTimeout(resolve,20));
    assert(printed === 1 && !printError, `Printing must complete using the vector preview (printed=${printed}, error=${printError}, svg=${!!preview.querySelector('svg')})`);
    assert(preview.querySelector('svg path') && !preview.querySelector('img, canvas, image'), 'Print preview must contain inline vectors, no raster snapshot');
    const lazy = document.implementation.createHTMLDocument(); let finish!: (picture: EditorSetup) => void, lazyPrinted = 0;
    const source = new Promise<EditorSetup>(resolve => { finish = resolve; });
    window.open = (() => ({ document: lazy, closed: false, opener: null, focus() {}, close() {}, print() { lazyPrinted++; }, requestAnimationFrame(callback: FrameRequestCallback) { callback(performance.now()); return 0; } })) as typeof window.open;
    printPicture(() => source, () => { printError = true; }, picture.title);
    assert(lazy.querySelector('button') && !lazy.querySelector('svg'), 'Print window must open synchronously before a lazily loaded drawing is available');
    finish(picture);
    for (let i = 0; i < 500 && !lazyPrinted && !printError; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert(lazyPrinted === 1 && !printError, 'Lazy drawing must print after loading');
  } finally { window.open = originalOpen; }
  window.open = (() => null) as typeof window.open;
  try { printError = false; printPicture(picture, () => { printError = true; }); assert(printError, 'Blocked print windows must report an error'); }
  finally { window.open = originalOpen; }
  window.open = (() => { throw Error('Popup unavailable'); }) as typeof window.open;
  try { printError = false; printPicture(picture, () => { printError = true; }); assert(printError, 'Throwing popup APIs must report a print error'); }
  finally { window.open = originalOpen; }
  window.open = (() => ({ document: document.implementation.createHTMLDocument(), closed: false, opener: null, focus() {}, close() {},
    print(): void { throw Error('Print unavailable'); }, requestAnimationFrame(callback: FrameRequestCallback) { return window.setTimeout(() => callback(performance.now()),0); },
  })) as typeof window.open;
  try {
    printError = false;printPicture(picture, () => { printError = true; });
    for(let i=0;i<1000&&!printError;i++)await new Promise(resolve=>setTimeout(resolve,10));
    assert(printError, 'Asynchronous print failures must reach the UI rather than escape as runtime errors');
  } finally { window.open = originalOpen; }
  const originalClick=HTMLAnchorElement.prototype.click, originalRevoke=URL.revokeObjectURL;
  let revoked=0;const anchors=document.querySelectorAll('a[download]').length;
  HTMLAnchorElement.prototype.click=()=>{throw Error('Download unavailable');};
  URL.revokeObjectURL=url=>{revoked++;originalRevoke.call(URL,url);};
  try {
    let failed=false;try{downloadFile(new Blob(['test']), 'test.txt');}catch{failed=true;}
    assert(failed && revoked===1 && document.querySelectorAll('a[download]').length===anchors, 'Failed downloads must release their URL and temporary link');
  } finally { HTMLAnchorElement.prototype.click=originalClick;URL.revokeObjectURL=originalRevoke; }
  return { printHtml: preview.documentElement.outerHTML, svg: new XMLSerializer().serializeToString(svg), pdf: await base64(pdf), actualPng: actual.toDataURL(), referencePng: reference.toDataURL(),
    meanError, differentFraction, pdfBytes: pdf.size, pngBytes: png.size, vectorPrint: true, blockedPrint: true, printFailure: true, downloadCleanup: true, failedRenderCleanup: true };
}
