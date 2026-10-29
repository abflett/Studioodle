import { invoke, isTauri } from '@tauri-apps/api/core';

export const isNative = isTauri();
export const isDesktop = isNative && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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

export async function guardDesktopClose(save: () => Promise<boolean>, onError: () => void) {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const window = getCurrentWindow();
  let active = true, allowClose = false, saving = false;
  const stop = await window.onCloseRequested(async event => {
    if (allowClose || !active) return;
    event.preventDefault();
    if (saving) return;
    saving = true;
    try {
      const saved = await save();
      if (!active) return;
      if (!saved) { onError(); return; }
      allowClose = true;
      await window.close();
    } catch { allowClose = false; if (active) onError(); }
    finally { saving = false; }
  });
  return () => { active = false; stop(); };
}

export async function saveDesktopPicture(blob: Blob, name: string, format: 'png' | 'svg' | 'pdf') {
  document.exitPointerLock?.();
  await invoke<boolean>('save_picture', { name, format, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) });
}

let clearPrint: (() => void) | undefined;
export async function printDesktopPicture(svg: SVGSVGElement, title: string) {
  document.exitPointerLock?.();
  clearPrint?.();
  const artwork = svg;
  artwork.classList.add('desktop-print-picture');
  artwork.setAttribute('aria-label', title);
  const previousTitle = document.title;
  const pageStyle = document.createElement('style');
  const [, , width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number);
  pageStyle.textContent = `@page{size:${width! / 96}in ${height! / 96}in;margin:0}`;
  let timeout: ReturnType<typeof setTimeout>;
  const cleanup = () => {
    artwork.remove(); pageStyle.remove(); document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup); clearTimeout(timeout);
    if (clearPrint === cleanup) clearPrint = undefined;
  };
  clearPrint = cleanup;
  try {
    document.head.append(pageStyle); document.body.append(artwork); document.title = title;
    window.addEventListener('afterprint', cleanup, { once: true });
    timeout = setTimeout(cleanup, 10 * 60_000);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await invoke('print_picture');
  } catch (error) { cleanup(); throw error; }
}
