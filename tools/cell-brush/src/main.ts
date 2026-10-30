import './style.css';
import { CellField, size } from './model';
import type { Point } from './model';
import { numericLookupBytes } from './profiles';

const palette = ['#fffdf6', '#25343a', '#d85a55', '#e9ad45', '#6c9c75', '#508aa5', '#8973ad', '#e999ad'];
let field = new CellField('straight', false);
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><div><span class="eyebrow">STUDIOODLE / EXPERIMENTS</span><h1>Small cells. Big ideas.</h1><p>Simple straight cuts, with the earlier libraries here to compare.</p></div><span class="badge">100 × 100 cells</span></header>
  <main><section class="workspace"><div class="canvas-wrap"><canvas id="paint" aria-label="Cell brush drawing canvas"></canvas><canvas id="grid" aria-hidden="true"></canvas><div id="cursor"></div></div><p class="hint">Drag to paint · Paper erases to transparent · Nothing is saved</p></section>
  <aside><section><h2>Your brush</h2><div id="palette" role="group" aria-label="Brush colors"></div><label class="size-label" for="size">Diameter <output id="diameter">8 cells</output></label><input id="size" type="range" min="1" max="30" step=".25" value="8"><label class="size-label" for="library">Shape library</label><select id="library"><option value="straight">Straight cuts (16 of 32 slots)</option><option value="32">Experimental 32 shapes</option><option value="8">Original 8 profiles</option></select><p class="note library-note">Changing the library clears the canvas.</p><label class="toggle"><input id="show-grid" type="checkbox" checked> Show cell grid</label><label class="toggle"><input id="match-edges" type="checkbox"> Match edges on release</label><button id="example">Draw test strokes</button><button id="circles">Draw circle dabs</button><button id="clear">Clear canvas</button></section>
  <section><h2 id="legend-title">Straight cuts: 16 / 32 slots</h2><div id="profiles"></div><p class="note">Each byte selects a base shape, rotation and reflection. Colors can swap sides; paper is transparent.</p></section>
  <section class="numbers"><h2>Under the surface</h2><dl><dt>Painted cells</dt><dd id="painted">0</dd><dt>Boundary cells</dt><dd id="boundaries">0</dd><dt>Cell data</dt><dd>29.30 KiB</dd><dt>Loaded lookups⁴</dt><dd>${(numericLookupBytes / 1024).toFixed(2)} KiB</dd><dt>Distinct candidates</dt><dd id="candidates">${field.tables.candidates.length}</dd><dt>Stroke samples³</dt><dd id="scratch">0 KiB</dd><dt>Display buffer¹</dt><dd id="buffer">—</dd><dt>Last edit / draw²</dt><dd id="timing">—</dd></dl><p class="note">Straight cuts fit stroke coverage at quarter-edge positions. Neighbor matching is optional; untouched cells never change.</p><p class="note">¹ Drawing + grid canvases; excludes browser/GPU overhead. ² Latest edit and drawing CPU time, not input latency or a benchmark. ³ Temporary sample buffers, released on stroke end; excludes bookkeeping overhead. ⁴ Shared typed tables; excludes polygon and browser path objects.</p></section></aside></main>`;

function makePaths() { return field.tables.variants.map(polygon => {
  const path = new Path2D();
  polygon.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
  if (polygon.length) path.closePath();
  return path;
}); }
let paths = makePaths();
const canvas = document.querySelector<HTMLCanvasElement>('#paint')!;
const grid = document.querySelector<HTMLCanvasElement>('#grid')!;
const ctx = canvas.getContext('2d')!;
const gridCtx = grid.getContext('2d')!;
const wrap = document.querySelector<HTMLDivElement>('.canvas-wrap')!;
const cursor = document.querySelector<HTMLDivElement>('#cursor')!;
const slider = document.querySelector<HTMLInputElement>('#size')!;
const showGrid = document.querySelector<HTMLInputElement>('#show-grid')!;
let slot = 1, pointer: number | undefined, previous: Point | undefined;
let dirty = new Set<number>(), frame = 0, editMs = 0;
const painted = new Uint8Array(size * size), boundaries = new Uint8Array(size * size);

document.querySelector('#palette')!.innerHTML = palette.map((color, i) => `<button class="swatch" style="--color:${color}" aria-label="${['Paper', 'Ink', 'Coral', 'Gold', 'Leaf', 'Blue', 'Purple', 'Pink'][i]}" aria-pressed="${i === slot}" data-slot="${i}"></button>`).join('');
document.querySelectorAll<HTMLButtonElement>('.swatch').forEach(button => button.onclick = () => {
  slot = Number(button.dataset.slot);
  document.querySelectorAll('.swatch').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
});
const legend = document.querySelector('#profiles')!;
function renderLegend() {
legend.replaceChildren();
const shapes = field.tables.shapes;
for (let i = 0; i < 32; i++) {
  const polygon = shapes[i] ?? [];
  const item = document.createElement('div');
  const sample = document.createElement('canvas'); sample.width = sample.height = 48;
  const context = sample.getContext('2d')!;
  context.fillStyle = '#fffdf6'; context.fillRect(0, 0, 48, 48);
  if (polygon.length) { context.beginPath(); polygon.forEach(([x, y], n) => n ? context.lineTo(x * 48, y * 48) : context.moveTo(x * 48, y * 48)); context.closePath(); context.fillStyle = '#508a88'; context.fill(); }
  const caption = document.createElement('span'); caption.textContent = field.tables.names[i] ?? 'Reserved';
  if (i >= shapes.length) item.className = 'reserved';
  item.append(sample, caption); legend.append(item);
}
document.querySelector('#legend-title')!.textContent = field.library === 'straight' ? 'Straight cuts: 16 / 32 slots' : field.library === 'legacy' ? 'Original 8 (from earlier set)' : 'Experimental 32 shapes';
}
renderLegend();

function schedule(all = false) {
  if (all) dirty = new Set(Array.from({ length: size * size }, (_, i) => i));
  if (!frame) frame = requestAnimationFrame(draw);
}
function draw() {
  frame = 0;
  const start = performance.now(), cell = canvas.width / size, hadDirty = dirty.size > 0;
  for (const index of dirty) {
    const x = index % size, y = Math.floor(index / size), state = field.cell(index);
    painted[index] = state.front || state.back ? 1 : 0;
    boundaries[index] = state.profile > 1 ? 1 : 0;
    ctx.clearRect(x * cell, y * cell, cell, cell);
    if (state.back) { ctx.fillStyle = palette[state.back]!; ctx.fillRect(x * cell, y * cell, cell, cell); }
    const polygon = field.tables.variants[state.profile]!;
    if (polygon.length) {
      if (!state.front) ctx.globalCompositeOperation = 'destination-out';
      ctx.setTransform(cell, 0, 0, cell, x * cell, y * cell);
      ctx.fillStyle = state.front ? palette[state.front]! : '#000'; ctx.fill(paths[state.profile]!);
      ctx.resetTransform();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  dirty.clear();
  document.querySelector('#painted')!.textContent = String(painted.reduce((sum, n) => sum + n, 0));
  document.querySelector('#boundaries')!.textContent = String(boundaries.reduce((sum, n) => sum + n, 0));
  document.querySelector('#scratch')!.textContent = `${(field.scratchBytes / 1024).toFixed(2)} KiB`;
  if (hadDirty || editMs) document.querySelector('#timing')!.textContent = `${editMs.toFixed(2)} / ${(performance.now() - start).toFixed(2)} ms`;
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
  pointer = event.pointerId; previous = undefined;
  for (const index of field.beginStroke(slot)) dirty.add(index);
  canvas.setPointerCapture(pointer); paint(point(event));
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
  const start = performance.now();
  for (const index of field.endStroke()) dirty.add(index);
  editMs += performance.now() - start; schedule();
  if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
canvas.addEventListener('pointerup', event => { if (pointer === event.pointerId) paint(point(event)); end(event); });
canvas.addEventListener('pointercancel', end);
canvas.addEventListener('lostpointercapture', end);
window.addEventListener('blur', () => end());
document.addEventListener('visibilitychange', () => { if (document.hidden) end(); });
slider.oninput = () => { document.querySelector('#diameter')!.textContent = `${slider.value} cells`; };
showGrid.onchange = () => { grid.hidden = !showGrid.checked; };
document.querySelector<HTMLInputElement>('#match-edges')!.onchange = event => { end(); field.matchNeighbors = (event.target as HTMLInputElement).checked; };
document.querySelector<HTMLSelectElement>('#library')!.onchange = event => {
  end();
  const selected = (event.target as HTMLSelectElement).value;
  const matching = document.querySelector<HTMLInputElement>('#match-edges')!;
  matching.checked = selected !== 'straight';
  field = new CellField(selected === 'straight' ? 'straight' : selected === '32' ? 'experimental' : 'legacy', matching.checked);
  paths = makePaths(); renderLegend();
  document.querySelector('#candidates')!.textContent = String(field.tables.candidates.length); schedule(true);
};
document.querySelector<HTMLButtonElement>('#example')!.onclick = () => {
  end(); field.clear();
  const start = performance.now();
  const stroke = (points: Point[], radius: number, color: number) => {
    field.beginStroke(color);
    let previous = points[0]!;
    for (const point of points) { field.paint(previous, point, radius, color); previous = point; }
    field.endStroke();
  };
  stroke([[10, 15], [88, 32]], 2.75, 2);
  stroke(Array.from({ length: 65 }, (_, i): Point => [10 + i * 1.25, 48 + Math.sin(i / 64 * Math.PI * 2) * 10]), 1.125, 5);
  stroke(Array.from({ length: 81 }, (_, i): Point => { const a = i / 80 * Math.PI * 2; return [32 + Math.cos(a) * 17, 78 + Math.sin(a) * 12]; }), .625, 1);
  stroke([[65, 67], [88, 90]], 2.5, 4);
  stroke([[65, 90], [88, 67]], 2.5, 6);
  for (const [i, radius] of [.55, .8, 1.1, 1.5].entries()) stroke([[10 + i * 7, 59]], radius, 3);
  editMs += performance.now() - start; schedule(true);
};
document.querySelector<HTMLButtonElement>('#clear')!.onclick = () => { end(); field.clear(); schedule(true); };
document.querySelector<HTMLButtonElement>('#circles')!.onclick = () => {
  end(); field.clear();
  const start = performance.now();
  for (const [x, y, radius, color] of [[25, 30, 14, 1], [67, 28, 10.5, 2], [26, 72, 6.25, 5], [65, 70, 3.5, 4]]) {
    field.beginStroke(color!); field.paint([x!, y!], [x!, y!], radius!, color!); field.endStroke();
  }
  editMs += performance.now() - start; schedule(true);
};
new ResizeObserver(resize).observe(wrap);
