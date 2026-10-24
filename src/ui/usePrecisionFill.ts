import { useLatest } from './useLatest';
import { appMousePointerId } from './appMouse';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '../editor/document';

type Gesture = { startedAt: number; sequence: number; id: number; client: Point; element: HTMLElement; timer?: number; restore?: () => void; offset?: Point };
type Options = {
  enabled: boolean;
  magnify: (client: Point) => { restore: () => void; offset: Point };
  fill: (client: Point) => void;
};

/** Own the bucket gesture above drawing input so coordinates follow the zoomed view. */
export function usePrecisionFill(options: Options) {
  const latest = useLatest(options);
  const active = useRef<Gesture | undefined>(undefined);
  const sequence = useRef(0);
  const [aim, setAim] = useState<Point & { sequence: number }>();
  const [magnified, setMagnified] = useState(false);
  const [releasedAim, setReleasedAim] = useState<Point & { elapsed: number }>();
  const releaseTimer = useRef<number | undefined>(undefined);
  const finish = (apply: boolean, client?: Point) => {
    const gesture = active.current;
    if (!gesture) return;
    active.current = undefined;
    window.clearTimeout(gesture.timer);
    setAim(undefined);
    setMagnified(false);
    // Quick fills stay anchored to the original press, even if release drifts.
    const physical = gesture.restore ? client ?? gesture.client : gesture.client;
    const point = { x: physical.x + (gesture.offset?.x ?? 0), y: physical.y + (gesture.offset?.y ?? 0) };
    const box = gesture.element.getBoundingClientRect();
    if (gesture.element.hasPointerCapture(gesture.id)) gesture.element.releasePointerCapture(gesture.id);
    try {
      if (apply && physical.x >= box.left && physical.x < box.right && physical.y >= box.top && physical.y < box.bottom && point.x >= box.left && point.x < box.right && point.y >= box.top && point.y < box.bottom) {
        latest.current.fill(point);
        setReleasedAim({ x: point.x - box.left, y: point.y - box.top,
          elapsed: gesture.restore ? 500 : Math.min(499, performance.now() - gesture.startedAt) });
        window.clearTimeout(releaseTimer.current);
        releaseTimer.current = window.setTimeout(() => setReleasedAim(undefined), 260);
      }
    } finally { gesture.restore?.(); }
  };
  const finishRef = useLatest(finish);
  useEffect(() => {
    const cancel = () => finishRef.current(false);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      window.removeEventListener('keydown', escape);
      window.clearTimeout(active.current?.timer);
      window.clearTimeout(releaseTimer.current);
      active.current = undefined;
    };
  }, [finishRef]);
  useEffect(() => { if (!options.enabled) finishRef.current(false); }, [options.enabled, finishRef]);
  const showAim = (gesture: Gesture) => {
    const box = gesture.element.getBoundingClientRect();
    setAim({ x: gesture.client.x + (gesture.offset?.x ?? 0) - box.left, y: gesture.client.y + (gesture.offset?.y ?? 0) - box.top, sequence: gesture.sequence });
  };
  const stop = (event: ReactPointerEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); };
  return { aim, magnified, releasedAim, handlers: {
    onPointerDownCapture(event: ReactPointerEvent<HTMLElement>) {
      stop(event);
      if ((event.button !== 0 && event.button !== 2) || active.current) return;
      const gesture: Gesture = { startedAt: performance.now(), sequence: ++sequence.current, id: event.pointerId, client: { x: event.clientX, y: event.clientY }, element: event.currentTarget };
      active.current = gesture;
      window.clearTimeout(releaseTimer.current);
      setReleasedAim(undefined);
      setMagnified(false);
      showAim(gesture);
      if (event.pointerId !== appMousePointerId) event.currentTarget.setPointerCapture(event.pointerId);
      gesture.timer = window.setTimeout(() => {
        if (active.current !== gesture) return;
        const magnification = latest.current.magnify(gesture.client);
        gesture.restore = magnification.restore;
        gesture.offset = magnification.offset;
        setMagnified(true);
        showAim(gesture);
      }, 500);
    },
    onPointerMoveCapture(event: ReactPointerEvent<HTMLElement>) {
      stop(event);
      const gesture = active.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      if (!event.buttons) { finish(false); return; }
      // Movement becomes precision aiming only after the hold has zoomed in.
      if (gesture.restore) {
        gesture.client = { x: event.clientX, y: event.clientY };
        showAim(gesture);
      }
    },
    onPointerUpCapture(event: ReactPointerEvent<HTMLElement>) {
      stop(event);
      if (active.current?.id === event.pointerId) finish(true, { x: event.clientX, y: event.clientY });
    },
    onPointerCancel(event: ReactPointerEvent<HTMLElement>) { stop(event); if (active.current?.id === event.pointerId) finish(false); },
    onLostPointerCapture(event: ReactPointerEvent<HTMLElement>) { if (active.current?.id === event.pointerId) finish(false); },
  } };
}
