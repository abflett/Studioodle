import { invoke, isTauri } from '@tauri-apps/api/core';

export const isDesktop = isTauri();

export async function closeDesktop() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().close();
}

export async function toggleDesktopFullscreen() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const window = getCurrentWindow();
  const fullscreen = !await window.isFullscreen();
  await window.setFullscreen(fullscreen);
  return fullscreen;
}

export async function watchDesktopFullscreen(update: (fullscreen: boolean) => void) {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const window = getCurrentWindow();
  update(await window.isFullscreen());
  return window.onResized(() => { void window.isFullscreen().then(update); });
}

export async function guardDesktopClose(save: (close: () => void) => void) {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const window = getCurrentWindow();
  let allowClose = false, saving = false;
  return window.onCloseRequested(event => {
    if (allowClose) return;
    event.preventDefault();
    if (saving) return;
    saving = true;
    save(() => { allowClose = true; void window.close(); });
    // A failed save can be retried by closing again.
    setTimeout(() => { saving = false; }, 1000);
  });
}

export async function saveDesktopPng(blob: Blob, name: string) {
  document.exitPointerLock?.();
  await invoke<boolean>('save_png', { name, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) });
}

let clearPrint: (() => void) | undefined;
export async function printDesktopPicture(source: string, title: string) {
  document.exitPointerLock?.();
  clearPrint?.();
  const image = new Image();
  image.className = 'desktop-print-picture'; image.alt = title; image.src = source;
  const previousTitle = document.title;
  let timeout: ReturnType<typeof setTimeout>;
  const cleanup = () => {
    image.remove(); document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup); clearTimeout(timeout);
    if (clearPrint === cleanup) clearPrint = undefined;
  };
  clearPrint = cleanup;
  try {
    await image.decode();
    document.body.append(image); document.title = title;
    window.addEventListener('afterprint', cleanup, { once: true });
    timeout = setTimeout(cleanup, 10 * 60_000);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await invoke('print_picture');
  } catch (error) { cleanup(); throw error; }
}
