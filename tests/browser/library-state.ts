import { pictureSummary } from '../../src/editor/pictureSummary';
import { createElement, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { SavedPreview } from '../../src/ui/SavedPreview';
import { createRoot } from 'react-dom/client';
import { usePictureLibrary } from '../../src/ui/usePictureLibrary';
import { pictureRepository } from '../../src/app/pictures';
import type { SavedPicture } from '../../src/editor/savedPicture';

function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
async function waitFor(test: () => boolean) {
  for (let i=0; i<100; i++) { if (test()) return; await new Promise(resolve => setTimeout(resolve,10)); }
  throw Error('Library state did not settle');
}
export async function checkLibraryState() {
  const original = { ...pictureRepository };
  let pictures: SavedPicture[] = ['a','b','c'].map(id => ({ id, title: id, version: 6, updatedAt: 1,
    format: 'landscape', size: { width: 32, height: 24 }, background: '#ffffff', leafColor: 0,
    document: { version: 6, width: 32, height: 24, surfaces: [{ id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff }] },
  }));
  const initial = [...pictures], gates = new Map<string, () => void>();
  let lists = 0;
  pictureRepository.list = async () => { lists++; return pictures.map(pictureSummary); };
  pictureRepository.get = async id => pictures.find(picture => picture.id === id);
  pictureRepository.save = async picture => { pictures = [picture, ...pictures.filter(item => item.id !== picture.id)]; };
  pictureRepository.delete = id => new Promise(resolve => { gates.set(id, () => { pictures = pictures.filter(item => item.id !== id); resolve(); }); });
  let current: ReturnType<typeof usePictureLibrary> | undefined;
  function Probe() {
    const state = usePictureLibrary();
    useLayoutEffect(() => { current = state; });
    const summary = state.saved[state.sampleIndex];
    return summary ? createElement(SavedPreview, { key: summary.id, picture: state.current ?? summary,
      pending: !state.current && !state.currentError, unavailable: state.currentError }) : null;
  }
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
    root.render(createElement(Probe));await waitFor(() => current?.saved.length === 3);
    await waitFor(() => host.querySelector('.saved-preview')?.getAttribute('aria-busy') === 'false');
    // Both neighbors have finished their microtask-only prefetch by this point.
    for (const index of [1, 0, 2, 0, 1, 0]) {
      flushSync(() => current!.setSampleIndex(index));
      assert(current!.current?.id === initial[index]!.id, 'Cached navigation must not briefly report pending data');
      await new Promise(requestAnimationFrame);
      assert(host.querySelector('.saved-preview')?.getAttribute('aria-busy') === 'false', 'Warm preview must be ready for the next painted frame');
      assert(!host.querySelector('.preview-loading'), 'Warm navigation must not flash a loading indicator');
    }
    const background = { ...initial[0]!, id: 'background-'+crypto.randomUUID() };
    let finish!: () => void;
    const prepared = new Promise<void>(resolve => { finish = resolve; });
    const before = lists;
    const saving = original.save(background, async () => { await prepared; return background; });
    try {
      await waitFor(() => lists > before);
      await new Promise(requestAnimationFrame);
      const duringSave = lists;
      finish(); await saving;
      await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
      assert(lists === duringSave, 'Save completion must not refresh an unchanged library or restart preview loading');
      assert(host.querySelector('.saved-preview')?.getAttribute('aria-busy') === 'false','An unrelated save must keep the current preview ready');
    } finally { finish(); await saving; await original.delete(background.id); }
    current!.setSampleIndex(2);await waitFor(() => current?.sampleIndex === 2);
    const actions=current!;
    const first=actions.removePicture(initial[0]!), second=actions.removePicture(initial[1]!);
    gates.get('b')!();gates.get('a')!();await Promise.all([first,second]);
    await waitFor(() => current?.saved.length === 1);
    assert(current!.saved[0]!.id === 'c' && current!.sampleIndex === 0, 'Completed deletes must compose and clamp carousel selection');
    await current!.restorePicture(initial[0]!);await waitFor(() => current?.saved.length === 2);
    assert(current!.saved[current!.sampleIndex]!.id === 'a', 'Restore must select the restored drawing');
    flushSync(() => root.render(createElement(SavedPreview, { picture: initial[0]!, pending: true })));
    const indicator = host.querySelector<HTMLElement>('.preview-loading')!;
    const reveal = indicator.getAnimations().find(animation => (animation as CSSAnimation).animationName === 'preview-loading-reveal')!;
    assert(reveal, 'Pending preview must have delayed loading feedback');
    reveal.pause(); reveal.currentTime = 0;
    assert(getComputedStyle(indicator).visibility === 'hidden', 'Brief loads must not flash a spinner');
    reveal.currentTime = 121;
    assert(getComputedStyle(indicator).visibility === 'visible', 'Slow loads must still show the spinner');
    flushSync(() => root.render(createElement(SavedPreview, { picture: initial[0]!, unavailable: true })));
    assert(getComputedStyle(indicator).visibility === 'visible' && !!indicator.querySelector('svg'), 'Load failures must display immediately');
    return { concurrentDeletes: true, selectionClamp: true, restoreSelection: true, warmNavigation: true, quietSaveCompletion: true, delayedSpinner: true };
  } finally { root.unmount();host.remove();Object.assign(pictureRepository,original); }
}
