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

export function usePaperView(paper: { width: number; height: number }, requestedZoom: number | null, enabled: boolean) {
  const [fitZoom, setFitZoom] = useState(1);
  const zoom = (requestedZoom ?? 1) * fitZoom;
  const viewport = useRef<HTMLElement>(null);
  const current = useRef<View | null>(null);
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
      const activeZoom = (requestedZoom ?? 1) * fitted;
      const old = current.current;
      const next = constrain({ width: w, height: h, zoom: activeZoom,
        x: old && requestedZoom !== null ? w / 2 - (old.width / 2 - old.x) / old.zoom * activeZoom : (w - width * activeZoom) / 2,
        y: old && requestedZoom !== null ? h / 2 - (old.height / 2 - old.y) / old.zoom * activeZoom : (h - height * activeZoom) / 2,
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
    const nextZoom = Math.max(fitted, Math.min(fitted * 4, (w - 40) / Math.max(1, bounds.width), (h - inset - 40) / Math.max(1, bounds.height)));
    const next = constrain({ width: w, height: h, zoom: nextZoom,
      x: w / 2 - (bounds.x + bounds.width / 2) * nextZoom,
      y: inset + (h - inset) / 2 - (bounds.y + bounds.height / 2) * nextZoom,
    }, paper);
    current.current = next; drag.current = null; setPosition({ x: next.x, y: next.y });
    return nextZoom / fitted;
  };
  return { viewport, position, focus, zoom, fitZoom, handlers: {
    onPointerDownCapture(event: ReactPointerEvent<HTMLElement>) {
      if (!enabled || (event.button !== 0 && event.button !== 2) || drag.current || !current.current) return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
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

