import { useState } from 'react';
import type { PointerEvent } from 'react';
import { closureMidpoint, closurePath, moveClosureHandle } from './artworkReviewGeometry';
import type { ClosureHandle } from './artworkReviewGeometry';
import type { ReviewClosure, ReviewPoint } from './artworkReviewModel';

interface Props {
  lines: ReviewClosure[]; selected?: string; scale: number; width: number; height: number;
  handles: boolean; editable: boolean; point: (event: PointerEvent) => ReviewPoint;
  focusArtwork: () => void; onSelect: (id: string) => void; onDelete: (id: string) => void;
  onChange: (line: ReviewClosure) => void;
}

/** Drag previews stay local; commit once on pointer-up instead of saving every move. */
export function ReviewClosureOverlay({ lines, ...props }: Props) {
  return <>{lines.map(saved => <ClosureLine key={saved.id} saved={saved} {...props} />)}</>;
}
function ClosureLine({ saved, selected, scale, width, height, handles, editable, point, focusArtwork, onSelect, onDelete, onChange }: Omit<Props, 'lines'> & { saved: ReviewClosure }) {
  const [preview, setPreview] = useState<ReviewClosure>();
  const [drag, setDrag] = useState<{ original: ReviewClosure; handle: ClosureHandle }>();
  function start(event: PointerEvent<SVGGElement>, original: ReviewClosure, handle: ClosureHandle) {
    event.stopPropagation(); event.preventDefault(); focusArtwork(); if (!editable) return;
    event.currentTarget.setPointerCapture(event.pointerId); setDrag({ original, handle });
  }
  function move(event: PointerEvent) {
    event.stopPropagation(); const gesture = drag; if (!gesture) return;
    setPreview(moveClosureHandle(gesture.original, gesture.handle, point(event), width, height));
  }
  function cancel() { setDrag(undefined); setPreview(undefined); }
  function finish(event: PointerEvent) {
    event.stopPropagation();
    const gesture = drag; setDrag(undefined); setPreview(undefined);
    if (gesture) onChange(moveClosureHandle(gesture.original, gesture.handle, point(event), width, height));
  }
  const line = preview?.id === saved.id ? preview : saved, active = selected === line.id;
  const controls: [ClosureHandle, ReviewPoint, string][] = [['a', line.a, 'A'], ['b', line.b, 'B'], ['midpoint', closureMidpoint(line), 'Curve']];
  if (line.fillSeed) controls.push(['fillSeed', line.fillSeed, 'Fill']);
  return <g key={line.id} className="review-proposed-line">
    {active && handles && <path d={closurePath(line)} fill="none" stroke="#70d5ff" strokeWidth={line.width + 3 / scale} strokeLinecap="round" pointerEvents="none" />}
    <path d={closurePath(line)} fill="none" stroke="black" strokeWidth={line.width} strokeLinecap="round" pointerEvents="none" />
    {handles && <path d={closurePath(line)} fill="none" stroke="transparent" strokeWidth={Math.max(line.width, 14 / scale)} pointerEvents="stroke" className="review-line-target"
      onPointerDown={event => { event.stopPropagation(); event.preventDefault(); focusArtwork(); }}
      onClick={event => { event.stopPropagation(); if (event.altKey) onDelete(line.id); else onSelect(line.id); }} />}
    {active && handles && controls.map(([handle, position, label]) => <g key={handle} className={`review-line-handle ${handle}`} role="button" tabIndex={editable ? 0 : -1} aria-label={`Line ${label} handle`} aria-disabled={!editable}
      transform={`translate(${position.x} ${position.y}) scale(${1 / scale})`}
      onPointerDown={event => start(event, saved, handle)} onPointerMove={move}
      onPointerUp={finish} onPointerCancel={event => { event.stopPropagation(); cancel(); }} onLostPointerCapture={cancel}
      onKeyDown={event => {
        if (!editable || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? .1 : 1;
        onChange(moveClosureHandle(saved, handle, { x: position.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: position.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) }, width, height));
      }}>
      <circle r="8" /><text x="12" y="-10">{label}</text>
    </g>)}
  </g>;
}
