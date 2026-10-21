import { createElement, useLayoutEffect } from 'react';
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
  let pictures: SavedPicture[] = ['a','b','c'].map(id => ({ id, title: id, version: 5, updatedAt: 1,
    format: 'landscape', size: { width: 32, height: 24 }, background: '#ffffff', leafColor: 0,
    document: { version: 5, width: 32, height: 24, surfaces: [{ id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff }] },
  }));
  const initial = [...pictures], gates = new Map<string, () => void>();
  pictureRepository.load = async () => [...pictures];
  pictureRepository.save = async picture => { pictures = [picture, ...pictures.filter(item => item.id !== picture.id)]; };
  pictureRepository.delete = id => new Promise(resolve => { gates.set(id, () => { pictures = pictures.filter(item => item.id !== id); resolve(); }); });
  let current: ReturnType<typeof usePictureLibrary> | undefined;
  function Probe() {
    const state = usePictureLibrary();
    useLayoutEffect(() => { current = state; });
    return null;
  }
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
    root.render(createElement(Probe));await waitFor(() => current?.saved.length === 3);
    current!.setSampleIndex(2);await waitFor(() => current?.sampleIndex === 2);
    const actions=current!;
    const first=actions.removePicture(initial[0]!), second=actions.removePicture(initial[1]!);
    gates.get('b')!();gates.get('a')!();await Promise.all([first,second]);
    await waitFor(() => current?.saved.length === 1);
    assert(current!.saved[0]!.id === 'c' && current!.sampleIndex === 0, 'Completed deletes must compose and clamp carousel selection');
    await current!.restorePicture(initial[0]!);await waitFor(() => current?.saved.length === 2);
    assert(current!.saved[current!.sampleIndex]!.id === 'a', 'Restore must select the restored drawing');
    return { concurrentDeletes: true, selectionClamp: true, restoreSelection: true };
  } finally { root.unmount();host.remove();Object.assign(pictureRepository,original); }
}
