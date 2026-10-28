import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SelectionScreen } from '../../src/ui/SelectionScreen';
import { pictureRepository, pictureSaves } from '../../src/app/pictures';
import { workshopRepository } from '../../src/app/coloringBookWorkshop';
import type { SavedPicture } from '../../src/editor/savedPicture';

export async function checkColoringPageAction() {
  const stored = localStorage.getItem('studioodle.workshop.v2');
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container), originalMerge = workshopRepository.merge;
  const picture: SavedPicture = { id: 'page-action-test', title: 'Page action test', version: 5, updatedAt: Date.now() + 100000,
    format: 'landscape', size: { width: 320, height: 240 }, background: '#ffffff', leafColor: 0,
    document: { version: 5, width: 320, height: 240, surfaces: [{ id: 'canvas', kind: 'canvas', x: 0, y: 0, color: 0xffffff }, { id: 'circle', kind: 'circle', x: 137, y: 119, color: 0, scale: .3 }] } };
  const wait = async (check: () => unknown) => { for (let i = 0; i < 300; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw Error('Coloring-page action timed out'); };
  const action = () => container.querySelector<HTMLButtonElement>('.coloring-page-add');
  const assert = (ok: unknown, message: string) => { if (!ok) throw Error(message); };
  try {
    await pictureRepository.save(picture); await pictureSaves.flush();
    root.render(createElement(SelectionScreen, { onOpen: () => {}, onExit: () => {}, theme: 'dark', onThemeChange: () => {}, settings: { advancedPainting: true, mouseSpeed: 100 }, onSettingsChange: () => {} }));
    await wait(() => action() && !action()!.disabled);
    const plus = action()!.querySelector('svg')!.innerHTML;
    workshopRepository.merge = () => { throw Error('Injected page add failure'); };
    action()!.click();
    await wait(() => container.textContent?.includes('Could not save coloring page'));
    assert(!action()!.disabled && action()!.dataset.added !== 'true', 'Failed adds must remain available');
    workshopRepository.merge = originalMerge;
    action()!.click();
    await wait(() => action()?.dataset.added === 'true');
    assert(action()!.disabled && action()!.title === 'Added to coloring pages', 'Successful add must show disabled confirmation');
    assert(action()!.querySelector('svg')!.innerHTML !== plus, 'Plus must change to check');
    container.querySelector<HTMLButtonElement>('[aria-label="Close coloring pages"]')!.click();
    picture.updatedAt++;
    picture.document.surfaces[0]!.vectorPaint = { version: 1, regions: [{ id: 1, base: 0xff0000, blobs: [] }] };
    await pictureRepository.save(picture); await pictureSaves.flush();
    await wait(() => action()?.dataset.added === 'true');
    picture.updatedAt++; picture.document.surfaces[1]!.x++;
    await pictureRepository.save(picture); await pictureSaves.flush();
    await wait(() => action() && !action()!.disabled);
    assert(action()!.dataset.added !== 'true', 'A changed layout must restore the add action');
    root.render(createElement(SelectionScreen, { key: 'reload', onOpen: () => {}, onExit: () => {}, theme: 'dark', onThemeChange: () => {}, settings: { advancedPainting: true, mouseSpeed: 100 }, onSettingsChange: () => {} }));
    await wait(() => action() && !action()!.disabled);
    picture.updatedAt++; picture.document.surfaces[1]!.x--;
    await pictureRepository.save(picture); await pictureSaves.flush();
    await wait(() => action()?.dataset.added === 'true');
    return { successCheck: true, failureRetry: true, paintIgnored: true, layoutReset: true, persistentMatch: true };
  } finally {
    workshopRepository.merge = originalMerge; root.unmount(); container.remove();
    await pictureRepository.delete(picture.id);
    if (stored === null) localStorage.removeItem('studioodle.workshop.v2'); else localStorage.setItem('studioodle.workshop.v2', stored);
  }
}
