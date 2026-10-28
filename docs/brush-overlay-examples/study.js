/* global URLSearchParams, location, document, window, ResizeObserver, devicePixelRatio, getComputedStyle */
(() => {
  const params = new URLSearchParams(location.search);
  if (params.has('preview')) document.body.classList.add('preview');
  if (params.get('theme') === 'light') document.body.classList.add('light');
  const svg = (body, box = '0 0 24 24') => `<svg viewBox="${box}" aria-hidden="true">${body}</svg>`;
  const effects = {
    round: { label: 'Round tip', art: '<circle cx="24" cy="24" r="12" fill="currentColor" stroke="none"/>' },
    rising: { label: 'Diagonal tip, rising', art: '<path d="m14 34 20-20" stroke-width="6"/>' },
    falling: { label: 'Diagonal tip, falling', art: '<path d="m14 14 20 20" stroke-width="6"/>' },
    spray: { label: 'Scattered circle tip', art: '<g fill="currentColor" stroke="none">'+[[23,24,2.9],[27,20,2.6],[19,20,2],[22,16,1.8],[17,26,2.5],[28,27,2.8],[23,30,2.4],[30,23,1.8],[31,32,1.7],[15,18,1.3],[16,33,1.4],[25,35,1.5],[33,16,1.2],[12,25,1.1],[24,10,1.1],[36,26,1.1],[12,35,1],[35,36,1],[18,11,1],[29,13,1.3]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')+'</g>' },
  };
  let tip = 'round', size = 12, seed = 17;
  const canvas = document.querySelector('#preview'), context = canvas.getContext('2d');
  const slider = document.querySelector('#size'), number = document.querySelector('#size-number');
  for (const [id, effect] of Object.entries(effects)) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'tip';
    button.dataset.tip = id; button.title = effect.label; button.setAttribute('aria-label', effect.label);
    button.innerHTML = svg(effect.art, '0 0 48 48');
    button.onclick = () => { tip = id; update(); }; document.querySelector('.tips').append(button);
  }
  document.querySelector('.close').innerHTML = svg('<path d="m6 6 12 12M6 18 18 6"/>');
  document.querySelector('.smaller').innerHTML = svg('<path d="M5 12h14"/>');
  document.querySelector('.larger').innerHTML = svg('<path d="M5 12h14M12 5v14"/>');
  document.querySelector('.apply').innerHTML = svg('<path d="m6 12 4 4L19 7"/>');
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  function stamp(x, y, t) {
    const diameter = size * .58, radius = diameter / 2; context.save(); context.translate(x, y);
    if (tip === 'spray') {
      // Opaque circles accumulate; the static middle depicts a longer dwell.
      const passes = 1 + Math.floor(10 * Math.sin(t * Math.PI) ** 4);
      for (let i = 0; i < passes * 7; i++) {
        const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * radius;
        context.beginPath(); context.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, Math.max(.65, diameter * .035), 0, Math.PI * 2); context.fill();
      }
    } else {
      context.beginPath();
      if (tip === 'round') context.arc(0, 0, radius, 0, Math.PI * 2);
      else { context.rotate(tip === 'rising' ? -Math.PI / 4 : Math.PI / 4); context.roundRect(-radius, -Math.max(.6, radius * .14), diameter, Math.max(1.2, diameter * .14), .5); }
      context.fill();
    }
    context.restore();
  }
  function sample() {
    if (!context) return;
    const box = canvas.getBoundingClientRect(); context.clearRect(0, 0, box.width, box.height); seed = 17;
    context.fillStyle = getComputedStyle(document.body).getPropertyValue('--sample-ink').trim();
    const steps = Math.max(80, Math.ceil(box.width * .78 / Math.max(.6, size * (tip === 'spray' ? .18 : .045))));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      stamp(box.width * (.11 + .78 * t), box.height * (.5 - .16 * Math.sin(t * Math.PI * 2)), t);
    }
    canvas.setAttribute('aria-label', `${effects[tip].label}, size ${size}: premade curved stroke${tip === 'spray' ? ', with a denser accumulation of opaque circles in the middle' : ''}.`);
  }
  function update() {
    document.querySelectorAll('[data-tip]').forEach(button => button.setAttribute('aria-pressed', button.dataset.tip === tip));
    slider.value = number.value = size; slider.style.setProperty('--progress', `${(size - 1) / 63 * 100}%`);
    document.querySelector('.smaller').disabled = size === 1; document.querySelector('.larger').disabled = size === 64;
    sample();
  }
  function setSize(value) { if (!Number.isFinite(Number(value)) || value === '') return; size = Math.max(1, Math.min(64, Math.round(Number(value)))); update(); }
  slider.oninput = event => setSize(event.target.value); number.oninput = event => setSize(event.target.value); number.onblur = () => { number.value = size; };
  document.querySelector('.smaller').onclick = () => setSize(size - 1); document.querySelector('.larger').onclick = () => setSize(size + 1);
  new ResizeObserver(() => {
    const box = canvas.getBoundingClientRect(), density = devicePixelRatio || 1;
    if (!box.width || !box.height) return;
    canvas.width = Math.round(box.width * density); canvas.height = Math.round(box.height * density);
    context.setTransform(density, 0, 0, density, 0, 0); sample();
  }).observe(canvas);
  const notice = message => { const element = document.querySelector('.notice'); element.textContent = message; element.classList.add('visible'); window.clearTimeout(window.noticeTimer); window.noticeTimer = window.setTimeout(() => element.classList.remove('visible'), 2600); };
  document.querySelector('.apply').onclick = () => notice(`Study only: use ${effects[tip].label.toLowerCase()}, size ${size}.`);
  document.querySelector('.close').onclick = () => notice('Study only: close brush options.');
  document.querySelector('#theme').onclick = () => { document.body.classList.toggle('light'); sample(); };
  window.brushStudy = { set: options => { if (effects[options.tip]) tip = options.tip; if (options.size !== undefined && Number.isFinite(Number(options.size))) size = Math.max(1, Math.min(64, Math.round(options.size))); update(); }, state: () => ({ tip, size }) };
  update();
})();
