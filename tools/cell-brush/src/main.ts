import './style.css';
import { CellField } from './model';
import type { Point } from './model';
import { numericLookupBytes } from './profiles';
import { thinCurve } from './fixtures';
import type { CurveKind } from './fixtures';
import { CellInspector } from './inspector';

const palette = ['#fffdf6', '#25343a', '#d85a55', '#e9ad45', '#6c9c75', '#508aa5', '#8973ad', '#e999ad'];
let field = new CellField('straight', false);
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><div><span class="eyebrow">STUDIOODLE / EXPERIMENTS</span><h1>Small cells. Big ideas.</h1><p>Simple straight cuts, with the earlier libraries here to compare.</p></div><span class="badge" id="grid-info">Fitting grid...</span></header>
  <main><section class="workspace"><div class="canvas-wrap"><canvas id="paint" aria-label="Cell brush drawing canvas"></canvas><canvas id="reference" aria-label="Unquantized round brush reference" hidden></canvas><canvas id="grid" aria-hidden="true"></canvas><div id="cursor"></div></div><p class="hint">Drag to paint · Paper erases to transparent · Nothing is saved</p></section>
  <aside><section><h2>Your brush</h2><label class="size-label" for="grid-mode">Grid resolution</label><select id="grid-mode"><option value="display">4 &times; 4 CSS pixels per cell</option><option value="display2">2 &times; 2 CSS pixels per cell</option><option value="display1">1 &times; 1 CSS pixel per cell</option><option value="legacy">100 &times; 100 comparison grid</option></select><button id="fit-grid">Fit grid to view (clears)</button><p class="note" id="grid-note">Grid changes clear the drawing. Window resizing preserves it.</p><div id="palette" role="group" aria-label="Brush colors"></div><label class="size-label" for="size">Diameter <output id="diameter">8 cells</output></label><input id="size" type="range" min="1" max="30" step=".25" value="8"><label class="size-label" for="library">Shape library</label><select id="library"><option value="straight">Straight cuts (16 of 32 slots)</option><option value="32">Experimental 32 shapes</option><option value="8">Original 8 profiles</option></select><p class="note library-note">Changing the library clears the canvas.</p><label class="size-label" for="view">Compare coverage</label><select id="view"><option value="cells">Cell profiles</option><option value="reference">Round brush reference</option><option value="difference">Difference overlay</option></select><label class="toggle"><input id="show-grid" type="checkbox" checked> Show cell grid</label><label class="toggle"><input id="match-edges" type="checkbox"> Match edges on release</label><button id="example">Draw test strokes</button><button id="circles">Draw circle dabs</button><button id="overlap">Draw overlapping dabs</button><button id="clear">Clear canvas</button></section>
  <section id="curve-test"><h2>Thin contour test</h2><label class="size-label" for="curve-kind">Shape</label><select id="curve-kind"><option value="arc">Open curve</option><option value="short">Short curve (9 cells wide)</option><option value="spiral">Spiral</option><option value="tightening">Loose to tight bend</option><option value="boundary">Boundary flutter</option></select><label class="size-label" for="grid-phase">X offset <output id="phase-value">0 cells</output></label><input id="grid-phase" type="range" min="0" max=".997" step=".001" value="0"><label class="size-label" for="grid-phase-y">Y offset <output id="phase-y-value">0 cells</output></label><input id="grid-phase-y" type="range" min="0" max=".997" step=".001" value="0"><label class="size-label" for="jitter">Mouse jitter <output id="jitter-value">0 cells</output></label><input id="jitter" type="range" min="0" max=".25" step=".01" value="0"><label class="size-label" for="noise-seed">Noise seed</label><input id="noise-seed" type="number" min="0" max="4294967295" step="1" value="17"><label class="toggle"><input id="retrace" type="checkbox" checked> Repeat and retrace input samples</label><button id="thin-curve">Draw 1-cell test</button><label class="toggle"><input id="capture-cells" type="checkbox"> Capture cell diagnostics</label><label class="toggle"><input id="inspect-cells" type="checkbox"> Click to inspect instead of paint</label><p class="note">Test button clears the page and enables capture. Orange = actual crossings; blue = snapped. Capture and zoom add diagnostic memory beyond the counters below. Enable it before drawing your own curve. Inspector shows the selected cell and its neighbors.</p><div id="cell-inspector"></div></section><section><h2 id="legend-title">Straight cuts: 16 / 32 slots</h2><div id="profiles"></div><p class="note">Each byte selects a base shape, rotation and reflection. Colors can swap sides; paper is transparent.</p></section>
  <section class="numbers"><h2>Under the surface</h2><dl><dt>Painted cells</dt><dd id="painted">0</dd><dt>Boundary cells</dt><dd id="boundaries">0</dd><dt>Cell data</dt><dd id="cell-data">?</dd><dt>Loaded lookups⁴</dt><dd>${(numericLookupBytes / 1024).toFixed(2)} KiB</dd><dt>Distinct candidates</dt><dd id="candidates">${field.tables.candidates.length}</dd><dt>Stroke samples³</dt><dd id="scratch">0 KiB</dd><dt>Display buffer¹</dt><dd id="buffer">—</dd><dt>Last edit / draw²</dt><dd id="timing">—</dd></dl><p class="note">Straight cuts connect shared stroke-outline crossings. Matching is optional for complex fallback cases.</p><p class="note">¹ Drawing + grid + reference canvases; excludes browser/GPU overhead. ² Latest edit and drawing CPU time, not input latency or a benchmark. ³ Temporary sample buffers, released on stroke end; excludes analytic edge intervals and bookkeeping. ⁴ Shared typed tables; excludes cut-index, polygon and browser path objects.</p></section></aside></main>`;

document.body.dataset.gridMode = 'display';
const inspector = new CellInspector(document.querySelector<HTMLElement>('#cell-inspector')!, () => field);
function configureCapture() {
  field.onFit = document.querySelector<HTMLInputElement>('#capture-cells')!.checked ? inspector.capture : undefined;
}
document.querySelector<HTMLInputElement>('#capture-cells')!.onchange = () => { end(); inspector.clear(); configureCapture(); };

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
const reference = document.querySelector<HTMLCanvasElement>('#reference')!;
reference.width = reference.height = 1000;
const referenceCtx = reference.getContext('2d')!;
referenceCtx.scale(10, 10);
function referenceStroke(a: Point, b: Point, radius: number, color: number) {
  referenceCtx.globalCompositeOperation = color === 0 ? 'destination-out' : 'source-over';
  referenceCtx.fillStyle = referenceCtx.strokeStyle = color === 0 ? '#000' : palette[color]!;
  if (a[0] === b[0] && a[1] === b[1]) {
    referenceCtx.beginPath(); referenceCtx.arc(a[0], a[1], radius, 0, Math.PI * 2); referenceCtx.fill();
  } else {
    referenceCtx.lineWidth = radius * 2; referenceCtx.lineCap = 'round'; referenceCtx.lineJoin = 'round';
    referenceCtx.beginPath(); referenceCtx.moveTo(a[0], a[1]); referenceCtx.lineTo(b[0], b[1]); referenceCtx.stroke();
  }
}
function pagePoint(x: number, y: number): Point {
  const scale = Math.min(field.width, field.height) / 100;
  return [(field.width - 100 * scale) / 2 + x * scale, (field.height - 100 * scale) / 2 + y * scale];
}
function pageDab(x: number, y: number, radius: number, color: number) {
  const p = pagePoint(x, y), r = radius * Math.min(field.width, field.height) / 100;
  field.beginStroke(color); referenceStroke(p, p, r, color); field.paint(p, p, r, color); field.endStroke();
}
function clearReference() { referenceCtx.clearRect(0, 0, field.width, field.height); }
const wrap = document.querySelector<HTMLDivElement>('.canvas-wrap')!;
const cursor = document.querySelector<HTMLDivElement>('#cursor')!;
const slider = document.querySelector<HTMLInputElement>('#size')!;
const showGrid = document.querySelector<HTMLInputElement>('#show-grid')!;
let slot = 1, pointer: number | undefined, previous: Point | undefined;
const dirty = new Set<number>();
let frame = 0, editMs = 0, fullRedraw = false;
let painted = new Uint8Array(field.width * field.height), boundaries = new Uint8Array(field.width * field.height);
let paintedCount = 0, boundaryCount = 0, gridInitialized = false;

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
  if (all) { fullRedraw = true; dirty.clear(); }
  if (!frame) frame = requestAnimationFrame(draw);
}
function draw() {
  frame = 0;
  const start = performance.now(), cell = canvas.width / field.width, all = fullRedraw, hadDirty = all || dirty.size > 0;
  fullRedraw = false;
  if (all) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    painted.fill(0); boundaries.fill(0); paintedCount = boundaryCount = 0;
  }
  for (const index of all ? field.profile.keys() : dirty) {
    if (all && !field.front[index] && !field.back[index]) continue;
    const x = index % field.width, y = Math.floor(index / field.width), state = field.cell(index);
    paintedCount -= painted[index]!; boundaryCount -= boundaries[index]!;
    painted[index] = state.front || state.back ? 1 : 0;
    boundaries[index] = state.profile > 1 ? 1 : 0;
    paintedCount += painted[index]!; boundaryCount += boundaries[index]!;
    if (!all) ctx.clearRect(x * cell, y * cell, cell, cell);
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
  document.querySelector('#painted')!.textContent = String(paintedCount);
  document.querySelector('#boundaries')!.textContent = String(boundaryCount);
  document.querySelector('#scratch')!.textContent = `${(field.scratchBytes / 1024).toFixed(2)} KiB`;
  if (hadDirty || editMs) document.querySelector('#timing')!.textContent = `${editMs.toFixed(2)} / ${(performance.now() - start).toFixed(2)} ms`;
  editMs = 0;
}
function fitGrid() {
  end();
  const mode = document.querySelector<HTMLSelectElement>('#grid-mode')!.value;
  const pixels = mode === 'display2' ? 2 : mode === 'display1' ? 1 : 4;
  document.body.dataset.gridMode = mode === 'legacy' ? 'legacy' : 'display';
  const width = mode === 'legacy' ? 100 : Math.max(1, Math.floor(wrap.clientWidth / pixels));
  const height = mode === 'legacy' ? 100 : Math.max(1, Math.floor(wrap.clientHeight / pixels));
  field = new CellField(field.library, field.matchNeighbors, width, height);
  inspector.clear(); configureCapture();
  painted = new Uint8Array(width * height); boundaries = new Uint8Array(width * height);
  paintedCount = boundaryCount = 0; dirty.clear();
  gridInitialized = true;
  const scale = mode === 'legacy' ? 10 : Math.max(1, Math.round(pixels * devicePixelRatio));
  reference.width = width * scale; reference.height = height * scale;
  referenceCtx.setTransform(scale, 0, 0, scale, 0, 0);
  document.querySelector('#cell-data')!.textContent = `${(field.byteLength / 1024).toFixed(2)} KiB`;
  resize();
}
function resize() {
  if (!gridInitialized) { fitGrid(); return; }
  // Use one physical scale for both axes; preserve the model on window resize.
  const cssCell = Math.min(wrap.clientWidth / field.width, wrap.clientHeight / field.height);
  const cell = Math.max(1, Math.floor(cssCell * devicePixelRatio));
  const width = field.width * cell, height = field.height * cell;
  canvas.width = grid.width = width; canvas.height = grid.height = height;
  for (const surface of [canvas, grid, reference]) {
    surface.style.width = `${field.width * cssCell}px`; surface.style.height = `${field.height * cssCell}px`;
  }
  document.querySelector('#grid-info')!.textContent = `${field.width} \u00d7 ${field.height} cells`;
  document.querySelector('#grid-note')!.textContent = `${cssCell.toFixed(1)} \u00d7 ${cssCell.toFixed(1)} CSS pixels/cell. Grid changes clear; resizing preserves the drawing.`;
  document.querySelector('#buffer')!.textContent = `${((width * height * 8 + reference.width * reference.height * 4) / 1048576).toFixed(2)} MiB`;
  gridCtx.beginPath();
  for (let i = 1; i < field.width; i++) { const p = i * cell + .5; gridCtx.moveTo(p, 0); gridCtx.lineTo(p, height); }
  for (let i = 1; i < field.height; i++) { const p = i * cell + .5; gridCtx.moveTo(0, p); gridCtx.lineTo(width, p); }
  gridCtx.strokeStyle = '#25343a20'; gridCtx.lineWidth = 1; gridCtx.stroke(); schedule(true);
}
document.querySelector<HTMLSelectElement>('#grid-mode')!.onchange = fitGrid;
document.querySelector<HTMLButtonElement>('#fit-grid')!.onclick = fitGrid;
function point(event: PointerEvent): Point {
  const box = canvas.getBoundingClientRect();
  cursor.style.left = `${event.clientX - box.left}px`; cursor.style.top = `${event.clientY - box.top}px`;
  const diameter = Number(slider.value) * box.width / field.width;
  cursor.style.width = cursor.style.height = `${diameter}px`;
  return [(event.clientX - box.left) / box.width * field.width, (event.clientY - box.top) / box.height * field.height];
}
function paint(next: Point) {
  const start = performance.now();
  referenceStroke(previous ?? next, next, Number(slider.value) / 2, slot);
  for (const index of field.paint(previous ?? next, next, Number(slider.value) / 2, slot)) dirty.add(index);
  editMs += performance.now() - start; previous = next; schedule();
}
canvas.addEventListener('pointerdown', event => {
  if (pointer !== undefined || event.button !== 0) return;
  if (document.querySelector<HTMLInputElement>('#inspect-cells')!.checked) {
    const [x, y] = point(event); inspector.show(Math.floor(y) * field.width + Math.floor(x)); return;
  }
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
  field = new CellField(selected === 'straight' ? 'straight' : selected === '32' ? 'experimental' : 'legacy', matching.checked, field.width, field.height);
  inspector.clear(); configureCapture(); paths = makePaths(); renderLegend(); clearReference();
  document.querySelector('#candidates')!.textContent = String(field.tables.candidates.length); schedule(true);
};
document.querySelector<HTMLButtonElement>('#example')!.onclick = () => {
  end(); field.clear(); inspector.clear(); clearReference();
  const start = performance.now();
  const stroke = (points: Point[], radius: number, color: number) => {
    const scale = Math.min(field.width, field.height) / 100;
    points = points.map(([x, y]): Point => [(field.width - 100 * scale) / 2 + x * scale, (field.height - 100 * scale) / 2 + y * scale]);
    radius *= scale;
    field.beginStroke(color);
    let previous = points[0]!;
    for (const point of points) { referenceStroke(previous, point, radius, color); field.paint(previous, point, radius, color); previous = point; }
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
document.querySelector<HTMLButtonElement>('#clear')!.onclick = () => { end(); field.clear(); inspector.clear(); clearReference(); schedule(true); };
document.querySelector<HTMLButtonElement>('#circles')!.onclick = () => {
  end(); field.clear(); inspector.clear(); clearReference();
  const start = performance.now();
  for (const [x, y, radius, color] of [[25, 30, 14, 1], [67, 28, 10.5, 2], [26, 72, 6.25, 5], [65, 70, 3.5, 4]]) {
    pageDab(x!, y!, radius!, color!);
  }
  editMs += performance.now() - start; schedule(true);
};
new ResizeObserver(resize).observe(wrap);

document.querySelector<HTMLSelectElement>('#view')!.onchange = event => {
  const view = (event.target as HTMLSelectElement).value;
  reference.hidden = view === 'cells';
  canvas.style.opacity = view === 'reference' ? '0' : '1';
  reference.style.mixBlendMode = view === 'difference' ? 'difference' : 'normal';
};

document.querySelector<HTMLButtonElement>('#overlap')!.onclick = () => {
  end(); field.clear(); inspector.clear(); clearReference();
  const start = performance.now();
  for (const [x, y, radius, color] of [[50, 50, 30, 1], [50, 35, 14, 5], [37, 57.5, 14, 5], [63, 57.5, 14, 5]]) {
    pageDab(x!, y!, radius!, color!);
  }
  editMs += performance.now() - start; schedule(true);
};

document.querySelector<HTMLInputElement>('#grid-phase')!.oninput = event => {
  document.querySelector('#phase-value')!.textContent = `${(event.target as HTMLInputElement).value} cells`;
};
document.querySelector<HTMLButtonElement>('#thin-curve')!.onclick = () => {
  end(); field.clear(); inspector.clear(); clearReference();
  document.querySelector<HTMLInputElement>('#capture-cells')!.checked = true; configureCapture();
  slider.value = '1'; document.querySelector('#diameter')!.textContent = '1 cells';
  const kind = document.querySelector<HTMLSelectElement>('#curve-kind')!.value as CurveKind;
  const offset = Number(document.querySelector<HTMLInputElement>('#grid-phase')!.value);
  const offsetY = Number(document.querySelector<HTMLInputElement>('#grid-phase-y')!.value);
  const jitter = Number(document.querySelector<HTMLInputElement>('#jitter')!.value);
  const seed = Number(document.querySelector<HTMLInputElement>('#noise-seed')!.value) >>> 0;
  const retrace = document.querySelector<HTMLInputElement>('#retrace')!.checked;
  const points = thinCurve(kind, [offset, offsetY], 240, { jitter, seed, retrace }).map(([x, y]): Point => [x + (field.width - 100) / 2, y + (field.height - 100) / 2]), start = performance.now();
  field.beginStroke(1);
  let previous = points[0]!;
  for (const point of points) { referenceStroke(previous, point, .5, 1); field.paint(previous, point, .5, 1); previous = point; }
  field.endStroke(); editMs += performance.now() - start; schedule(true);
  const selected = [...inspector.cells].find(([, diagnostic]) => diagnostic.mode === 'fallback') ?? [...inspector.cells][0];
  if (selected) inspector.show(selected[0]);
};

for (const [input, output] of [['#grid-phase-y', '#phase-y-value'], ['#jitter', '#jitter-value']]) {
  document.querySelector<HTMLInputElement>(input!)!.oninput = event => {
    document.querySelector(output!)!.textContent = `${(event.target as HTMLInputElement).value} cells`;
  };
}
