import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { artworkPoint } from './artworkReviewModel';
import type { AssetReview, LineDraft, ReviewClosure, ReviewPoint, ReviewTool, ReviewAsset, ReviewMarker } from './artworkReviewModel';
import { loadReviewArtwork } from './artworkReviewAsset';
import type { ReviewArtwork } from './artworkReviewAsset';
import { zoomReviewAt } from './artworkReviewGeometry';
import { ReviewClosureOverlay } from './ReviewClosureOverlay';
import { ReviewMarkerHandle } from './ReviewMarkerHandle';
import { reviewInkProbe } from './reviewLineWidth';

interface Props {
  asset: ReviewAsset; review?: AssetReview; selected?: string; mode: ReviewTool;
  draft?: LineDraft; fillTarget?: string;
  onMark: (artwork: ReviewArtwork, marker: ReviewMarker) => void;
  onSelect: (id?: string) => void; onDelete: (id: string) => void;
  onDraft: (draft: LineDraft) => void; onLine: (artwork: ReviewArtwork, line: ReviewClosure) => void;
  onChangeLine: (line: ReviewClosure) => void; onFill: (id: string, point: ReviewPoint) => void;
  onArtwork: (artwork: ReviewArtwork) => void;
  onMoveMarker: (marker: ReviewMarker) => void;
}

export function ArtworkReviewStage({ asset, review, selected, mode, draft, fillTarget, onMark, onSelect, onDelete, onDraft, onLine, onChangeLine, onFill, onArtwork, onMoveMarker }: Props) {
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
  const drag = useRef<{ x: number; y: number; pan: typeof pan; moved: boolean; button: number }>(null);
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
      const line = review?.closures?.find(line => line.id === selected);
      if (event.ctrlKey && line) {
        if (loaded?.artwork.sha256 !== review?.sha256) return;
        const width = Math.max(1, Math.min(20, Math.round(line.width * 10) - Math.sign(event.deltaY))) / 10;
        if (width !== line.width) onChangeLine({ ...line, width });
        return;
      }
      const rect = element.getBoundingClientRect();
      const cursor = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const factor = Math.exp(-Math.max(-500, Math.min(500, delta)) * .0015);
      setView(view => zoomReviewAt(view, cursor, view.zoom * factor));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [review, selected, loaded, onChangeLine]);
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
  function placeLinePoint(p: ReviewPoint) {
    if (!artwork) return;
    if (!draft) onDraft({ a: p, width: lineWidth(p) });
    else if (Math.hypot(p.x - draft.a.x, p.y - draft.a.y) > .01) onLine(artwork, { id: crypto.randomUUID(), a: draft.a, b: p, control: null, width: Math.max(.1, Math.min(2, +((draft.width + lineWidth(p)) / 2).toFixed(2))), fillSeed: null, note: '', createdAt: new Date().toISOString() });
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current; drag.current = null;
    if (!gesture || !artwork || gesture.moved || (event.button !== 0 && event.button !== 2) || event.altKey) return;
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !fillTarget && mode === 'select') { onSelect(undefined); return; }
    if (stale) return;
    const rect = sheet.current!.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    const { x, y } = point(event);
    if (event.button === 2) { placeLinePoint({ x, y }); return; }
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (fillTarget) { onFill(fillTarget, { x, y }); return; }
      if (mode === 'close-line') {
        placeLinePoint({ x, y });
        return;
      }
    }
    const kind = event.ctrlKey || event.metaKey ? 'remove-region' : event.shiftKey ? 'add-region' : mode === 'close-line' || mode === 'select' ? 'note' : mode;
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
        if (!artwork || ![0, 1, 2].includes(event.button)) return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, pan, moved: false, button: event.button };
      }}
      onPointerMove={event => {
        if (!artwork) return;
        const gesture = drag.current;
        if (gesture) {
          const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
          if (Math.hypot(dx, dy) > 4) gesture.moved = true;
          if (gesture.moved && (gesture.button === 1 || event.altKey)) setView(view => ({ ...view, pan: { x: gesture.pan.x + dx, y: gesture.pan.y + dy } }));
        } else if (sheet.current) { const p = point(event); setCursor(p); setHovered(regionAt(p.x, p.y)); }
      }} onPointerLeave={() => setHovered(undefined)} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }}>
      {!loaded && <p className="review-stage-message" role="status">{error || 'Loading vector artwork…'}</p>}
      {loaded && <div ref={sheet} className="review-sheet" style={{ width: loaded.artwork.width * scale, height: loaded.artwork.height * scale, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))` }}>
        <img ref={image} src={loaded.url} alt={asset.title} draggable={false} />
        <svg viewBox={loaded.artwork.viewBox.join(' ')} className="review-marker-layer" aria-label="Artwork annotations">
          {showOutline && region && <path className="review-region-outline" d={region.d} transform={region.transform || undefined} fill="none" stroke="#74befe" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
          {showLines && <ReviewClosureOverlay lines={review?.closures ?? []} selected={selected} scale={scale} width={loaded.artwork.width} height={loaded.artwork.height} handles={showMarkers} editable={!stale} point={point} focusArtwork={() => stage.current?.focus({ preventScroll: true })} onSelect={onSelect} onDelete={onDelete} onChange={onChangeLine} />}
          {draft && <g pointerEvents="none"><path d={`M${draft.a.x} ${draft.a.y}L${cursor?.x ?? draft.a.x} ${cursor?.y ?? draft.a.y}`} fill="none" stroke="#70d5ff" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="4 3" /><circle cx={draft.a.x} cy={draft.a.y} r={6 / scale} fill="#70d5ff" /></g>}
          {showMarkers && review?.markers.map((marker, index) => <ReviewMarkerHandle key={marker.id} marker={marker} index={index} selected={selected === marker.id} scale={scale} editable={!stale} point={point} regionAt={regionAt} focusArtwork={() => stage.current?.focus({ preventScroll: true })} onSelect={onSelect} onDelete={onDelete} onChange={onMoveMarker} />)}
        </svg>
      </div>}
    </div>
    <div className="review-hint">{fillTarget ? 'Left-click inside the intended fill region, or right-click to start another line. Escape skips the fill point.' : draft ? 'Right-click endpoint B (or left-click with tool 4). Escape cancels the draft.' : 'Shift-click: add fill · Ctrl-click: transparent · Right-click A / B: line · Left-click / drag: select / move · Delete: remove · Middle-drag: pan · Ctrl-wheel: line width · Wheel: zoom · A / D: browse · Space: reviewed'}</div>
  </section>;
}
