import { useCallback, useEffect, useRef, useState } from 'react';
import manifest from '../../art/stickers.json';
import { ArtworkReviewStage } from './ArtworkReviewStage';
import { emptyReview, markerLabels, mergeReviews, parseReview, reviewStorageKey } from './artworkReviewModel';
import type { ArtworkReview, AssetReview, MarkerKind, ReviewAsset, ReviewMarker } from './artworkReviewModel';
import type { ReviewArtwork } from './artworkReviewAsset';
import './artworkReview.css';

const assets: ReviewAsset[] = manifest;
function readReview() {
  try { const text = localStorage.getItem(reviewStorageKey); return { review: text ? parseReview(text, assets) : emptyReview(), message: 'Notes save locally in this browser. Export JSON for a portable backup.' }; }
  catch { return { review: emptyReview(), message: 'Could not restore local notes. Export any new work; the existing stored data has not been changed.' }; }
}

export function ArtworkReviewApp() {
  const [initial] = useState(readReview);
  const [review, setReview] = useState<ArtworkReview>(initial.review);
  const [message, setMessage] = useState(initial.message);
  const [assetId, setAssetId] = useState(() => {
    const id = new URLSearchParams(location.search).get('asset');
    return assets.some(asset => asset.id === id) ? id! : assets[0]!.id;
  });
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
  const [mode, setMode] = useState<MarkerKind>('note');
  const [selected, setSelected] = useState<string>();
  const [artwork, setArtwork] = useState<{ id: string; data: ReviewArtwork }>();
  const importInput = useRef<HTMLInputElement>(null), markerNote = useRef<HTMLTextAreaElement>(null);
  const asset = assets.find(asset => asset.id === assetId)!;
  const current = review.assets.find(entry => entry.assetId === assetId);
  const selectedMarker = current?.markers.find(marker => marker.id === selected);
  const visible = assets.filter(asset => {
    const entry = review.assets.find(entry => entry.assetId === asset.id);
    return `${asset.title} ${asset.id} ${asset.category}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' || (filter === 'flagged' ? !!(entry?.markers.length || entry?.notes) : !entry?.reviewed));
  });
  const index = visible.findIndex(asset => asset.id === assetId);
  const persist = useCallback((next: ArtworkReview) => {
    setReview(next);
    try { localStorage.setItem(reviewStorageKey, JSON.stringify(next)); setMessage('Saved locally. Export JSON to share or back up this review.'); }
    catch { setMessage('Local saving failed. Keep this page open and export JSON now to preserve your notes.'); }
  }, []);
  const choose = useCallback((id: string) => {
    setAssetId(id); setSelected(undefined);
    const url = new URL(location.href); url.searchParams.set('asset', id); history.replaceState(null, '', url);
  }, []);
  const navigate = useCallback((direction: number) => {
    if (!visible.length) return;
    const next = index < 0 ? (direction > 0 ? 0 : visible.length - 1) : (index + direction + visible.length) % visible.length;
    choose(visible[next]!.id);
  }, [visible, index, choose]);
  const wheelTime = useRef(-Infinity);
  const wheelNavigate = useCallback((direction: number) => {
    if (performance.now() - wheelTime.current < 450) return;
    wheelTime.current = performance.now(); navigate(direction);
  }, [navigate]);
  function updateEntry(change: (entry: AssetReview) => AssetReview, loaded = artwork?.id === assetId ? artwork.data : undefined) {
    if (!loaded || (current && current.sha256 !== loaded.sha256)) return;
    const base = current ?? { assetId, source: asset.source, vectorPath: `src/assets/vector/${assetId}.svg`, viewBox: loaded.viewBox, sha256: loaded.sha256, notes: '', reviewed: false, markers: [] };
    const next = change(base);
    persist({ ...review, assets: [...review.assets.filter(entry => entry.assetId !== assetId), next] });
  }
  function addMarker(data: ReviewArtwork, marker: ReviewMarker) {
    updateEntry(entry => ({ ...entry, markers: [...entry.markers, marker] }), data);
    setSelected(marker.id); requestAnimationFrame(() => markerNote.current?.focus());
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
      if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); navigate(event.key === 'ArrowRight' || event.key === 'PageDown' ? 1 : -1); }
      if (event.key === 'Escape') setSelected(undefined);
      if (event.key === '1') setMode('note');
      if (event.key === '2') setMode('remove-region');
      if (event.key === '3') setMode('add-region');
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [navigate]);
  function exportReview() {
    const data = { ...review, exportedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `studioodle-artwork-review-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`Exported ${review.assets.length} artwork records and ${review.assets.reduce((sum, entry) => sum + entry.markers.length, 0)} markers.`);
  }
  const editable = artwork?.id === assetId && (!current || current.sha256 === artwork.data.sha256);
  return <main className="artwork-review">
    <header className="review-header">
      <strong>Artwork review <small>Developer tool</small></strong>
      <span>{review.assets.filter(entry => entry.reviewed).length} / {assets.length} reviewed · {review.assets.reduce((sum, entry) => sum + entry.markers.length, 0)} markers</span>
      <button onClick={() => importInput.current?.click()}>Import JSON</button><button className="review-primary" onClick={exportReview}>Export JSON</button>
      <a href="/">Back to app</a>
      <input ref={importInput} hidden type="file" accept="application/json,.json" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        try { if (file.size > 5 * 1024 * 1024) throw Error('Review JSON must be smaller than 5 MiB.'); const imported = parseReview(await file.text(), assets); persist(mergeReviews(review, imported)); }
        catch (error) { setMessage(`Import failed: ${error instanceof Error ? error.message : String(error)}`); }
      }} />
    </header>
    <aside className="review-sidebar">
      <label>Find artwork<input type="search" value={query} placeholder="Name, ID or category" onChange={event => setQuery(event.target.value)} /></label>
      <label>Browse<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All artwork</option><option value="unreviewed">Not reviewed yet</option><option value="flagged">With notes or markers</option></select></label>
      <select aria-label="Artwork" value={index >= 0 ? assetId : ''} onChange={event => choose(event.target.value)}>
        {index < 0 && <option value="" disabled>{asset.title} (outside filter)</option>}
        {visible.map(asset => <option key={asset.id} value={asset.id}>{review.assets.find(entry => entry.assetId === asset.id)?.reviewed ? '✓ ' : ''}{asset.title} · {asset.id}</option>)}
      </select>
      <nav className="review-browse"><button onClick={() => navigate(-1)} disabled={!visible.length} aria-label="Previous artwork">← Previous</button><span>{index < 0 ? '—' : index + 1} / {visible.length}</span><button onClick={() => navigate(1)} disabled={!visible.length} aria-label="Next artwork">Next →</button></nav>
      <div><h1>{asset.title}</h1><code>{asset.id}</code></div>
      <label className="review-check"><input type="checkbox" checked={current?.reviewed ?? false} disabled={!editable} onChange={event => updateEntry(entry => ({ ...entry, reviewed: event.target.checked }))} /> Reviewed</label>
      <fieldset disabled={!editable} className="review-tools"><legend>Marker tool</legend>{(['note', 'remove-region', 'add-region'] as MarkerKind[]).map((kind, index) => <button key={kind} className={kind} aria-pressed={mode === kind} onClick={() => setMode(kind)}>{index + 1} · {markerLabels[kind]}</button>)}</fieldset>
      <label>Artwork notes<textarea aria-label="Artwork notes" rows={3} value={current?.notes ?? ''} disabled={!editable} placeholder="Overall issues or suggestions…" onChange={event => updateEntry(entry => ({ ...entry, notes: event.target.value }))} /></label>
      <h2>Markers ({current?.markers.length ?? 0})</h2>
      <div className="review-marker-list">{current?.markers.map((marker, index) => <button key={marker.id} className={marker.kind} aria-pressed={selected === marker.id} onClick={() => setSelected(marker.id)}>{index + 1}. {markerLabels[marker.kind]}<small>{marker.regionId ? `Region ${marker.regionId}` : 'No existing region'} · {marker.x.toFixed(1)}, {marker.y.toFixed(1)}</small>{marker.note && <small>{marker.note}</small>}</button>)}</div>
      {selectedMarker && <div className="review-marker-editor"><strong>{markerLabels[selectedMarker.kind]}</strong><label>Marker note<textarea ref={markerNote} aria-label="Marker note" disabled={!editable} rows={3} value={selectedMarker.note} placeholder="What should change here?" onChange={event => updateEntry(entry => ({ ...entry, markers: entry.markers.map(marker => marker.id === selected ? { ...marker, note: event.target.value } : marker) }))} /></label><button disabled={!editable} onClick={() => { updateEntry(entry => ({ ...entry, markers: entry.markers.filter(marker => marker.id !== selected) })); setSelected(undefined); }}>Delete marker</button></div>}
      <p role="status" className="review-save-status">{message}</p>
      <small>Markers describe requested fixes; they do not modify artwork. Arrow keys / Page Up / Page Down browse. Keys 1–3 choose tools.</small>
    </aside>
    <ArtworkReviewStage key={assetId} asset={asset} review={current} selected={selected} mode={mode} onMark={addMarker} onSelect={setSelected} onNavigate={wheelNavigate} onArtwork={data => setArtwork({ id: assetId, data })} />
  </main>;
}
