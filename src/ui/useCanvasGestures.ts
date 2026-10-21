import { useLatest } from './useLatest';
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { appMousePointerId } from './appMouse';

type Point = { x: number; y: number };
type View = Point & { width: number; height: number; zoom: number };
type Options = {
  viewport: RefObject<HTMLElement | null>;
  captureView: () => View | null;
  transformView: (view: View, anchor: Point, center: Point, scale: number, baseline: number) => number;
  baseline: number;
  setZoom: (zoom: number) => void;
  cancelInput: () => void;
};

/** Own touch input before editor input: one finger draws, two manipulate the view. */
export function useCanvasGestures(options: Options) {
  const latest = useLatest(options);
  useEffect(() => {
    const element = options.viewport.current;
    if (!element) return;
    let single: { id: number; target: Element; point: Point } | undefined;
    let multi = false;
    let pinch: { view: View; center: Point; distance: number; ids: [number, number] } | undefined;
    const point = (touch: Touch): Point => ({ x: touch.clientX, y: touch.clientY });
    const emit = (target: Element, type: string, at: Point, down: boolean) => {
      const init = { bubbles: true, cancelable: true, composed: true, clientX: at.x, clientY: at.y, button: 0, buttons: down ? 1 : 0 };
      target.dispatchEvent(new PointerEvent(type, { ...init, pointerId: appMousePointerId, pointerType: 'touch', isPrimary: true, pressure: down ? .5 : 0 }));
    };
    const cancelSingle = () => {
      const active = single;
      single = undefined;
      if (!active) return;
      emit(active.target, 'pointercancel', active.point, false);
      // Roll back partial drawing even when a parent gesture consumed cancellation.
      latest.current.cancelInput();
    };
    const sample = (touches: Touch[]) => {
      const a = touches[0], b = touches[1];
      if (!a || !b) return undefined;
      return { center: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }, distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)), ids: [a.identifier, b.identifier] as [number, number] };
    };
    const handle = (event: TouchEvent) => {
      event.preventDefault(); event.stopImmediatePropagation();
      const touches = Array.from(event.touches).filter(touch => touch.target instanceof Node && element.contains(touch.target));
      if (event.type === 'touchcancel') { cancelSingle(); pinch = undefined; multi = touches.length > 0; return; }
      if (touches.length >= 2) {
        multi = true; cancelSingle();
        const next = sample(touches)!;
        if (!pinch || pinch.ids[0] !== next.ids[0] || pinch.ids[1] !== next.ids[1]) {
          const view = latest.current.captureView();
          if (view) pinch = { ...next, view };
        } else {
          latest.current.setZoom(latest.current.transformView(pinch.view, pinch.center, next.center, next.distance / pinch.distance, latest.current.baseline));
        }
        return;
      }
      if (multi) {
        // Do not resume painting with the finger left behind after a pinch.
        pinch = undefined;
        if (!touches.length) multi = false;
        return;
      }
      if (event.type === 'touchstart' && !single) {
        const touch = touches[0];
        if (!touch || !(touch.target instanceof Element)) return;
        const at = point(touch), target = touch.target;
        single = { id: touch.identifier, target, point: at };
        emit(target, 'pointerdown', at, true);
      } else if (single && event.type === 'touchmove') {
        const touch = touches.find(item => item.identifier === single?.id);
        if (!touch) { cancelSingle(); return; }
        single.point = point(touch);
        emit(single.target, 'pointermove', single.point, true);
      } else if (single && event.type === 'touchend') {
        const active = single;
        const touch = Array.from(event.changedTouches).find(item => item.identifier === active.id);
        if (!touch) return;
        single = undefined;
        const at = point(touch);
        emit(active.target, 'pointerup', at, false);
      }
    };
    const suppressPointer = (event: PointerEvent) => {
      if (event.isTrusted && event.pointerType === 'touch') { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (single || multi) return;
      const view = latest.current.captureView();
      if (!view) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.height : 1;
      const center = { x: event.clientX, y: event.clientY };
      const scale = event.ctrlKey || event.metaKey ? Math.exp(-event.deltaY * unit * .01) : 1;
      const moved = scale === 1 ? { x: center.x - event.deltaX * unit, y: center.y - event.deltaY * unit } : center;
      latest.current.setZoom(latest.current.transformView(view, center, moved, scale, latest.current.baseline));
    };
    const cancel = () => { cancelSingle(); pinch = undefined; multi = false; };
    const touchTypes = ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const;
    const pointerTypes = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;
    for (const type of touchTypes) element.addEventListener(type, handle, { capture: true, passive: false });
    for (const type of pointerTypes) element.addEventListener(type, suppressPointer, { capture: true, passive: false });
    element.addEventListener('wheel', wheel, { capture: true, passive: false });
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    return () => {
      cancel();
      for (const type of touchTypes) element.removeEventListener(type, handle, true);
      for (const type of pointerTypes) element.removeEventListener(type, suppressPointer, true);
      element.removeEventListener('wheel', wheel, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
    };
  }, [options.viewport, latest]);
}
