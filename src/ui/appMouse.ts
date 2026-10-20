import { useEffect, useSyncExternalStore } from 'react';
import { isDesktop } from '../platform/desktop';

// A separate id lets the existing gesture handlers use our virtual capture
// instead of asking the browser to capture a synthetic pointer.
export const appMousePointerId = 21332;
type Status = 'ready' | 'idle' | 'starting' | 'active' | 'error' | 'unsupported';
let status: Status = typeof document.documentElement.requestPointerLock === 'function' ? 'idle' : 'unsupported';
let speed = .5;
const enabledKey = 'studioodle.mouse-adjusted';
let resumeOnClick = false;
function rememberMouse(enabled: boolean) {
  if (!isDesktop) return;
  try { localStorage.setItem(enabledKey, String(enabled)); } catch { /* Keep current control working without storage. */ }
}
function savedMouseEnabled() {
  try { return isDesktop && localStorage.getItem(enabledKey) === 'true'; } catch { return false; }
}
const listeners = new Set<() => void>();
function publish(next: Status) {
  status = next;
  for (const listener of listeners) listener();
}
export function useAppMouseStatus() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => status);
}
export function startAppMouse() {
  if (status === 'unsupported' || status === 'starting' || status === 'active') return;
  publish('starting');
  try {
    void Promise.resolve(document.documentElement.requestPointerLock()).catch(() => publish('error'));
  } catch { publish('error'); }
}
export function stopAppMouse() {
  resumeOnClick = false; rememberMouse(false);
  if (status === 'ready') publish('idle');
  document.exitPointerLock?.();
}
// Native dialogs, focus loss and app exit must not erase the enabled preference.
export function suspendAppMouse() { document.exitPointerLock?.(); }

/** One coordinate source for both the drawn cursor and all routed app input. */
function installAppMouse() {
  const root = document.documentElement;
  resumeOnClick = savedMouseEnabled();
  if (resumeOnClick && status !== 'unsupported') publish('ready');
  const cursor = document.createElement('div');
  cursor.className = 'app-mouse-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.popover = 'manual';
  document.body.append(cursor);
  let x = innerWidth / 2, y = innerHeight / 2;
  let locked = false, buttons = 0, frame = 0;
  let hover: Element | null = null;
  let hoverButton: Element | null = null;
  let press: { target: Element; button: number; compatibility: boolean } | undefined;
  let lastEvent: MouseEvent | undefined;
  let lastCursor = '', lastTransform = '';
  let hotspotX = 5, hotspotY = 3;
  const hit = () => document.elementFromPoint(x, y) ?? root;
  const init = (event?: MouseEvent): MouseEventInit => ({
    bubbles: true, cancelable: true, composed: true,
    clientX: x, clientY: y, screenX: x, screenY: y,
    button: event?.button ?? 0, buttons,
    altKey: event?.altKey, ctrlKey: event?.ctrlKey, metaKey: event?.metaKey, shiftKey: event?.shiftKey,
  });
  const mouse = (target: Element, type: string, event?: MouseEvent, relatedTarget?: Element | null) =>
    target.dispatchEvent(new MouseEvent(type, { ...init(event), relatedTarget }));
  const pointer = (target: Element, type: string, event?: MouseEvent, relatedTarget?: Element | null) =>
    target.dispatchEvent(new PointerEvent(type, {
      ...init(event), relatedTarget, pointerId: appMousePointerId, pointerType: 'mouse',
      isPrimary: true, width: 1, height: 1, pressure: buttons ? .5 : 0,
    }));
  const setHover = (target: Element | null) => {
    if (target === hover) return;
    const previous = hover;
    hover = target;
    hoverButton?.classList.remove('app-mouse-hover');
    hoverButton = target?.closest('button, a, summary, input, [role="button"]') ?? null;
    hoverButton?.classList.add('app-mouse-hover');
    if (previous?.isConnected) {
      pointer(previous, 'pointerout', lastEvent, target);
      mouse(previous, 'mouseout', lastEvent, target);
    }
    if (target) {
      pointer(target, 'pointerover', lastEvent, previous);
      mouse(target, 'mouseover', lastEvent, previous);
    }
  };
  const showCursor = () => {
    cursor.hidden = false;
    if (cursor.showPopover) { cursor.hidePopover(); cursor.showPopover(); }
  };
  const draw = () => {
    const target = press?.target.isConnected ? press.target : hit();
    if (!press) setHover(target);
    const css = getComputedStyle(target);
    const canvas = target.closest('.art-canvas');
    const variable = canvas ? (press ? '--tool-active-cursor' : '--tool-cursor')
      : target.closest('button, a, summary, label[for], input, select, [role="button"], [role="switch"]') ? '--app-cursor-pointer' : '--app-cursor-default';
    // Reuse the native cursor's density-aware image and its exact hotspot.
    const value = css.getPropertyValue(variable).trim();
    if (value !== lastCursor) {
      const match = value.match(/^(.+\))\s+(\d+)\s+(\d+),/);
      if (match) {
        lastCursor = value;
        cursor.style.backgroundImage = match[1]!;
        hotspotX = Number(match[2]); hotspotY = Number(match[3]);
      }
    }
    const transform = `translate3d(${x - hotspotX}px, ${y - hotspotY}px, 0)`;
    if (transform !== lastTransform) { cursor.style.transform = transform; lastTransform = transform; }
  };
  const tick = () => { if (!locked) return; draw(); frame = requestAnimationFrame(tick); };
  const cancel = () => {
    const active = press;
    press = undefined; buttons = 0;
    if (!active) return;
    active.target.closest('button')?.classList.remove('app-mouse-pressed');
    pointer(active.target, 'pointercancel', lastEvent);
    // Phaser listens to compatibility mouse events; release without a click.
    if (active.compatibility) mouse(active.target, 'mouseup', lastEvent);
  };
  const lockChange = () => {
    const next = document.pointerLockElement === root;
    if (next === locked) return;
    locked = next;
    if (locked) {
      resumeOnClick = false; rememberMouse(true);
      root.dataset.appMouse = 'true';
      showCursor(); publish('active'); tick();
    } else {
      cancel(); setHover(null); cancelAnimationFrame(frame);
      delete root.dataset.appMouse;
      if (cursor.hidePopover) cursor.hidePopover();
      cursor.hidden = true;
      publish('idle');
    }
  };
  const lockError = () => { if (!locked) publish('error'); };
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const rangeAt = (target: Element) => {
    if (!(target instanceof HTMLInputElement) || target.type !== 'range') return;
    const box = target.getBoundingClientRect();
    const min = Number(target.min || 0), max = Number(target.max || 100), step = Number(target.step || 1);
    const ratio = Math.max(0, Math.min(1, (x - box.left - 10) / Math.max(1, box.width - 20)));
    const value = Math.max(min, Math.min(max, min + Math.round(ratio * (max - min) / step) * step));
    // Use the native setter so React observes the input event as a change.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(target, String(value));
    target.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const move = (event: MouseEvent) => {
    if (!event.isTrusted) return;
    if (!locked) { x = event.clientX; y = event.clientY; return; }
    stop(event); lastEvent = event;
    const heldButton = press?.button === 2 ? 2 : press?.button === 1 ? 4 : 1;
    if (press && !(event.buttons & heldButton)) cancel();
    x = Math.max(0, Math.min(innerWidth - 1, x + event.movementX * speed));
    y = Math.max(0, Math.min(innerHeight - 1, y + event.movementY * speed));
    const target = press?.target ?? hit();
    if (!press) setHover(target);
    pointer(target, 'pointermove', event);
    if (!press || press.compatibility) mouse(target, 'mousemove', event);
    if (press) rangeAt(press.target);
    draw();
  };
  const down = (event: MouseEvent) => {
    if (!locked || !event.isTrusted) return;
    stop(event); lastEvent = event;
    if (press) return;
    buttons = event.buttons;
    const target = hit();
    const compatibility = pointer(target, 'pointerdown', event);
    press = { target, button: event.button, compatibility };
    target.closest('button')?.classList.add('app-mouse-pressed');
    if (compatibility) {
      (target.closest('button, input, select, a, summary, [tabindex]') as HTMLElement | null)?.focus({ preventScroll: true });
      mouse(target, 'mousedown', event);
      rangeAt(target);
    }
    draw();
  };
  const up = (event: MouseEvent) => {
    if (!locked || !event.isTrusted) return;
    stop(event); lastEvent = event;
    const active = press;
    if (!active || event.button !== active.button) return;
    buttons = 0; press = undefined;
    active.target.closest('button')?.classList.remove('app-mouse-pressed');
    pointer(active.target, 'pointerup', event);
    if (active.compatibility) mouse(active.target, 'mouseup', event);
    const target = hit();
    const action = (element: Element) => element.closest('button, a, summary, input, [role="button"]') ?? element;
    if (active.compatibility && action(target) === action(active.target) && active.target.isConnected)
      mouse(target, active.button === 0 ? 'click' : 'auxclick', event);
    draw();
  };
  const suppress = (event: Event) => {
    if (locked && event.isTrusted && (!(event instanceof PointerEvent) || event.pointerType === 'mouse')) stop(event);
  };
  const wheel = (event: WheelEvent) => {
    if (!locked || !event.isTrusted) return;
    stop(event);
    const target = hit();
    if (!target.dispatchEvent(new WheelEvent('wheel', { ...init(event), deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: event.deltaZ, deltaMode: event.deltaMode }))) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    for (let element: Element | null = target; element; element = element.parentElement) {
      const css = getComputedStyle(element);
      if (/(auto|scroll)/.test(css.overflowY) && element.scrollHeight > element.clientHeight) {
        const old = element.scrollTop;
        element.scrollTop += event.deltaY * unit;
        if (element.scrollTop !== old) break;
      }
    }
  };
  const release = () => { if (locked) { cancel(); suspendAppMouse(); } };
  const visibility = () => { if (document.hidden) release(); };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { stopAppMouse(); release(); return; }
    if (event.code !== 'Space' || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || press) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input:not([type="range"]), textarea, select, summary, [contenteditable]:not([contenteditable="false"])')) return;
    if (document.querySelector('dialog[open]') && target instanceof Element && target.closest('button, a, summary, [role="button"], [role="switch"]')) return;
    event.preventDefault();
    if (locked) { stopAppMouse(); release(); } else startAppMouse();
  };
  const resize = () => { cancel(); x = Math.min(x, innerWidth - 1); y = Math.min(y, innerHeight - 1); };
  // Newly opened modal dialogs are in the top layer. Keep the cursor above them.
  const layers = new MutationObserver((records) => {
    if (locked && records.some(record => record.target instanceof HTMLDialogElement)) showCursor();
  });
  layers.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  const subscriptions: (() => void)[] = [];
  const on = (target: EventTarget, type: string, listener: EventListener) => {
    target.addEventListener(type, listener, { capture: true, passive: false });
    subscriptions.push(() => target.removeEventListener(type, listener, true));
  };
  on(window, 'mousemove', move as EventListener);
  on(window, 'mousedown', down as EventListener);
  on(window, 'mouseup', up as EventListener);
  on(window, 'wheel', wheel as EventListener);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'click', 'auxclick', 'contextmenu', 'mouseover', 'mouseout']) on(window, type, suppress);
  // Request capture only after a complete click. Doing this on pointerdown can
  // split the first drawing gesture between native and virtual coordinates.
  const resumeSavedMouse = (event: Event) => {
    if (!resumeOnClick || locked || !event.isTrusted || !(event instanceof MouseEvent)) return;
    if (event.button !== 0 && event.button !== 2) return;
    if (event instanceof PointerEvent && event.pointerType !== 'mouse') return;
    resumeOnClick = false;
    x = event.clientX; y = event.clientY;
    startAppMouse();
  };
  on(window, 'click', resumeSavedMouse);
  on(window, 'auxclick', resumeSavedMouse);
  on(document, 'pointerlockchange', lockChange);
  on(document, 'pointerlockerror', lockError);
  // Capture also sees blur from focused buttons and dialog focus restoration.
  // Only leaving the browser window should release mouse control.
  on(window, 'blur', (event) => { if (event.target === window) release(); });
  on(window, 'resize', resize);
  on(window, 'keydown', key as EventListener);
  on(document, 'visibilitychange', visibility);
  on(document, 'fullscreenchange', () => { if (locked) showCursor(); });
  cursor.hidden = true;
  return () => {
    release(); locked = false; cancelAnimationFrame(frame);
    setHover(null); delete root.dataset.appMouse;
    layers.disconnect(); for (const unsubscribe of subscriptions) unsubscribe();
    cursor.remove();
  };
}

export function useAppMouse(mouseSpeed: number) {
  useEffect(() => { speed = mouseSpeed / 100; }, [mouseSpeed]);
  useEffect(installAppMouse, []);
}
