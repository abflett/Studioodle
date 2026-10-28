/* global URLSearchParams, location, document, window, ResizeObserver, devicePixelRatio */
(() => {
  const params = new URLSearchParams(location.search);
  if (params.has('preview')) document.body.classList.add('preview');
  if (params.get('theme') === 'light') document.body.classList.add('light');
  const paths = {
    close: '<path d="m6 6 12 12M6 18 18 6"/>', minus: '<path d="M5 12h14"/>', plus: '<path d="M5 12h14M12 5v14"/>',
    clear: '<path d="m16 4 5 5-11 11H5l-3-3L15 4q.5-.5 1 0ZM8 11l6 6M10 20h11"/>',
    round: '<circle cx="12" cy="12" r="7"/>', square: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
    oval: '<ellipse cx="12" cy="12" rx="5" ry="8" transform="rotate(35 12 12)"/>', chisel: '<path d="m7 5 13 3-3 11L4 16Z"/>',
    hand: '<path d="m10 12-1-5q-.5-3 1-3t2 2l1 5 1-2q1-2 2 0l1 3q2-2 3 0l1 5-4 5h-6l-6-7q-2-3 0-3l5 4"/>',
  };
  const svg = (body, box = '0 0 24 24', cls = '') => `<svg viewBox="${box}" aria-hidden="true" class="${cls}">${body}</svg>`;
  const art = {
    ink: '<path d="m18 45 4-17L43 8l12 12-20 20-17 5Z" fill="currentColor" fill-opacity=".07"/><path d="m22 28 13 12M27 23l13 12M43 8l4-4 12 12-4 4M18 45l9-7"/><circle cx="30" cy="33" r="2.2"/><path d="M18 45c-8 4-10 10-2 11 7 1 5-8 13-6 5 1 10 2 13-2" stroke-width="1.6"/>',
    pencil: '<path d="m13 48 4-14L43 8q3-3 6 0l6 6q3 3 0 6L29 46l-16 2Z" fill="currentColor" fill-opacity=".06"/><path d="m17 34 12 12M39 12l12 12M20 37l24-24M26 43l24-24M13 48l5-2-3-3Z" fill="currentColor" fill-opacity=".2"/><path d="M10 56c7-6 8 2 14-2s8-3 15-2" stroke-width="1.5"/>',
    brush: '<path d="M29 32 46 7q4-5 7-2t0 7L35 37Z" fill="currentColor" fill-opacity=".09"/><path d="m29 32 6 5-4 6-8-6ZM24 38c-10 2-7 14-16 14 10 9 27 5 24-9"/><path d="M13 53q11 2 15-10M20 53q7-3 8-10" stroke-width="1.3"/>',
    spray: '<path d="M32 21h17v31q0 6-8.5 6T32 52ZM32 28h17M32 49h17M36 21v-8h9v8M36 13h9M40 13V9h5v4" fill="currentColor" fill-opacity=".05"/><path d="M22 17h-3M24 23h-6M23 29h-3" stroke-width="2"/><g fill="currentColor" stroke="none"><circle cx="12" cy="14" r="1.4"/><circle cx="9" cy="23" r="1"/><circle cx="11" cy="31" r="1.4"/><circle cx="17" cy="8" r="1"/><circle cx="15" cy="37" r="1"/></g>',
  };
  const samples = {
    ink: '<path d="M4 14C21-2 26 24 43 11S62 7 76 10"/>',
    pencil: '<path d="M4 14C21-2 26 24 43 11S62 7 76 10" stroke-dasharray=".7 1.1" stroke-width="2.8"/><path d="M4 15C21-1 26 25 43 12S62 8 76 11" opacity=".35" stroke-width="1"/>',
    brush: '<path d="M4 14C21-2 26 24 43 11S62 7 76 10" stroke-width="5" opacity=".8"/><path d="M8 17C21 2 26 27 43 14S62 10 73 13" stroke-width=".8" opacity=".6"/>',
    spray: '<path d="M4 14C21-2 26 24 43 11S62 7 76 10" stroke-width="7" stroke-dasharray=".1 2.4" opacity=".45"/><path d="M4 12C21-4 26 22 43 9S62 5 76 8" stroke-width="2" stroke-dasharray=".1 2.9" opacity=".8"/>',
  };
  let kind = 'ink', shape = 'round', size = 12, drawing, seed = 17, hasDrawing = false;
  const canvas = document.querySelector('#preview'), context = canvas.getContext('2d');
  const slider = document.querySelector('#size'), number = document.querySelector('#size-number');
  const tools = document.querySelector('.tools'), tips = document.querySelector('.tips');
  ['ink', 'pencil', 'brush', 'spray'].forEach(type => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'tool';
    button.dataset.kind = type; button.title = { ink: 'Ink pen', pencil: 'Pencil', brush: 'Paintbrush', spray: 'Spray' }[type];
    button.setAttribute('aria-label', button.title);
    button.innerHTML = svg(art[type], '0 0 64 64', 'tool-art') + svg(samples[type], '0 0 80 22', 'stroke-sample');
    button.onclick = () => { kind = type; update(); }; tools.append(button);
  });
  ['round', 'square', 'oval', 'chisel'].forEach(tip => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'tip'; button.dataset.shape = tip;
    button.title = `${tip[0].toUpperCase() + tip.slice(1)} tip`; button.setAttribute('aria-label', button.title);
    button.innerHTML = svg(paths[tip]); button.onclick = () => { shape = tip; update(); }; tips.append(button);
  });
  document.querySelector('.close').innerHTML = svg(paths.close);
  document.querySelector('.clear').innerHTML = svg(paths.clear);
  document.querySelector('.practice-hint').innerHTML = svg(paths.hand);
  document.querySelector('.smaller').innerHTML = svg(paths.minus);
  document.querySelector('.larger').innerHTML = svg(paths.plus);
  document.querySelector('.apply').innerHTML = svg('<path d="M3 23c9-7 14 7 23 0" opacity=".55" stroke-width="1.6"/><path d="m30 15 9 9L59 5" stroke-width="3"/>', '0 0 64 32');
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const ink = '#8a6ab0';
  const insideTip = (x, y, radius) => {
    if (shape === 'square') return Math.abs(x) <= radius && Math.abs(y) <= radius;
    if (shape === 'round') return x * x + y * y <= radius * radius;
    const angle = shape === 'chisel' ? -Math.PI / 5 : Math.PI / 5;
    const u = x * Math.cos(angle) + y * Math.sin(angle), v = -x * Math.sin(angle) + y * Math.cos(angle);
    return shape === 'chisel' ? Math.abs(u) <= radius && Math.abs(v) <= radius * .28 : (u / (radius * .5)) ** 2 + (v / radius) ** 2 <= 1;
  };
  function stamp(x, y) {
    const radius = size / 2; context.save(); context.translate(x, y); context.fillStyle = ink;
    if (kind === 'spray') {
      for (let i = 0; i < 18; i++) { const px = (random() - .5) * size, py = (random() - .5) * size; if (!insideTip(px, py, radius)) continue; context.globalAlpha = .12 + random() * .5; context.beginPath(); context.arc(px, py, .35 + random() * Math.max(.35, size / 45), 0, Math.PI * 2); context.fill(); }
    } else if (kind === 'pencil') {
      context.globalAlpha = .24;
      for (let i = 0; i < Math.max(3, size * 1.2); i++) { const px = (random() - .5) * size, py = (random() - .5) * size; if (insideTip(px, py, radius)) context.fillRect(px, py, .65, .65); }
    } else {
      context.globalAlpha = kind === 'brush' ? .4 : 1;
      context.beginPath();
      if (shape === 'square') context.rect(-radius, -radius, size, size);
      else if (shape === 'oval') context.ellipse(0, 0, radius * .5, radius, Math.PI / 5, 0, Math.PI * 2);
      else if (shape === 'chisel') { context.rotate(-Math.PI / 5); context.rect(-radius, -radius * .28, size, size * .56); }
      else context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fill();
      if (kind === 'brush') { context.clip(); context.globalAlpha = .22; context.fillRect(-radius * .18, -radius * 1.12, Math.max(.5, size * .06), size * 2.24); }
    }
    context.restore();
  }
  function segment(a, b) {
    const distance = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(distance / Math.max(.7, size * .07)));
    for (let i = 1; i <= steps; i++) stamp(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps);
  }
  function sample() {
    if (!context) return;
    const box = canvas.getBoundingClientRect(); context.clearRect(0, 0, box.width, box.height); seed = 17;
    let previous;
    for (let i = 0; i <= 240; i++) {
      const t = i / 240, point = { x: box.width * (.12 + .76 * t), y: box.height * (.5 - .19 * Math.sin(t * Math.PI * 2.2 - .3)) };
      if (previous) segment(previous, point); else stamp(point.x, point.y); previous = point;
    }
    hasDrawing = false;
  }
  function update() {
    document.querySelectorAll('[data-kind]').forEach(button => button.setAttribute('aria-pressed', button.dataset.kind === kind));
    document.querySelectorAll('[data-shape]').forEach(button => button.setAttribute('aria-pressed', button.dataset.shape === shape));
    slider.value = number.value = size; slider.style.setProperty('--progress', `${(size - 1) / 63 * 100}%`);
    document.querySelector('.smaller').disabled = size === 1; document.querySelector('.larger').disabled = size === 64;
    sample();
  }
  function setSize(value) { if (!Number.isFinite(Number(value)) || value === '') return; size = Math.max(1, Math.min(64, Math.round(Number(value)))); update(); }
  slider.oninput = event => setSize(event.target.value); number.oninput = event => setSize(event.target.value); number.onblur = () => { number.value = size; };
  document.querySelector('.smaller').onclick = () => setSize(size - 1); document.querySelector('.larger').onclick = () => setSize(size + 1);
  const resize = () => {
    const box = canvas.getBoundingClientRect(), density = devicePixelRatio || 1;
    if (!box.width || !box.height) return;
    canvas.width = Math.round(box.width * density); canvas.height = Math.round(box.height * density);
    context.setTransform(density, 0, 0, density, 0, 0); sample();
  };
  new ResizeObserver(resize).observe(canvas);
  const point = event => { const box = canvas.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top }; };
  canvas.onpointerdown = event => {
    if (event.button !== 0 || drawing) return; event.preventDefault();
    if (!hasDrawing) { const box = canvas.getBoundingClientRect(); context.clearRect(0, 0, box.width, box.height); hasDrawing = true; }
    drawing = { id: event.pointerId, previous: point(event) }; canvas.setPointerCapture(event.pointerId); stamp(drawing.previous.x, drawing.previous.y);
  };
  canvas.onpointermove = event => { if (drawing?.id !== event.pointerId) return; const next = point(event); segment(drawing.previous, next); drawing.previous = next; };
  const finish = event => { if (drawing?.id !== event.pointerId) return; drawing = undefined; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
  canvas.onpointerup = finish; canvas.onpointercancel = finish; canvas.onlostpointercapture = finish;
  document.querySelector('.clear').onclick = () => { const box = canvas.getBoundingClientRect(); context.clearRect(0, 0, box.width, box.height); hasDrawing = true; };
  const notice = message => { const element = document.querySelector('.notice'); element.textContent = message; element.classList.add('visible'); window.clearTimeout(window.noticeTimer); window.noticeTimer = window.setTimeout(() => element.classList.remove('visible'), 2600); };
  document.querySelector('.apply').onclick = () => notice(`Study only: use ${kind}, ${shape} tip, size ${size}.`);
  document.querySelector('.close').onclick = () => notice('Study only: close brush options.');
  document.querySelector('#theme').onclick = () => document.body.classList.toggle('light');
  window.brushStudy = { set: options => { if (art[options.kind]) kind = options.kind; if (['round', 'square', 'oval', 'chisel'].includes(options.shape)) shape = options.shape; if (options.size !== undefined) size = Math.max(1, Math.min(64, Math.round(options.size))); update(); }, state: () => ({ kind, shape, size }) };
  update();
})();
