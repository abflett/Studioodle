import './style.css';
import { CellField, size, profiles, profileNames, patches } from './model';
import type { Point } from './model';

const palette = ['#fffdf6', '#25343a', '#d85a55', '#e9ad45', '#6c9c75', '#508aa5', '#8973ad', '#e999ad'];
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><div><span class="eyebrow">STUDIOODLE / EXPERIMENTS</span><h1>Small cells. Big ideas.</h1><p>A brush playground built from eight simple profiles.</p></div><span class="badge">100 × 100 cells</span></header>
  <main><section class="workspace"><div class="canvas-wrap"><canvas id="paint" aria-label="Cell brush drawing canvas"></canvas><canvas id="grid" aria-hidden="true"></canvas><div id="cursor"></div></div><p class="hint">Drag to paint · White paints paper back in · Nothing is saved</p></section>
  <aside><section><h2>Your brush</h2><div id="palette" role="group" aria-label="Brush colors"></div><label class="size-label" for="size">Diameter <output id="diameter">8 cells</output></label><input id="size" type="range" min="2" max="30" value="8"><label class="toggle"><input id="show-grid" type="checkbox" checked> Show cell grid</label><label class="toggle"><input id="show-junctions" type="checkbox"> Highlight multi-color cells</label><button id="clear">Clear canvas</button></section>
  <section><h2>Eight building blocks</h2><div id="profiles"></div><p class="note">Colors can swap sides. Opposite corners combine two profiles; three-corner shapes invert a corner.</p></section>
  <section class="numbers"><h2>Under the surface</h2><dl><dt>Painted cells</dt><dd id="painted">0</dd><dt>3+ color cells</dt><dd id="junctions">0</dd><dt>Shared color data</dt><dd>9.96 KiB</dd><dt>Display buffer¹</dt><dd id="buffer">—</dd><dt>Last edit / draw²</dt><dd id="timing">—</dd></dl><p class="note">Shared corner slots keep neighboring edges aligned. Complex color junctions use four corner quadrants.</p><p class="note">¹ Drawing + grid canvases; excludes browser/GPU overhead. ² Latest frame's edit and drawing CPU time, not input latency or a benchmark.</p></section></aside></main>`;

const field = new CellField();
const canvas = document.querySelector<HTMLCanvasElement>('#paint')!;
const grid = document.querySelector<HTMLCanvasElement>('#grid')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const gridCtx = grid.getContext('2d')!;
const wrap = document.querySelector<HTMLDivElement>('.canvas-wrap')!;
const cursor = document.querySelector<HTMLDivElement>('#cursor')!;
const slider = document.querySelector<HTMLInputElement>('#size')!;
const showGrid = document.querySelector<HTMLInputElement>('#show-grid')!;
const showJunctions = document.querySelector<HTMLInputElement>('#show-junctions')!;
let slot = 1, pointer: number | undefined, previous: Point | undefined;
let dirty = new Set<number>(), frame = 0, editMs = 0;
const painted = new Uint8Array(size * size), junctions = new Uint8Array(size * size);

document.querySelector('#palette')!.innerHTML = palette.map((color, i) => `<button class="swatch" style="--color:${color}" aria-label="${['Paper', 'Ink', 'Coral', 'Gold', 'Leaf', 'Blue', 'Purple', 'Pink'][i]}" aria-pressed="${i === slot}" data-slot="${i}"></button>`).join('');
document.querySelectorAll<HTMLButtonElement>('.swatch').forEach(button => button.onclick = () => {
  slot = Number(button.dataset.slot);
  document.querySelectorAll('.swatch').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
});
const legend = document.querySelector('#profiles')!;
profiles.forEach((polygon, i) => {
  const item = document.createElement('div');
  const sample = document.createElement('canvas'); sample.width = sample.height = 48;
  const context = sample.getContext('2d')!;
  context.fillStyle = '#fffdf6'; context.fillRect(0, 0, 48, 48);
  if (polygon.length) { context.beginPath(); polygon.forEach(([x, y], n) => n ? context.lineTo(x * 48, y * 48) : context.moveTo(x * 48, y * 48)); context.closePath(); context.fillStyle = '#508a88'; context.fill(); }
  const caption = document.createElement('span'); caption.textContent = profileNames[i]!;
  item.append(sample, caption); legend.append(item);
});

function schedule(all = false) {
  if (all) dirty = new Set(Array.from({ length: size * size }, (_, i) => i));
  if (!frame) frame = requestAnimationFrame(draw);
}
function draw() {
  frame = 0;
  const start = performance.now(), cell = canvas.width / size;
  for (const index of dirty) {
    const x = index % size, y = Math.floor(index / size), labels = field.cell(x, y);
    const colors = new Set(labels);
    painted[index] = labels.some(color => color !== 0) ? 1 : 0;
    junctions[index] = colors.size > 2 ? 1 : 0;
    const base = Math.min(...labels);
    ctx.fillStyle = palette[base]!; ctx.fillRect(x * cell, y * cell, cell, cell);
    for (const patch of patches(labels)) {
      if (patch.slot === base) continue;
      ctx.beginPath(); patch.polygon.forEach(([px, py], i) => i ? ctx.lineTo((x + px) * cell, (y + py) * cell) : ctx.moveTo((x + px) * cell, (y + py) * cell)); ctx.closePath();
      ctx.fillStyle = palette[patch.slot]!; ctx.fill();
    }
    if (showJunctions.checked && junctions[index]) { ctx.strokeStyle = '#ff00b3'; ctx.lineWidth = 1; ctx.strokeRect(x * cell + .5, y * cell + .5, cell - 1, cell - 1); }
  }
  dirty.clear();
  document.querySelector('#painted')!.textContent = String(painted.reduce((sum, n) => sum + n, 0));
  document.querySelector('#junctions')!.textContent = String(junctions.reduce((sum, n) => sum + n, 0));
  document.querySelector('#timing')!.textContent = `${editMs.toFixed(2)} / ${(performance.now() - start).toFixed(2)} ms`;
  editMs = 0;
}
function resize() {
  // Whole physical pixels per cell prevent cracks between cell backgrounds.
  const pixels = Math.max(size, Math.floor(wrap.clientWidth * devicePixelRatio / size) * size);
  canvas.width = canvas.height = grid.width = grid.height = pixels;
  document.querySelector('#buffer')!.textContent = `${(pixels * pixels * 8 / 1048576).toFixed(2)} MiB`;
  gridCtx.clearRect(0, 0, pixels, pixels); gridCtx.beginPath();
  for (let i = 1; i < size; i++) { const p = i * pixels / size + .5; gridCtx.moveTo(p, 0); gridCtx.lineTo(p, pixels); gridCtx.moveTo(0, p); gridCtx.lineTo(pixels, p); }
  gridCtx.strokeStyle = '#25343a20'; gridCtx.lineWidth = 1; gridCtx.stroke(); schedule(true);
}
function point(event: PointerEvent): Point {
  const box = canvas.getBoundingClientRect();
  cursor.style.left = `${event.clientX - box.left}px`; cursor.style.top = `${event.clientY - box.top}px`;
  const diameter = Number(slider.value) * box.width / size;
  cursor.style.width = cursor.style.height = `${diameter}px`;
  return [(event.clientX - box.left) / box.width * size, (event.clientY - box.top) / box.height * size];
}
function paint(next: Point) {
  const start = performance.now();
  for (const index of field.paint(previous ?? next, next, Number(slider.value) / 2, slot)) dirty.add(index);
  editMs += performance.now() - start; previous = next; schedule();
}
canvas.addEventListener('pointerdown', event => {
  if (pointer !== undefined || event.button !== 0) return;
  pointer = event.pointerId; previous = undefined; canvas.setPointerCapture(pointer); paint(point(event));
});
canvas.addEventListener('pointermove', event => {
  const next = point(event);
  if (pointer !== event.pointerId) return;
  const samples = event.getCoalescedEvents?.() ?? [];
  for (const sample of samples) paint(point(sample));
  paint(next);
});
function end(event?: PointerEvent) {
  if (event && event.pointerId !== pointer) return;
  const id = pointer; pointer = undefined; previous = undefined;
  if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
canvas.addEventListener('pointerup', event => { if (pointer === event.pointerId) paint(point(event)); end(event); });
canvas.addEventListener('pointercancel', end);
canvas.addEventListener('lostpointercapture', end);
window.addEventListener('blur', () => end());
document.addEventListener('visibilitychange', () => { if (document.hidden) end(); });
slider.oninput = () => { document.querySelector('#diameter')!.textContent = `${slider.value} cells`; };
showGrid.onchange = () => { grid.hidden = !showGrid.checked; };
showJunctions.onchange = () => schedule(true);
document.querySelector<HTMLButtonElement>('#clear')!.onclick = () => { end(); field.labels.fill(0); schedule(true); };
new ResizeObserver(resize).observe(wrap);
