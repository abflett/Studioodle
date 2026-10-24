import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { markerLabels } from './artworkReviewModel';
import type { ReviewMarker, ReviewPoint } from './artworkReviewModel';

interface Props {
  marker: ReviewMarker; index: number; selected: boolean; scale: number; editable: boolean;
  point: (event: PointerEvent) => ReviewPoint; regionAt: (x: number, y: number) => number;
  focusArtwork: () => void; onSelect: (id?: string) => void; onDelete: (id: string) => void;
  onChange: (marker: ReviewMarker) => void;
}

export function ReviewMarkerHandle({ marker, index, selected, scale, editable, point, regionAt, focusArtwork, onSelect, onDelete, onChange }: Props) {
  const [preview, setPreview] = useState<ReviewPoint>();
  const drag = useRef<{ x: number; y: number; moved: boolean }>(null);
  const shown = preview ?? marker;
  function cancel() { drag.current = null; setPreview(undefined); }
  return <g role="button" tabIndex={0} aria-label={`${markerLabels[marker.kind]} marker ${index + 1}`} className={`review-marker ${marker.kind} ${selected ? 'selected' : ''}`}
    transform={`translate(${shown.x} ${shown.y}) scale(${1 / scale})`}
    onPointerDown={event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.stopPropagation(); event.preventDefault(); focusArtwork();
      if (event.altKey) { onDelete(marker.id); return; }
      onSelect(marker.id);
      if (editable) { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, moved: false }; }
    }}
    onPointerMove={event => {
      const gesture = drag.current; if (!gesture) return;
      event.stopPropagation();
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 3) gesture.moved = true;
      if (gesture.moved) setPreview(point(event));
    }}
    onPointerUp={event => {
      if (event.button !== 0 || !drag.current) return;
      event.stopPropagation();
      if (drag.current.moved) { const p = point(event); onChange({ ...marker, ...p, regionId: regionAt(p.x, p.y) }); }
      cancel();
    }} onPointerCancel={cancel} onLostPointerCapture={cancel}
    onClick={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect(marker.id); } }}>
    <circle r="12" /><text textAnchor="middle" dominantBaseline="central">{index + 1}</text>
  </g>;
}
