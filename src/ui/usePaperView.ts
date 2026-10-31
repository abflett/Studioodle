import { appMousePointerId } from './appMouse';
import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type View = { x: number; y: number; width: number; height: number; zoom: number };
function constrain(view: View, paper: { width: number; height: number }): View {
  const visibleX = Math.min(64, view.width / 2, paper.width * view.zoom);
  const visibleY = Math.min(64, view.height / 2, paper.height * view.zoom);
  return { ...view,
    x: Math.max(visibleX - paper.width * view.zoom, Math.min(view.width - visibleX, view.x)),
    y: Math.max(visibleY - paper.height * view.zoom, Math.min(view.height - visibleY, view.y)),
  };
}

export function usePaperView(paper: { width: number; height: number }, requestedZoom: number | null, enabled: boolean, onResizeZoom?: (zoom: number) => void) {
  const resizeZoom = useRef(onResizeZoom);
  useLayoutEffect(() => { resizeZoom.current = onResizeZoom; });
  const [fitZoom, setFitZoom] = useState(1);
  const zoom = (requestedZoom ?? 1) * fitZoom;
  const viewport = useRef<HTMLElement>(null);
  const current = useRef<View | null>(null);
  const preserveNextView = useRef(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const width = paper.width, height = paper.height;
  // A newly measured blank page must start centered, not inherit the placeholder size's offset.
  useLayoutEffect(() => { current.current = null; }, [width, height]);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = () => {
      const w = element.clientWidth, h = element.clientHeight;
      if (!w || !h) return;
      const fitted = Math.min(w / width, h / height);
      setFitZoom(fitted);
      const old = current.current;
      // Layout changes refit Fit mode, but keep manual magnification and its
      // center artwork point stable as the available workspace expands/shrinks.
      const keepScale = old && requestedZoom !== null && resizeZoom.current && (old.width !== w || old.height !== h);
      const activeZoom = keepScale ? old.zoom : (requestedZoom ?? 1) * fitted;
      if (keepScale) resizeZoom.current!(activeZoom / fitted);
      const preserve = preserveNextView.current || (old !== null && old.width === w && old.height === h && Math.abs(old.zoom - activeZoom) < .00001);
      preserveNextView.current = false;
      // An explicitly positioned view (including temporary precision zoom) must
      // survive the requestedZoom render without being clamped or recentered.
      const next = preserve && old && old.width === w && old.height === h && Math.abs(old.zoom - activeZoom) < .00001 ? old : constrain({ width: w, height: h, zoom: activeZoom,
        x: old && (requestedZoom !== null || preserve) ? w / 2 - (old.width / 2 - old.x) / old.zoom * activeZoom : (w - width * activeZoom) / 2,
        y: old && (requestedZoom !== null || preserve) ? h / 2 - (old.height / 2 - old.y) / old.zoom * activeZoom : (h - height * activeZoom) / 2,
      }, { width, height });
      current.current = next;
      drag.current = null;
      setPosition({ x: next.x, y: next.y });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width, height, requestedZoom]);

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const focus = (bounds: { x: number; y: number; width: number; height: number }, topInset: number) => {
    const element = viewport.current;
    if (!element) return requestedZoom ?? 1;
    const w = element.clientWidth, h = element.clientHeight;
    const inset = Math.min(topInset, h / 2);
    const fitted = Math.min(w / paper.width, h / paper.height);
    const nextZoom = Math.max(fitted, Math.min((w - 40) / Math.max(1, bounds.width), (h - inset - 40) / Math.max(1, bounds.height)));
    const next = constrain({ width: w, height: h, zoom: nextZoom,
      x: w / 2 - (bounds.x + bounds.width / 2) * nextZoom,
      y: inset + (h - inset) / 2 - (bounds.y + bounds.height / 2) * nextZoom,
    }, paper);
    current.current = next; drag.current = null; setPosition({ x: next.x, y: next.y });
    return nextZoom / fitted;
  };
  const pointAt = (client: { x: number; y: number }) => {
    const element = viewport.current, view = current.current;
    if (!element || !view) return undefined;
    const box = element.getBoundingClientRect();
    return { x: (client.x - box.left - view.x) / view.zoom, y: (client.y - box.top - view.y) / view.zoom };
  };
  const zoomAt = (client: { x: number; y: number }, multiplier: number) => {
    const element = viewport.current, view = current.current, point = pointAt(client);
    if (!element || !view || !point) return requestedZoom ?? 1;
    const box = element.getBoundingClientRect();
    const fitted = Math.min(view.width / paper.width, view.height / paper.height);
    const nextZoom = Math.max(view.zoom, fitted * multiplier);
    // Precision magnification is anchored exactly, even beside the page edge.
    const next = { ...view, zoom: nextZoom,
      x: client.x - box.left - point.x * nextZoom,
      y: client.y - box.top - point.y * nextZoom,
    };
    current.current = next; drag.current = null; setPosition({ x: next.x, y: next.y });
    return nextZoom / fitted;
  };
  const captureView = () => current.current ? { ...current.current } : null;
  const restoreView = (view: View | null) => {
    const element = viewport.current;
    if (!view || !element) return;
    const w = element.clientWidth, h = element.clientHeight;
    const restoredZoom = view.zoom * Math.min(w / paper.width, h / paper.height) / Math.min(view.width / paper.width, view.height / paper.height);
    const next = constrain({ width: w, height: h, zoom: restoredZoom,
      x: w / 2 - (view.width / 2 - view.x) / view.zoom * restoredZoom,
      y: h / 2 - (view.height / 2 - view.y) / view.zoom * restoredZoom,
    }, paper);
    current.current = next; preserveNextView.current = true;
    drag.current = null; setPosition({ x: next.x, y: next.y });
  };
  const fitPage = () => {
    const element = viewport.current;
    if (!element) return;
    const w = element.clientWidth, h = element.clientHeight;
    const fitted = Math.min(w / paper.width, h / paper.height);
    const next = { width: w, height: h, zoom: fitted, x: (w - paper.width * fitted) / 2, y: (h - paper.height * fitted) / 2 };
    current.current = next; drag.current = null; setPosition({ x: next.x, y: next.y });
  };
  const transformView = (start: View, anchor: { x: number; y: number }, center: { x: number; y: number }, scale: number, baseline: number) => {
    const element = viewport.current;
    if (!element) return requestedZoom ?? baseline;
    const box = element.getBoundingClientRect();
    const fitted = Math.min(start.width / paper.width, start.height / paper.height);
    const nextZoom = Math.max(fitted * baseline, Math.min(fitted * baseline * 8, start.zoom * scale));
    const next = constrain({ ...start, zoom: nextZoom,
      x: center.x - box.left - (anchor.x - box.left - start.x) / start.zoom * nextZoom,
      y: center.y - box.top - (anchor.y - box.top - start.y) / start.zoom * nextZoom,
    }, paper);
    current.current = next; drag.current = null; setPosition({ x: next.x, y: next.y });
    return nextZoom / fitted;
  };
  return { viewport, position, focus, captureView, restoreView, pointAt, zoomAt, transformView, fitPage, zoom, fitZoom, handlers: {
    onPointerDownCapture(event: ReactPointerEvent<HTMLElement>) {
      if (!enabled || (event.button !== 0 && event.button !== 2) || drag.current || !current.current) return;
      event.preventDefault(); event.stopPropagation();
      if (event.pointerId !== appMousePointerId) event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: current.current.x, originY: current.current.y };
    },
    onPointerMoveCapture(event: ReactPointerEvent<HTMLElement>) {
      const start = drag.current, view = current.current;
      if (!enabled || !start || !view || start.id !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const next = constrain({ ...view, x: start.originX + event.clientX - start.x, y: start.originY + event.clientY - start.y }, { width, height });
      current.current = next;
      setPosition({ x: next.x, y: next.y });
    },
    onPointerUpCapture: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  } };
}
