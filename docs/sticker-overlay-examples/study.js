/* global URLSearchParams, location, document */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { X, ArrowLeft, ArrowRight, Palette } from 'lucide-react';
import { stickerCategories } from '../../src/ui/stickerCatalog';
import '@fontsource-variable/nunito';
const h = React.createElement;
function Study() {
  const [category, setCategory] = useState(null), [page, setPage] = useState(0), [colored, setColored] = useState(false);
  const [light, setLight] = useState(new URLSearchParams(location.search).get('theme') === 'light');
  const [closed, setClosed] = useState(false);
  const selected = stickerCategories.find(item => item.id === category);
  const pages = selected ? Math.ceil(selected.items.length / 12) : 1;
  const button = (label, content, onClick, props = {}) => h('button', { type: 'button', 'aria-label': label, title: label, onClick, ...props }, content);
  return h('main', { className: `study${light ? ' light' : ''}${new URLSearchParams(location.search).has('preview') ? ' preview' : ''}` },
    h('header', { className: 'review' }, h('div', null, h('strong', null, 'Stickers / study 01'), h('span', null, 'All categories together. Icons only. Keep the ink choice.')), button('Toggle light and dark theme', light ? 'Dark' : 'Light', () => setLight(!light))),
    closed ? button('Open sticker layout', 'Open stickers', () => setClosed(false), { className: 'reopen' }) :
      h('section', { className: 'panel', role: 'dialog', 'aria-labelledby': 'sticker-title' },
        h('header', { className: 'panel-top' }, h('h1', { id: 'sticker-title', className: 'sr-only' }, selected ? selected.title : 'Stickers'),
          selected && button('Back to categories', h(ArrowLeft), () => { setCategory(null); setPage(0); }, { className: 'utility back' }),
          button('Close stickers', h(X), () => setClosed(true), { className: 'utility close' })),
        h('div', { className: selected ? 'sticker-grid' : 'category-grid', role: 'group', 'aria-label': selected ? selected.title : 'Sticker categories' },
          selected ? selected.items.slice(page * 12, page * 12 + 12).map(item => button(item.title, h('img', { src: item.preview, alt: '', loading: 'lazy' }), () => {}, { key: item.kind, className: 'sticker' })) :
            stickerCategories.map(item => button(item.title, h(item.icon, { 'aria-hidden': true }), () => { setCategory(item.id); setPage(0); }, { key: item.id, className: 'category' }))),
        h('footer', { className: 'panel-footer' },
          selected && pages > 1 ? h('nav', { className: 'paging', 'aria-label': 'Browse stickers' }, button('Previous stickers', h(ArrowLeft), () => setPage((page + pages - 1) % pages), { className: 'utility' }), h('span', null, `${page + 1} / ${pages}`), button('Next stickers', h(ArrowRight), () => setPage((page + 1) % pages), { className: 'utility' })) : h('div', { className: 'footer-spacer' }),
          h('div', { className: 'ink-well', role: 'group', 'aria-label': 'Sticker line-art color' },
            button('Black line art', h('span', { className: 'black-ink', 'aria-hidden': true }), () => setColored(false), { 'aria-pressed': !colored }),
            button('Use selected color for line art', h(React.Fragment, null, h(Palette, { 'aria-hidden': true }), h('span', { className: 'selected-color', 'aria-hidden': true })), () => setColored(true), { 'aria-pressed': colored })),
          h('div', { className: 'footer-spacer' }))));
}
createRoot(document.getElementById('root')).render(h(Study));
