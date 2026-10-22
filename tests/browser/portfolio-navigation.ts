function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
async function ready(previousLabel?: string | null) {
  for (let i = 0; i < 200; i++) {
    if (document.querySelector('.portfolio-page .saved-preview[aria-busy="false"]') && (!previousLabel || document.querySelector('.previous-picture')?.getAttribute('aria-label') !== previousLabel)) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error('Portfolio preview did not become ready');
}

function paperGeometry() {
  const stage = document.querySelector<HTMLElement>('.portfolio-stage')!;
  const pile = document.querySelector<HTMLElement>('.portfolio-pile')!;
  const preview = document.querySelector<HTMLElement>('.portfolio-page .saved-preview')!;
  const [width, height] = preview.style.aspectRatio.split('/').map(Number);
  const ratio = pile.offsetWidth / pile.offsetHeight;
  assert(Math.abs(ratio - width! / height!) < .03, 'The front sheet must follow the saved picture aspect ratio');
  const arrow = document.querySelector('[aria-label="Next saved picture"]')!.getBoundingClientRect();
  return { width: stage.offsetWidth, height: stage.offsetHeight, arrowY: arrow.y, ratio };
}

/** Run against landscape and portrait saves after the library has opened. */
export async function checkPortfolioNavigation() {
  await ready();
  const open = document.querySelector<HTMLButtonElement>('.previous-picture')!;
  const firstGeometry = paperGeometry();
  const stack = document.querySelector<HTMLImageElement>('.portfolio-stack-art')!;
  const stackSource = stack.currentSrc;
  const stackBox = stack.getBoundingClientRect();
  assert(stack.complete && stack.naturalWidth > 0, 'The permanent illustrated stack must be ready');
  const original = open.getAttribute('aria-label');
  const next = document.querySelector<HTMLButtonElement>('[aria-label="Next saved picture"]')!;
  const previous = document.querySelector<HTMLButtonElement>('[aria-label="Previous saved picture"]')!;
  assert(!next.disabled && !previous.disabled, 'Two saved pictures must enable browsing');
  next.click(); await ready(original);
  assert(open.getAttribute('aria-label') !== original, 'Next must change the saved picture');
  assert(getComputedStyle(document.querySelector('.portfolio-page')!).animationName === 'portfolio-next', 'Forward navigation must turn forward: ' + getComputedStyle(document.querySelector('.portfolio-page')!).animationName);
  const secondGeometry = paperGeometry();
  const nextStackBox = stack.getBoundingClientRect();
  assert(stack.currentSrc === stackSource && stackBox.width === nextStackBox.width && stackBox.height === nextStackBox.height, 'The illustrated base must not change with the picture ratio');
  assert(firstGeometry.width === secondGeometry.width && firstGeometry.height === secondGeometry.height && firstGeometry.arrowY === secondGeometry.arrowY, 'Picture proportions must not move the browsing stage or arrows');
  assert(Math.abs(firstGeometry.ratio - secondGeometry.ratio) > .1, 'The fixture must exercise different picture proportions');
  assert(!document.querySelector('.portfolio-binding'), 'Saved sheets must not have booklet rings');
  const second = open.getAttribute('aria-label');
  previous.click(); await ready(second);
  assert(open.getAttribute('aria-label') === original, 'Previous must return to the first saved picture');
  assert(document.querySelector('.portfolio-page .saved-preview[aria-busy="false"]') && !document.querySelector('.portfolio-page .preview-loading'), 'Cached portfolio navigation must not reintroduce a loading flash');
  assert(getComputedStyle(document.querySelector('.portfolio-page')!).animationName === 'portfolio-previous', 'Backward navigation must turn backward');
  const remove = document.querySelector<HTMLButtonElement>('[aria-label="Delete selected saved picture"]')!;
  const box = remove.getBoundingClientRect();
  assert(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button') === remove, 'Utility buttons must take priority over the portfolio open target');
  return { next: true, previous: true, cachedPreview: true, utilityPriority: true, proportionalSheets: true, stableArrows: true, permanentStack: true };
}
