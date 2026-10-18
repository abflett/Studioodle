import { appMousePointerId } from './appMouse';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '../editor/document';

type Gesture = { id: number; client: Point; element: HTMLElement; timer?: number; restore?: () => void };
type Options = {
  enabled: boolean;
  magnify: (client: Point) => () => void;
  fill: (client: Point) => void;
};

/** Own the bucket gesture above Phaser so coordinates follow the zoomed view. */
export function usePrecisionFill(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const active = useRef<Gesture | undefined>(undefined);
  const [aim, setAim] = useState<Point>();
  const finish = (apply: boolean, client?: Point) => {
    const gesture = active.current;
    if (!gesture) return;
    active.current = undefined;
    window.clearTimeout(gesture.timer);
    setAim(undefined);
    const point = client ?? gesture.client;
    const box = gesture.element.getBoundingClientRect();
    if (gesture.element.hasPointerCapture(gesture.id)) gesture.element.releasePointerCapture(gesture.id);
    try {
      if (apply && point.x >= box.left && point.x < box.right && point.y >= box.top && point.y < box.bottom)
        latest.current.fill(point);
    } finally { gesture.restore?.(); }
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
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
      active.current = undefined;
    };
  }, []);
  useEffect(() => { if (!options.enabled) finishRef.current(false); }, [options.enabled]);
  const showAim = (gesture: Gesture) => {
    const box = gesture.element.getBoundingClientRect();
    setAim({ x: gesture.client.x - box.left, y: gesture.client.y - box.top });
  };
  const stop = (event: ReactPointerEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); };
  return { aim, handlers: {
    onPointerDownCapture(event: ReactPointerEvent<HTMLElement>) {
      stop(event);
      if ((event.button !== 0 && event.button !== 2) || active.current) return;
      const gesture: Gesture = { id: event.pointerId, client: { x: event.clientX, y: event.clientY }, element: event.currentTarget };
      active.current = gesture;
      if (event.pointerId !== appMousePointerId) event.currentTarget.setPointerCapture(event.pointerId);
      gesture.timer = window.setTimeout(() => {
        if (active.current !== gesture) return;
        gesture.restore = latest.current.magnify(gesture.client);
        showAim(gesture);
      }, 500);
    },
    onPointerMoveCapture(event: ReactPointerEvent<HTMLElement>) {
      stop(event);
      const gesture = active.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      if (!event.buttons) { finish(false); return; }
      gesture.client = { x: event.clientX, y: event.clientY };
      if (gesture.restore) showAim(gesture);
    },
    onPointerUpCapture(event: ReactPointerEvent<HTMLElement>) {
      stop(event);
      if (active.current?.id === event.pointerId) finish(true, { x: event.clientX, y: event.clientY });
    },
    onPointerCancel(event: ReactPointerEvent<HTMLElement>) { stop(event); if (active.current?.id === event.pointerId) finish(false); },
    onLostPointerCapture(event: ReactPointerEvent<HTMLElement>) { if (active.current?.id === event.pointerId) finish(false); },
  } };
}
