/* global URLSearchParams, location, document */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { X, Palette, LayoutGrid } from 'lucide-react';
import { stickerCategories } from '../../src/ui/stickerCatalog';
import '@fontsource-variable/nunito';
const h = React.createElement;
const query = new URLSearchParams(location.search);
function Terrain({ level }) {
  return h('svg', { viewBox: '0 0 24 24', 'aria-hidden': true }, h('path', { d: level === 'easy' ? 'M2 21h20M3 17c6 0 11-2 18-4' : level === 'medium' ? 'M2 21h20M2 18c4 0 4-9 10-9s7 9 10 9' : 'M2 21h20M2 18 10 4l5 9 3-5 4 10M7.4 8.5 10 10l2.6-1.5' }));
}
function Study() {
  const [variant, setVariant] = useState(query.get('layout') === 'centered' ? 'centered' : 'balanced');
  const [level, setLevel] = useState('all'), [ink, setInk] = useState('#000000'), [picker, setPicker] = useState(false);
  const [light, setLight] = useState(query.get('theme') === 'light');
  const button = (label, children, onClick, extra = {}) => h('button', { type: 'button', title: label, 'aria-label': label, onClick, ...extra }, children);
  const color = button('Choose sticker ink color', h(React.Fragment, null, h(Palette, { 'aria-hidden': true }), h('span', { className: 'ink-dot', style: { background: ink } })), () => setPicker(true), { className: 'utility ink-button', 'aria-haspopup': 'dialog' });
  const difficulty = h('div', { className: 'difficulty-well', role: 'group', 'aria-label': 'Sticker detail' }, ['all','easy','medium','detailed'].map(id => button(id === 'all' ? 'All stickers' : `${id[0].toUpperCase() + id.slice(1)} stickers`, id === 'all' ? h(LayoutGrid, { 'aria-hidden': true }) : h(Terrain, { level: id }), () => setLevel(id), { key: id, 'aria-pressed': id === level })));
  return h('main', { className: `study${light ? ' light' : ''}${query.has('preview') ? ' preview' : ''}` },
    h('header', { className: 'review' }, h('div', null, h('strong', null, 'Stickers / header comparison'), h('span', null, variant === 'balanced' ? 'A · Color left, detail centered, close right' : 'B · Color and detail grouped at the center')), h('div', null, button('Switch header arrangement', variant === 'balanced' ? 'See B' : 'See A', () => setVariant(variant === 'balanced' ? 'centered' : 'balanced')), button('Toggle theme', light ? 'Dark' : 'Light', () => setLight(!light)))),
    h('section', { className: `panel header-study ${variant}`, role: 'dialog', 'aria-labelledby': 'sticker-title' },
      h('header', { className: 'filter-header' }, h('h1', { id: 'sticker-title', className: 'sr-only' }, 'Stickers'),
        variant === 'balanced' ? h(React.Fragment, null, color, difficulty) : h('div', { className: 'center-controls' }, color, difficulty),
        button('Close stickers', h(X), () => {}, { className: 'utility close' })),
      h('div', { className: 'category-grid', role: 'group', 'aria-label': 'Sticker categories' }, stickerCategories.map(item => button(item.title, h(item.icon, { 'aria-hidden': true }), () => {}, { key: item.id, className: 'category' })))),
    picker && h('div', { className: 'picker-backdrop', onClick: () => setPicker(false) }, h('section', { className: 'ink-picker', role: 'dialog', 'aria-modal': true, 'aria-label': 'Sticker ink color', onClick: event => event.stopPropagation() }, button('Close ink colors', h(X), () => setPicker(false), { className: 'utility picker-close' }), h('div', { className: 'ink-swatches' }, ['#000000','#ffffff','#507cad','#be79bd','#4d8a75','#cf8563'].map(color => button(`Use ${color} ink`, h('span', { style: { background: color } }), () => { setInk(color); setPicker(false); }, { key: color, 'aria-pressed': ink === color }))))));
}
createRoot(document.getElementById('root')).render(h(Study));
