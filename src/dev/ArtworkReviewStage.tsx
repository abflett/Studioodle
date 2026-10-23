import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { artworkPoint, markerLabels } from './artworkReviewModel';
import type { AssetReview, LineDraft, ReviewClosure, ReviewPoint, ReviewTool, ReviewAsset, ReviewMarker } from './artworkReviewModel';
import { loadReviewArtwork } from './artworkReviewAsset';
import type { ReviewArtwork } from './artworkReviewAsset';
import { zoomReviewAt } from './artworkReviewGeometry';
import { ReviewClosureOverlay } from './ReviewClosureOverlay';
import { reviewInkProbe } from './reviewLineWidth';

interface Props {
  asset: ReviewAsset; review?: AssetReview; selected?: string; mode: ReviewTool;
  draft?: LineDraft; fillTarget?: string;
  onMark: (artwork: ReviewArtwork, marker: ReviewMarker) => void;
  onSelect: (id: string) => void; onDelete: (id: string) => void;
  onDraft: (draft: LineDraft) => void; onLine: (artwork: ReviewArtwork, line: ReviewClosure) => void;
  onChangeLine: (line: ReviewClosure) => void; onFill: (id: string, point: ReviewPoint) => void;
  onArtwork: (artwork: ReviewArtwork) => void;
}

export function ArtworkReviewStage({ asset, review, selected, mode, draft, fillTarget, onMark, onSelect, onDelete, onDraft, onLine, onChangeLine, onFill, onArtwork }: Props) {
  const [loaded, setLoaded] = useState<{ artwork: ReviewArtwork; url: string }>();
  const [error, setError] = useState('');
  const [view, setView] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const { zoom, pan } = view;
  const [cursor, setCursor] = useState<ReviewPoint>();
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [hovered, setHovered] = useState<number>();
  const [showMarkers, setShowMarkers] = useState(true);
  const [showOutline, setShowOutline] = useState(false);
  const [showLines, setShowLines] = useState(true);
  const [background, setBackground] = useState('#2d190f');
  const stage = useRef<HTMLDivElement>(null), sheet = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const inkProbe = useRef<ReturnType<typeof reviewInkProbe>>(null);
  const drag = useRef<{ x: number; y: number; pan: typeof pan; moved: boolean }>(null);
  const artworkCallback = useRef(onArtwork);
  useEffect(() => { artworkCallback.current = onArtwork; }, [onArtwork]);
  useEffect(() => {
    const controller = new AbortController(); let url: string | undefined;
    void loadReviewArtwork(asset, controller.signal).then(artwork => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(new Blob([artwork.previewText], { type: 'image/svg+xml' }));
      setLoaded({ artwork, url }); artworkCallback.current(artwork);
    }).catch(error => { if (!controller.signal.aborted) setError(String(error.message)); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [asset]);
  useEffect(() => {
    const element = stage.current!;
    const observer = new ResizeObserver(([entry]) => { if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = stage.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!sheet.current || !event.deltaY) return;
      const rect = element.getBoundingClientRect();
      const cursor = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const factor = Math.exp(-Math.max(-500, Math.min(500, delta)) * .0015);
      setView(view => zoomReviewAt(view, cursor, view.zoom * factor));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  const artwork = loaded?.artwork;
  const fit = artwork ? Math.max(.01, Math.min((size.width - 32) / artwork.width, (size.height - 32) / artwork.height)) : 1;
  const scale = fit * zoom;
  const stale = !!(artwork && review && review.sha256 !== artwork.sha256);
  const region = artwork?.regions.find(region => region.id === hovered);
  const hitContext = useRef<CanvasRenderingContext2D | null>(null);
  function point(event: PointerEvent) { return artworkPoint(sheet.current!.getBoundingClientRect(), event.clientX, event.clientY, artwork!.width, artwork!.height); }
  function regionAt(x: number, y: number) {
    hitContext.current ??= document.createElement('canvas').getContext('2d');
    return artwork!.regions.find(region => hitContext.current!.isPointInPath(region.path, x, y))?.id ?? 0;
  }
  function lineWidth(p: ReviewPoint) {
    if (image.current?.complete && artwork) inkProbe.current ??= reviewInkProbe(image.current, artwork.width, artwork.height);
    return inkProbe.current?.(p) ?? 1;
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current; drag.current = null;
    if (!gesture || !artwork || gesture.moved || event.button !== 0 || event.altKey || stale) return;
    const rect = sheet.current!.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    const { x, y } = point(event);
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (fillTarget) { onFill(fillTarget, { x, y }); return; }
      if (mode === 'close-line') {
        if (!draft) onDraft({ a: { x, y }, width: lineWidth({ x, y }) });
        else if (Math.hypot(x - draft.a.x, y - draft.a.y) > .01) onLine(artwork, { id: crypto.randomUUID(), a: draft.a, b: { x, y }, control: null, width: +((draft.width + lineWidth({ x, y })) / 2).toFixed(2), fillSeed: null, note: '', createdAt: new Date().toISOString() });
        return;
      }
    }
    const kind = event.ctrlKey || event.metaKey ? 'remove-region' : event.shiftKey ? 'add-region' : mode === 'close-line' ? 'note' : mode;
    onMark(artwork, { id: crypto.randomUUID(), kind, x: +x.toFixed(4), y: +y.toFixed(4), regionId: regionAt(x, y), note: '', createdAt: new Date().toISOString() });
  }
  return <section className="review-workspace">
    <div className="review-view-tools">
      <button onClick={() => setView(view => zoomReviewAt(view, { x: 0, y: 0 }, view.zoom / 1.3))} aria-label="Zoom out">−</button>
      <button onClick={() => setView({ zoom: 1, pan: { x: 0, y: 0 } })}>Fit · {Math.round(zoom * 100)}%</button>
      <button onClick={() => setView(view => zoomReviewAt(view, { x: 0, y: 0 }, view.zoom * 1.3))} aria-label="Zoom in">+</button>
      <label>Background <input aria-label="Inspection background" type="color" value={background} onChange={event => setBackground(event.target.value)} /></label>
      <label><input type="checkbox" checked={showMarkers} onChange={event => setShowMarkers(event.target.checked)} /> Markers</label>
      <label><input type="checkbox" checked={showOutline} onChange={event => setShowOutline(event.target.checked)} /> Region outline</label>
      <label><input type="checkbox" checked={showLines} onChange={event => setShowLines(event.target.checked)} /> Proposed lines</label>
      <span>{hovered ? `Region ${hovered}` : 'Transparent / ink'}</span>
    </div>
    {stale && <div role="alert">This asset changed since it was annotated. Existing markers refer to the exported revision; adding markers is paused.</div>}
    <div ref={stage} tabIndex={-1} className="review-stage" style={{ background }} aria-label={`${asset.title} artwork`} onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (!artwork || (event.button !== 0 && event.button !== 1)) return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, pan, moved: false };
      }}
      onPointerMove={event => {
        if (!artwork) return;
        const gesture = drag.current;
        if (gesture) {
          const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
          if (Math.hypot(dx, dy) > 4) gesture.moved = true;
          if (gesture.moved && (zoom > 1 || event.altKey || event.buttons === 4)) setView(view => ({ ...view, pan: { x: gesture.pan.x + dx, y: gesture.pan.y + dy } }));
        } else if (sheet.current) { const p = point(event); setCursor(p); setHovered(regionAt(p.x, p.y)); }
      }} onPointerLeave={() => setHovered(undefined)} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }}>
      {!loaded && <p className="review-stage-message" role="status">{error || 'Loading vector artwork…'}</p>}
      {loaded && <div ref={sheet} className="review-sheet" style={{ width: loaded.artwork.width * scale, height: loaded.artwork.height * scale, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))` }}>
        <img ref={image} src={loaded.url} alt={asset.title} draggable={false} />
        <svg viewBox={loaded.artwork.viewBox.join(' ')} className="review-marker-layer" aria-label="Artwork annotations">
          {showOutline && region && <path className="review-region-outline" d={region.d} transform={region.transform || undefined} fill="none" stroke="#74befe" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
          {showLines && <ReviewClosureOverlay lines={review?.closures ?? []} selected={selected} scale={scale} width={loaded.artwork.width} height={loaded.artwork.height} handles={showMarkers} editable={!stale} point={point} focusArtwork={() => stage.current?.focus({ preventScroll: true })} onSelect={onSelect} onDelete={onDelete} onChange={onChangeLine} />}
          {draft && mode === 'close-line' && <g pointerEvents="none"><path d={`M${draft.a.x} ${draft.a.y}L${cursor?.x ?? draft.a.x} ${cursor?.y ?? draft.a.y}`} fill="none" stroke="#70d5ff" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="4 3" /><circle cx={draft.a.x} cy={draft.a.y} r={6 / scale} fill="#70d5ff" /></g>}
          {showMarkers && review?.markers.map((marker, index) => <g key={marker.id} role="button" tabIndex={0} aria-label={`${markerLabels[marker.kind]} marker ${index + 1}`} className={`review-marker ${marker.kind} ${selected === marker.id ? 'selected' : ''}`}
            transform={`translate(${marker.x} ${marker.y}) scale(${1 / scale})`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (event.altKey) onDelete(marker.id); else onSelect(marker.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect(marker.id); } }}>
            <circle r="12" /><text textAnchor="middle" dominantBaseline="central">{index + 1}</text>
          </g>)}
        </svg>
      </div>}
    </div>
    <div className="review-hint">{fillTarget ? 'Click inside the intended new fill region. Escape skips this step.' : draft ? 'Click endpoint B. Escape cancels the draft.' : 'Wheel: zoom at cursor · A / D: browse · 4: Close line · Ctrl/Cmd + click: transparent · Shift + click: add fill · Alt + click: delete annotation · Drag to pan when zoomed'}</div>
  </section>;
}
