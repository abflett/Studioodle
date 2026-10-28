import fs from 'node:fs/promises';
import { log } from 'node:console';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as L from 'lucide-react';
import { createServer } from 'vite';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'docs/icons');
const server = await createServer({ root, configFile: path.join(root,'vite/config.dev.ts'), server: { middlewareMode:true,hmr:false,ws:false,watch:null }, appType:'custom' });
const h=React.createElement, noop=()=>{};
const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const svgList=markup=>markup.match(/<svg\b[\s\S]*?<\/svg>/g)??[];
const source=name=>'src/ui/'+name+'.tsx';
const sections=[];
const group=(title,description,items)=>sections.push({title,description,items});
const icon=(label,name,file,props={})=>({label,source:file,glyph:renderToStaticMarkup(h(L[name],{size:26,...props})),kind:'line'});
const custom=(label,glyph,file,kind='line')=>({label,source:file,glyph,kind});
const image=(label,url,file,kind='image')=>({label,source:file,url:url.startsWith('/')?'../../'+url.slice(1):url,kind});
try {
  const load=file=>server.ssrLoadModule('/src/ui/'+file+'.tsx');
  const [{ColoringPageActionIcon},{LayerOrderIcon},{BrushPicker},{StickerFilters},{ColoringPagePicker},{PalettePicker},{PaperArtwork},{Brand},catalog,cursors,startup]=await Promise.all([
    load('ColoringPageActionIcon'),load('LayerOrderIcon'),load('BrushPicker'),load('StickerBrowser'),load('ColoringPagePicker'),load('PalettePicker'),load('PaperSetup'),load('Brand'),server.ssrLoadModule('/src/ui/stickerCatalog.ts'),server.ssrLoadModule('/src/ui/toolCursors.ts'),server.ssrLoadModule('/src/app/startup.ts')
  ]);
  const node=(Component,props={})=>renderToStaticMarkup(h(Component,props));
  group('01 · Main drawing ribbon','The ten controls used while drawing.',[
    ...[['Home','House'],['Pan / move page','Move'],['Zoom','ZoomIn'],['Select sticker','MousePointer2'],['Erase','Eraser'],['Brush','Brush'],['Fill','PaintBucket'],['Stickers','Shapes'],['Color palette','Palette'],['Undo','Undo2']].map(([label,name])=>icon(label,name,source('EditorPreview'))),
    custom('Palette + current ink dot',node(L.Palette,{size:26})+'<span class="ink-dot"></span>',source('EditorPreview'),'with-dot')
  ]);
  group('02 · Sticker selection drawer','Transformation and arrangement controls. Flip glyphs follow the current app mapping.',[
    ...[['Shrink','Minimize2'],['Grow','Maximize2'],['Rotate left','RotateCcw'],['Rotate right','RotateCw'],['Flip horizontally','FlipVertical2'],['Flip vertically','FlipHorizontal2']].map(([label,name])=>icon(label,name,source('StickerSelectionToolbar'))),
    custom('Move backward',node(LayerOrderIcon,{direction:'backward'}),source('LayerOrderIcon')),
    custom('Move forward',node(LayerOrderIcon,{direction:'forward'}),source('LayerOrderIcon')),
    ...[['Focus / refit','ScanSearch'],['Duplicate','Copy'],['Delete sticker','Trash2'],['Finish selection / focus','Check']].map(([label,name])=>icon(label,name,source('StickerSelectionToolbar')))
  ]);
  group('03 · Home, saved pictures and app entry','Library actions and native-window controls; artwork entry points are shown separately below.',[
    ...[['Previous picture','ArrowLeft'],['Next picture','ArrowRight'],['Settings','Settings'],['Exit','LogOut'],['Enter fullscreen','Fullscreen'],['Leave fullscreen','Minimize'],['Delete picture','Trash2'],['Export picture','Download'],['Undo delete','Undo2'],['Retry preview','RotateCw']].map(([label,name])=>icon(label,name,source('SelectionScreen'))),
    custom('Print picture','<svg viewBox="0 0 256 256" aria-hidden="true"><image href="../../art/source/interface/printer.svg" width="256" height="256" /></svg>',source('SelectionScreen')),
    custom('Add to coloring pages',node(ColoringPageActionIcon,{added:false}),source('ColoringPageActionIcon')),
    custom('Already added',node(ColoringPageActionIcon,{added:true}),source('ColoringPageActionIcon')),
    icon('Back to Studioodle','Play',source('App')),
    icon('Retry startup / saving','RotateCcw',source('App'))
  ]);
  group('04 · Shared overlay controls','Repeated meanings collected together; these also appear in many area-specific groups.',[
    icon('Close / dismiss / cancel','X',source('DialogHeader')),
    icon('Back','ArrowLeft',source('DialogHeader')),
    icon('Next / continue','ArrowRight',source('BlankPageSetup')),
    icon('Apply / done / selected','Check',source('CustomColorPicker')),
    icon('Previous page','ArrowLeft',source('StickerBrowser')),
    icon('Next page','ArrowRight',source('StickerBrowser'))
  ]);
  const brush=svgList(node(BrushPicker,{value:{tip:'round',size:5},onChange:noop,onClose:noop,headingRef:null}));
  if(brush.length<4)throw Error('Brush icon extraction failed');
  group('05 · Brush options','Exact current tip marks, plus size controls.',[
    ...['Round tip','Rising diagonal','Falling diagonal','Scattered-circle tip'].map((label,i)=>custom(label,brush[i],source('BrushPicker'))),
    icon('Smaller','Minus',source('BrushPicker')),icon('Larger','Plus',source('BrushPicker')),icon('Use brush','Check',source('BrushPicker'))
  ]);
  group('06 · Sticker subjects','Category icons only. No sticker artwork is included.',catalog.stickerCategories.map(category=>custom(category.title,node(category.icon), 'src/ui/stickerCatalog.ts')));
  const detail=svgList(node(StickerFilters,{onChange:noop}));
  group('07 · Sticker detail and ink','All / Easy / Medium / Detailed and the separate ink-color action.',[
    ...['All stickers','Easy detail','Medium detail','Detailed'].map((label,i)=>custom(label,detail[i],source('StickerBrowser'))),
    custom('Choose sticker ink',node(L.Palette,{size:26})+'<span class="ink-dot"></span>',source('EditorPreview'),'with-dot')
  ]);
  const pagesMarkup=node(ColoringPagePicker,{pages:[],bundledIds:new Set(),onClose:noop,onOpen:noop,onAdded:noop,onDelete:noop});
  const fromButton=label=>{
    const escaped=escape(label).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const body=new RegExp('<button\\b[^>]*aria-label="'+escaped+'"[^>]*>([\\s\\S]*?)<\\/button>').exec(pagesMarkup)?.[1];
    const svg=body&&svgList(body)[0];if(!svg)throw Error('Missing current page icon: '+label);return svg;
  };
  group('08 · Coloring-page categories and detail','Includes the custom Things and Learning drawings, plus current terrain glyphs.',[
    ...['All subjects','Characters','Animals','Places and Nature','Things: vehicles and objects','Letters and Numbers','Simple detail (toggle filter)','Medium detail (toggle filter)','High detail (toggle filter)'].map(label=>custom(label.replace(' (toggle filter)',''),fromButton(label),source('ColoringPagePicker')))
  ]);
  group('09 · Coloring-page browsing','View, favorites and page-library actions.',[
    ...[['Grid overview','LayoutGrid'],['Single page','Square'],['Favorites / favorite off','Heart']].map(([label,name])=>icon(label,name,source('ColoringPagePicker'))),
    icon('Favorite on','Heart',source('ColoringPagePicker'),{style:{fill:'currentColor'}}),
    ...[['Previous coloring page','ArrowLeft'],['Next coloring page','ArrowRight'],['Add coloring pages','FilePlus2'],['Share coloring page','FileUp'],['Delete custom page','Trash2']].map(([label,name])=>icon(label,name,source('ColoringPagePicker')))
  ]);
  group('10 · Page sharing and picture export','Same visual can serve different tasks; labels here record the current action.',[
    ...[['Preview pasted code','Clipboard'],['Copy page code','Copy'],['Download page file','Download'],['Open page file','Upload'],['Confirm page import','FilePlus2']].map(([label,name])=>icon(label,name,source('ColoringPageTransfer'))),
    ...[['PNG image','Image'],['SVG artwork','Shapes'],['PDF document','FileText'],['Download export','Download']].map(([label,name])=>icon(label,name,source('ExportPictureDialog')))
  ]);
  group('11 · Paper setup','The actual folded-paper artwork and orientation glyphs.',[
    ...[['A4','full'],['A5','half'],['4 × 6 inches','photo'],['6 × 6 inches','square']].map(([label,preset])=>custom(label,node(PaperArtwork,{preset,orientation:'portrait'}),source('PaperSetup'),'paper')),
    custom('Tall orientation','<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="1"/></svg>',source('PaperSetup')),
    custom('Wide orientation','<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="1"/></svg>',source('PaperSetup')),
    icon('Paper-size step','Copy',source('BlankPageSetup')),icon('Paper-color step','Palette',source('BlankPageSetup')),icon('Continue to color','ArrowRight',source('BlankPageSetup'))
  ]);
  const paletteProps={color:-1,custom:Array(32).fill(null),onChoose:noop,onEdit:noop,onClose:noop};
  const palette=svgList(node(PalettePicker,paletteProps));
  const customPalette=svgList(node(PalettePicker,{...paletteProps,custom:[0xdca9ba,0xb3c7a0,0x8aa6c9,...Array(29).fill(null)]}));
  group('12 · Color palettes and custom-color editing','Five palette families; Custom has both empty and populated states.',[
    ...['Everyday','Pastel','Vivid','Moody','Custom — empty'].map((label,i)=>custom(label,palette[i],source('PalettePicker'))),
    custom('Custom — populated',customPalette[4],source('PalettePicker')),
    icon('Edit custom palette','Pencil',source('PalettePicker')),icon('Finish palette editing','Check',source('PalettePicker')),
    icon('Apply custom color','Check',source('CustomColorPicker')),icon('Selected swatch','Check',source('PaperColorPicker'))
  ]);
  group('13 · Settings and feedback','Theme controls, preferences, loading and failure indicators.',[
    ...[['Follow system theme','Monitor'],['Light theme','Sun'],['Dark theme','Moon'],['Shortcut guide','Keyboard'],['Advanced settings','SlidersHorizontal'],['Open preferences','ChevronRight']].map(([label,name])=>icon(label,name,source('SelectionSettings'))),
    icon('Loading / busy','LoaderCircle',source('SavedPreview')),icon('Preview unavailable','ImageOff',source('SavedPreview')),icon('Confirm deletion','Trash2',source('DeletePictureDialog'))
  ]);
  const graphics=[...Object.entries(cursors.toolCursorGraphics),...Object.entries(cursors.draggingCursorGraphics).map(([name,g])=>['Dragging '+name,g]),...Object.entries(cursors.appCursorGraphics).map(([name,g])=>['App '+name,g])];
  group('14 · Pointer artwork','Current 40px cursor graphics, including drag and menu states. Paint accents use Classic blue for this reference.',graphics.map(([label,g])=>({label,source:'src/ui/toolCursors.ts',url:cursors.cursorImage(g,0x4892dc),kind:'cursor'})));
  group('15 · Illustrated entry points and brand','These are existing interface illustrations, not stickers. Background scenery and decorative paper-stack layers are outside this icon inventory.',[
    custom('Studioodle brand mark',svgList(node(Brand,{decorative:true}))[0],source('Brand'),'brand'),
    image('Start with blank paper',startup.pictureChoices[0].artwork,'src/app/startup.ts'),
    image('Open coloring book',startup.pictureChoices[1].artwork,'src/app/startup.ts'),
    image('Start drawing / coloring','/src/assets/interface/start-coloring.png','src/assets/interface/start-coloring.png','painted-action')
  ]);
  const imports=new Set();
  for(const file of await fs.readdir(path.join(root,'src/ui'))){if(!/\.(tsx|ts)$/.test(file))continue;const text=await fs.readFile(path.join(root,'src/ui',file),'utf8');for(const match of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g))for(const name of match[1].split(',')){const symbol=name.trim().split(/\s+as\s+/)[0];if(symbol&&symbol!=='type LucideIcon'&&symbol!=='LucideIcon')imports.add(symbol);}}
  // Keep the audit honest: every currently imported Lucide glyph must appear above.
  const serialized=JSON.stringify(sections);
  for(const name of imports){const marker='lucide-'+name.replace(/([a-z0-9])([A-Z])/g,'$1-$2').replace(/([A-Za-z])(\d)/g,'$1-$2').toLowerCase();if(!serialized.includes(marker))throw Error('Uncatalogued Lucide glyph: '+name);}
  const total=sections.reduce((n,g)=>n+g.items.length,0);
  const samples=item=>['light','dark'].map(theme=>`<div class="sample ${theme} ${item.kind}">${item.url?`<img src="${escape(item.url)}" alt="">`:item.glyph}</div>`).join('');
  const sectionHtml=sections.map((g,index)=>`<section id="group-${index+1}"><header class="group-heading"><h2>${escape(g.title)}</h2><p>${escape(g.description)}</p></header><div class="icon-grid">${g.items.map(item=>`<article class="icon-card"><div class="samples">${samples(item)}</div><h3>${escape(item.label)}</h3><a class="source" href="../../${escape(item.source)}">${escape(path.basename(item.source))}</a></article>`).join('')}</div></section>`).join('');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studioodle · Current icon inventory</title><link rel="stylesheet" href="inventory.css"></head><body><main><header class="page-heading"><p class="eyebrow">Studioodle / visual design reference</p><h1>Every current interface icon, in one place.</h1><p>${total} uses and states across ${sections.length} areas · ${imports.size} Lucide glyphs plus custom SVG, cursor and painted artwork · 29 October 2026</p><p>Each sample shows light and dark ink on fixed review surfaces. Repeated icons stay in their respective areas. These are the current drawings, not redesigns; sample tiles are for comparison, not proposed button styling.</p><nav>${sections.map((g,i)=>`<a href="#group-${i+1}">${escape(g.title.split(' · ')[1])}</a>`).join('')}</nav></header>${sectionHtml}<section class="directions" id="directions"><header class="group-heading"><h2>Imagegen direction studies</h2><p>Representative controls only. Concept art, not production replacements. <a href="directions/README.md">Prompts and notes</a></p></header><div class="direction-grid"><a href="directions/01-enchanted-ink.png"><img loading="lazy" src="directions/01-enchanted-ink.png" alt="Enchanted ink direction"><strong>A · Enchanted ink</strong></a><a href="directions/02-paper-charms.png"><img loading="lazy" src="directions/02-paper-charms.png" alt="Paper charms direction"><strong>B · Paper charms</strong></a><a href="directions/03-gentle-gesture.png"><img loading="lazy" src="directions/03-gentle-gesture.png" alt="Gentle gesture direction"><strong>C · Gentle gesture</strong></a><a href="directions/04-watercolor-workshop.png"><img loading="lazy" src="directions/04-watercolor-workshop.png" alt="Watercolor workshop direction"><strong>D / Watercolor workshop</strong></a><a href="directions/05-handmade-keepsakes.png"><img loading="lazy" src="directions/05-handmade-keepsakes.png" alt="Handmade keepsakes direction"><strong>E / Handmade keepsakes</strong></a><a href="directions/06-gouache-daydream.png"><img loading="lazy" src="directions/06-gouache-daydream.png" alt="Gouache daydream direction"><strong>F / Gouache daydream</strong></a><a href="directions/07-folded-storybook.png"><img loading="lazy" src="directions/07-folded-storybook.png" alt="Folded storybook direction"><strong>G / Folded storybook</strong></a></div><p>Paper Charms is selected. <a href="paper-charms/printer-study/index.html">Review the single smooth SVG printer study before expanding the set.</a></p></section><footer>Generated from current app components. Rebuild with <code>node docs/icons/build-inventory.mjs</code>. Sticker art and decorative scenery are intentionally excluded.</footer></main></body></html>`;
  await fs.writeFile(path.join(output,'index.html'),html);
  log(`Saved docs/icons/index.html: ${total} icon uses/states, ${sections.length} groups, ${imports.size} Lucide glyphs.`);
} finally {await server.close();}
