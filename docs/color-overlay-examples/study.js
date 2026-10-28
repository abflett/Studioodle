/* global URLSearchParams, location, document */
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { X, Check, Pencil } from 'lucide-react';
import { drawingColors } from '../../src/editor/palette';
import '@fontsource-variable/nunito';
const h = React.createElement;
const query = new URLSearchParams(location.search);
const everyday = drawingColors.map(color => '#' + color.value.toString(16).padStart(6, '0'));
const palette = (name, colors, dots) => ({ name, colors: colors.split(' ').map(c => '#' + c), dots });
const palettes = [
  { name: 'Everyday', colors: everyday, dots: ['#d93b3b','#68a832','#4892dc'] },
  palette('Pastel', '000000 87909e c8cdd5 e5f3ff ffffff f8d9bc e9c5a5 b59b92 d7b29b bfa5a1 dca8b8 f4b2b9 fac1a4 f8d4a4 f9e8ab fff3c9 f7c9dd f4bcca d9b4d5 cdbcec bdaee8 a89acb a4abe0 a0b6d6 d9ecb4 c3dfa9 a9d0b2 9fc4b7 b1e1d7 c4e7fa accff1 b4c1e6', ['#f4b2b9','#b1e1d7','#accff1']),
  palette('Vivid', '000000 575b70 bcc4dc d4f8ff ffffff ffbb8b ffa34b 582d44 b86c33 743a37 c91658 ff3157 ff6b24 ffab00 ffe600 f9ff70 ff63ba ff4b8e e829a6 c272ff 9e3cff 6625c7 5944ff 2331a6 c4ff24 76ee24 1ad765 079b72 00dfc4 26d9ff 168dff 304dff', ['#ff3157','#76ee24','#168dff']),
  palette('Moody', '000000 515764 9296a0 b7c6d1 ffffff c19f8c a98464 30232b 805d46 47332d 6e3448 9c4e58 b36b4d b08a48 b4a25b d2c494 a56f8e a96778 814e78 8e7ca8 69567f 453451 4d4976 28344d 8a9857 657c49 40624c 284b40 477d78 779eae 4b7798 354c73', ['#9c4e58','#40624c','#354c73']),
];
const starterCustom = ['#dca9ba','#b3c7a0','#8aa6c9','#c6a3d8','#dfa77c','#80bbb4', ...Array(26).fill(null)];
function toRgb(hue, sat, val) {
  const c = val * sat, x = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = val - c;
  const [r,g,b] = hue < 60 ? [c,x,0] : hue < 120 ? [x,c,0] : hue < 180 ? [0,c,x] : hue < 240 ? [0,x,c] : hue < 300 ? [x,0,c] : [c,0,x];
  return '#' + [r,g,b].map(n => Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
}
function toHsv(hex) {
  const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255), max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
  let hue = !d ? 0 : max === r ? ((g-b)/d)%6 : max === g ? (b-r)/d+2 : (r-g)/d+4;
  hue = (hue*60+360)%360; return [hue, max ? d/max : 0, max];
}
function Dots({ colors }) {
  return h('svg', { viewBox: '0 0 40 40', 'aria-hidden': true }, [[13,15],[27,15],[20,27]].map(([cx,cy],i) => h('circle', { key: i, cx, cy, r: 8, fill: colors[i] || 'none', stroke: colors[i] ? 'none' : 'currentColor', strokeWidth: 1.4 })));
}
function Picker({ color, onClose, onApply }) {
  const dialog = useRef(null), [hsv,setHsv] = useState(() => toHsv(color || '#a78fc7'));
  const current = toRgb(...hsv), [draft,setDraft] = useState(current.toUpperCase());
  const valid = /^#[0-9a-f]{6}$/i.test(draft);
  const update = next => { setHsv(next); setDraft(toRgb(...next).toUpperCase()); };
  useEffect(() => { const node = dialog.current; node.showModal(); return () => node.close(); }, []);
  const pointer = e => {
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    if (e.type === 'pointermove' && !e.buttons) return;
    const r = e.currentTarget.getBoundingClientRect();
    update([hsv[0],Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))]);
  };
  return h('dialog', { ref: dialog, className: 'custom-picker', 'aria-label': 'Choose custom color', onCancel: onClose, onClick: e => { if(e.target === e.currentTarget) onClose(); } },
    h('header', { className: 'picker-header' }, h('div', { className: 'color-comparison', 'aria-label': 'Previous and new color' }, h('span', { style: { background: color || 'transparent' }, className: color ? '' : 'empty' }), h('span', { style: { background: current } })), h('button', { className: 'utility', title: 'Cancel color change', 'aria-label': 'Cancel color change', onClick: onClose }, h(X))),
    h('div', { className: 'sv-field', style: { '--hue-color': `hsl(${hsv[0]} 100% 50%)` }, role: 'group', 'aria-label': 'Saturation and brightness', onPointerDown: pointer, onPointerMove: pointer }, h('span', { className: 'sv-cursor', style: { left: `${hsv[1]*100}%`, top: `${(1-hsv[2])*100}%`, background: current } })),
    h('input', { type: 'range', min: 0, max: 359, step: 1, value: hsv[0], className: 'hue-slider', 'aria-label': 'Hue', onChange: e => update([Number(e.target.value),hsv[1],hsv[2]]) }),
    h('footer', { className: 'picker-footer' }, h('input', { className: 'hex-field', value: draft, maxLength: 7, spellCheck: false, 'aria-label': 'Hex color', 'aria-invalid': !valid, title: 'Hex color - copy or paste #RRGGBB', onChange: e => { const text = e.target.value; setDraft(text); if(/^#[0-9a-f]{6}$/i.test(text)) setHsv(toHsv(text)); }, onBlur: () => { if(!valid) setDraft(current.toUpperCase()); } }), h('button', { className: 'apply', title: 'Apply custom color', 'aria-label': 'Apply custom color', disabled: !valid, onClick: () => onApply(current) }, h(Check))));
}
function Study() {
  const [tab,setTab] = useState(query.has('custom') ? 4 : 0), [custom,setCustom] = useState(starterCustom), [edit,setEdit] = useState(query.has('edit'));
  const [selected,setSelected] = useState(query.has('custom') ? 128 : 11), [picking,setPicking] = useState(query.has('picker') ? 6 : null), [closed,setClosed] = useState(false);
  const [light,setLight] = useState(query.get('theme') === 'light');
  const tabs = [...palettes, { name: 'Custom', colors: custom, dots: custom.slice(0,3) }];
  return h('main', { className: `study${light ? ' light' : ''}${query.has('preview') ? ' preview' : ''}` },
    h('header', { className: 'review' }, h('div', null, h('strong', null, 'Colors / study 01'), h('span', null, 'Five palettes. 32 slots each. A drawing-owned custom palette.')), h('button', { onClick: () => setLight(!light) }, light ? 'Dark' : 'Light')),
    closed ? h('button', { className: 'apply reopen', onClick: () => setClosed(false) }, 'Open colors') : h('section', { className: 'panel', role: 'dialog', 'aria-labelledby': 'palette-title' },
      h('header', { className: 'panel-top' }, h('h1', { id: 'palette-title', className: 'sr-only' }, 'Choose a color'),
        h('div', { className: 'palette-well', role: 'group', 'aria-label': 'Color palettes' }, tabs.map((p,i) => h('button', { key: p.name, className: 'palette-tab', title: p.name, 'aria-label': `${p.name} palette`, 'aria-pressed': tab === i, onClick: () => { setTab(i); setEdit(false); } }, h(Dots, { colors: p.dots })))),
        h('button', { className: 'utility close', title: 'Close color selector', 'aria-label': 'Close color selector', onClick: () => setClosed(true) }, h(X))),
      h('div', { className: `swatch-grid${edit && tab === 4 ? ' editing' : ''}`, role: 'group', 'aria-label': tabs[tab].name + ' colors' }, tabs[tab].colors.map((color,i) => h('button', { key: i, className: `swatch${color ? '' : ' empty'}`, style: color ? { background: color } : {}, title: color ? `${tabs[tab].name} ${i+1}: ${color.toUpperCase()}` : `Set custom color ${i+1}`, 'aria-label': color ? `${tabs[tab].name} color ${i+1}, ${color}` : `Set custom color ${i+1}`, 'aria-pressed': !!color && selected === tab*32+i, onClick: () => { if(tab === 4 && (edit || !color)) setPicking(i); else setSelected(tab*32+i); } }, color && selected === tab*32+i && h(Check, { 'aria-hidden': true })))),
      h('footer', { className: 'palette-footer' }, tab === 4 && h('button', { className: `utility edit-toggle${edit ? ' active' : ''}`, title: edit ? 'Finish editing custom palette' : 'Edit custom palette', 'aria-label': edit ? 'Finish editing custom palette' : 'Edit custom palette', 'aria-pressed': edit, onClick: () => setEdit(!edit) }, h(edit ? Check : Pencil)))),
    picking !== null && h(Picker, { color: custom[picking], onClose: () => setPicking(null), onApply: color => { setCustom(custom.map((c,i) => i === picking ? color : c)); if(!edit) setSelected(128+picking); setPicking(null); } }));
}
createRoot(document.getElementById('root')).render(h(Study));
