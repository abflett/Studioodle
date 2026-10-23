import { useCallback, useEffect, useRef, useState } from 'react';
import manifest from '../../art/stickers.json';
import { ArtworkReviewStage } from './ArtworkReviewStage';
import { emptyReview, markerLabels, mergeReviews, parseReview, reviewStorageKey } from './artworkReviewModel';
import type { ArtworkReview, AssetReview, LineDraft, ReviewClosure, ReviewTool, ReviewAsset, ReviewMarker } from './artworkReviewModel';
import type { ReviewArtwork } from './artworkReviewAsset';
import { loadReviewArtwork } from './artworkReviewAsset';
import { lineRepairIds, lineRepairTasks, reopenLineRepairs } from './artworkLineTasks';
import type { CurrentReviewRevision } from './artworkLineTasks';
import './artworkReview.css';

const assets: ReviewAsset[] = manifest;
function adjacentAsset(ids: string[], index: number, direction: number) {
  if (!ids.length) return undefined;
  return ids[index < 0 ? (direction > 0 ? 0 : ids.length - 1) : (index + direction + ids.length) % ids.length];
}
function LineWidthInput({ width, disabled, onChange }: { width: number; disabled: boolean; onChange: (width: number) => void }) {
  const [draft, setDraft] = useState<string>();
  return <input aria-label="Line width" type="text" inputMode="decimal" value={draft ?? String(width)} disabled={disabled}
    onFocus={() => setDraft(String(width))} onBlur={() => setDraft(undefined)} onChange={event => {
      const text = event.target.value, value = Number(text); setDraft(text);
      if (text.trim() && Number.isFinite(value) && value >= .1 && value <= 32) onChange(value);
    }} />;
}
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
  const [query, setQuery] = useState(''), [filter, setFilter] = useState(() => {
    const value = new URLSearchParams(location.search).get('filter');
    return value && ['all', 'unreviewed', 'flagged', 'line-repairs', 'line-unreviewed'].includes(value) ? value : 'all';
  });
  const [preparing, setPreparing] = useState(false);
  const [mode, setMode] = useState<ReviewTool>('note');
  const [draft, setDraft] = useState<LineDraft>();
  const [fillTarget, setFillTarget] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [artwork, setArtwork] = useState<{ id: string; data: ReviewArtwork }>();
  const importInput = useRef<HTMLInputElement>(null);
  const asset = assets.find(asset => asset.id === assetId)!;
  const current = review.assets.find(entry => entry.assetId === assetId);
  const selectedMarker = current?.markers.find(marker => marker.id === selected);
  const selectedLine = current?.closures?.find(line => line.id === selected);
  const lineIds = lineRepairIds(review);
  const currentTask = lineRepairTasks.find(task => task.assetId === assetId);
  const remainingLines = assets.filter(asset => lineIds.has(asset.id) && !review.assets.find(entry => entry.assetId === asset.id)?.reviewed).length;
  const visible = assets.filter(asset => {
    const entry = review.assets.find(entry => entry.assetId === asset.id);
    return `${asset.title} ${asset.id} ${asset.category}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' || (filter === 'flagged' ? !!(entry?.markers.length || entry?.closures?.length || entry?.notes) : filter === 'line-repairs' ? lineIds.has(asset.id) : filter === 'line-unreviewed' ? lineIds.has(asset.id) && !entry?.reviewed : !entry?.reviewed));
  });
  const index = visible.findIndex(asset => asset.id === assetId);
  const visibleIds = visible.map(asset => asset.id);
  const persist = useCallback((next: ArtworkReview) => {
    setReview(next);
    try { localStorage.setItem(reviewStorageKey, JSON.stringify(next)); setMessage('Saved locally. Export JSON to share or back up this review.'); return true; }
    catch { setMessage('Local saving failed. Keep this page open and export JSON now to preserve your notes.'); return false; }
  }, []);
  function chooseFilter(value: string) {
    setFilter(value);
    const url = new URL(location.href); url.searchParams.set('filter', value); history.replaceState(null, '', url);
  }
  const choose = useCallback((id: string) => {
    setAssetId(id); setSelected(undefined); setDraft(undefined); setFillTarget(undefined);
    const url = new URL(location.href); url.searchParams.set('asset', id); history.replaceState(null, '', url);
  }, []);
  function navigate(direction: number) { const id = adjacentAsset(visibleIds, index, direction); if (id) choose(id); }
  async function reopenLineQueue() {
    if (preparing) return;
    setPreparing(true);
    try {
      const ids = lineRepairIds(review), revisions = new Map<string, CurrentReviewRevision>();
      const context = document.createElement('canvas').getContext('2d')!;
      // Decode one at a time; geometry is retained only until revision reconciliation finishes.
      for (const id of ids) {
        const asset = assets.find(asset => asset.id === id)!;
        const data = await loadReviewArtwork(asset, new AbortController().signal);
        revisions.set(id, { sha256: data.sha256, viewBox: data.viewBox, regionAt: (x, y) => data.regions.find(region => context.isPointInPath(region.path, x, y))?.id ?? 0 });
      }
      const next = reopenLineRepairs(review, ids, revisions);
      const saved = persist(next); setQuery(''); chooseFilter('line-unreviewed');
      const first = assets.find(asset => ids.has(asset.id)); if (first) choose(first.id);
      if (saved) setMessage(`Reopened ${ids.size} line-repair assets. Notes and proposed lines preserved; completed cutout markers remain in repair history.`);
    } catch (error) { setMessage(`Could not reopen line repairs: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setPreparing(false); }
  }
  const chooseTool = useCallback((tool: ReviewTool) => { setMode(tool); setDraft(undefined); setFillTarget(undefined); }, []);
  const updateEntry = useCallback((change: (entry: AssetReview) => AssetReview, loaded = artwork?.id === assetId ? artwork.data : undefined) => {
    if (!loaded || (current && current.sha256 !== loaded.sha256)) return;
    const base = current ?? { assetId, source: asset.source, vectorPath: `src/assets/vector/${assetId}.svg`, viewBox: loaded.viewBox, sha256: loaded.sha256, notes: '', reviewed: false, markers: [] };
    const next = change(base);
    persist({ ...review, assets: [...review.assets.filter(entry => entry.assetId !== assetId), next] });
  }, [artwork, assetId, current, asset.source, review, persist]);
  function addMarker(data: ReviewArtwork, marker: ReviewMarker) {
    updateEntry(entry => ({ ...entry, markers: [...entry.markers, marker] }), data);
    setSelected(marker.id);
  }
  function addLine(data: ReviewArtwork, line: ReviewClosure) {
    updateEntry(entry => ({ ...entry, closures: [...(entry.closures ?? []), line] }), data);
    setSelected(line.id); setDraft(undefined); setFillTarget(line.id);
  }
  function changeLine(line: ReviewClosure) {
    updateEntry(entry => ({ ...entry, closures: (entry.closures ?? []).map(existing => existing.id === line.id ? line : existing) }));
  }
  function selectAnnotation(id: string) {
    if (id !== selected) setFillTarget(undefined);
    setSelected(id); setDraft(undefined);
  }
  function deleteAnnotation(id: string) {
    // Removing an old annotation is safe even when the artwork has changed.
    persist({ ...review, assets: review.assets.map(entry => entry.assetId === assetId ? { ...entry, markers: entry.markers.filter(marker => marker.id !== id), closures: entry.closures?.filter(line => line.id !== id) } : entry) });
    if (selected === id) setSelected(undefined);
    if (fillTarget === id) setFillTarget(undefined);
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (preparing) return;
      if (event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
      const key = event.key.toLowerCase();
      if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp'].includes(event.key) || key === 'a' || key === 'd') {
        event.preventDefault(); const id = adjacentAsset(visibleIds, index, event.key === 'ArrowRight' || event.key === 'PageDown' || key === 'd' ? 1 : -1); if (id) choose(id);
      }
      if (event.key === ' ') { event.preventDefault(); if (!event.repeat) updateEntry(entry => ({ ...entry, reviewed: !entry.reviewed })); }
      if (event.key === 'Escape') { setSelected(undefined); setDraft(undefined); setFillTarget(undefined); }
      if (event.key === '1') chooseTool('note');
      if (event.key === '2') chooseTool('remove-region');
      if (event.key === '3') chooseTool('add-region');
      if (event.key === '4') chooseTool('close-line');
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [visibleIds, index, choose, updateEntry, chooseTool, preparing]);
  const exportingLines = filter === 'line-repairs' || filter === 'line-unreviewed';
  function exportReview() {
    // Export completed annotations too, even when the remaining-only filter hides them.
    const selectedAssets = exportingLines ? review.assets.filter(asset => lineIds.has(asset.assetId)) : review.assets;
    const data = { ...review, assets: selectedAssets, ...(exportingLines ? { scope: 'line-repairs' } : {}), exportedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `studioodle-${exportingLines ? 'line-repairs' : 'artwork-review'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`Exported ${selectedAssets.length} artwork records, ${selectedAssets.reduce((sum, entry) => sum + entry.markers.length, 0)} markers and ${selectedAssets.reduce((sum, entry) => sum + (entry.closures?.length ?? 0), 0)} proposed lines.`);
  }
  const editable = artwork?.id === assetId && (!current || current.sha256 === artwork.data.sha256);
  return <main className="artwork-review" aria-busy={preparing} inert={preparing}>
    <header className="review-header">
      <strong>Artwork review <small>Developer tool</small></strong>
      <span>{review.assets.filter(entry => entry.reviewed).length} / {assets.length} reviewed · {review.assets.reduce((sum, entry) => sum + entry.markers.length, 0)} markers · {review.assets.reduce((sum, entry) => sum + (entry.closures?.length ?? 0), 0)} lines</span>
      <button onClick={() => importInput.current?.click()}>Import JSON</button><button className="review-primary" onClick={exportReview}>{exportingLines ? 'Export line repairs' : 'Export all JSON'}</button>
      <a href="/">Back to app</a>
      <input ref={importInput} hidden type="file" accept="application/json,.json" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        try { if (file.size > 5 * 1024 * 1024) throw Error('Review JSON must be smaller than 5 MiB.'); const imported = parseReview(await file.text(), assets); persist(mergeReviews(review, imported)); }
        catch (error) { setMessage(`Import failed: ${error instanceof Error ? error.message : String(error)}`); }
      }} />
    </header>
    <aside className="review-sidebar">
      <label>Find artwork<input type="search" value={query} placeholder="Name, ID or category" onChange={event => setQuery(event.target.value)} /></label>
      <label>Browse<select value={filter} onChange={event => chooseFilter(event.target.value)}><option value="all">All artwork</option><option value="unreviewed">Not reviewed yet</option><option value="flagged">With notes or markers</option><option value="line-repairs">Line repairs — all ({lineIds.size})</option><option value="line-unreviewed">Remaining line repairs ({remainingLines})</option></select></label>
      <button disabled={preparing} onClick={() => void reopenLineQueue()}>{preparing ? 'Preparing line repairs…' : 'Reopen line repairs'}</button>
      <small>Uncheck Reviewed for line-work assets only. Keep notes and proposed lines; completed cutout markers stay in repair history.</small>
      <select aria-label="Artwork" value={index >= 0 ? assetId : ''} onChange={event => choose(event.target.value)}>
        {index < 0 && <option value="" disabled>{asset.title} (outside filter)</option>}
        {visible.map(asset => <option key={asset.id} value={asset.id}>{review.assets.find(entry => entry.assetId === asset.id)?.reviewed ? '✓ ' : ''}{asset.title} · {asset.id}</option>)}
      </select>
      <nav className="review-browse"><button onClick={() => navigate(-1)} disabled={!visible.length} aria-label="Previous artwork">← Previous</button><span>{index < 0 ? '—' : index + 1} / {visible.length}</span><button onClick={() => navigate(1)} disabled={!visible.length} aria-label="Next artwork">Next →</button></nav>
      <div><h1>{asset.title}</h1><code>{asset.id}</code></div>
      {currentTask && <div className="review-task-summary"><strong>Line repair task</strong><small>{currentTask.operations.filter(operation => operation.status === 'deferred').length} pending markers{currentTask.notes.trim() ? ` · ${currentTask.notes}` : ''}</small></div>}
      <label className="review-check"><input type="checkbox" checked={current?.reviewed ?? false} disabled={!editable} onChange={event => updateEntry(entry => ({ ...entry, reviewed: event.target.checked }))} /> Reviewed</label>
      <fieldset disabled={!editable} className="review-tools"><legend>Review tool</legend>{(['note', 'remove-region', 'add-region', 'close-line'] as ReviewTool[]).map((kind, index) => <button key={kind} className={kind} aria-pressed={mode === kind} onClick={() => chooseTool(kind)}>{index + 1} · {kind === 'close-line' ? 'Close line' : markerLabels[kind]}</button>)}</fieldset>
      <label>Artwork notes<textarea aria-label="Artwork notes" rows={3} value={current?.notes ?? ''} disabled={!editable} placeholder="Overall issues or suggestions…" onChange={event => updateEntry(entry => ({ ...entry, notes: event.target.value }))} /></label>
      <h2>Markers ({current?.markers.length ?? 0})</h2>
      <div className="review-marker-list">{current?.markers.map((marker, index) => <button key={marker.id} className={marker.kind} aria-pressed={selected === marker.id} onClick={() => selectAnnotation(marker.id)}>{index + 1}. {markerLabels[marker.kind]}<small>{marker.regionId ? `Region ${marker.regionId}` : 'No existing region'} · {marker.x.toFixed(1)}, {marker.y.toFixed(1)}</small>{marker.note && <small>{marker.note}</small>}</button>)}</div>
      <h2>Proposed lines ({current?.closures?.length ?? 0})</h2>
      <div className="review-marker-list">{current?.closures?.map((line, index) => <button key={line.id} className="close-line" aria-pressed={selected === line.id} onClick={() => selectAnnotation(line.id)}>{index + 1}. {line.control ? 'Curved' : 'Straight'} closure<small>{line.fillSeed ? 'Fill point set' : 'No fill point'} · width {line.width}</small></button>)}</div>
      {selectedMarker && <div className="review-marker-editor"><strong>{markerLabels[selectedMarker.kind]}</strong><label>Marker note<textarea aria-label="Marker note" disabled={!editable} rows={3} value={selectedMarker.note} placeholder="What should change here?" onChange={event => updateEntry(entry => ({ ...entry, markers: entry.markers.map(marker => marker.id === selected ? { ...marker, note: event.target.value } : marker) }))} /></label><button onClick={() => deleteAnnotation(selectedMarker.id)}>Delete marker</button></div>}
      {selectedLine && <div className="review-marker-editor">
        <strong>Adjust proposed line</strong><small>Drag A, B or Curve on the artwork. Arrow keys move a focused handle; Shift makes smaller adjustments.</small>
        <label>Line width (SVG units)<LineWidthInput key={selectedLine.id} width={selectedLine.width} disabled={!editable} onChange={width => changeLine({ ...selectedLine, width })} /></label>
        <button disabled={!editable} onClick={() => changeLine({ ...selectedLine, control: null })}>Straighten line</button>
        <button disabled={!editable} aria-pressed={fillTarget === selectedLine.id} onClick={() => { setDraft(undefined); setFillTarget(fillTarget === selectedLine.id ? undefined : selectedLine.id); }}>Set fill point</button>
        {selectedLine.fillSeed && <button disabled={!editable} onClick={() => changeLine({ ...selectedLine, fillSeed: null })}>Clear fill point</button>}
        <label>Line note<textarea aria-label="Line note" rows={2} value={selectedLine.note} disabled={!editable} onChange={event => changeLine({ ...selectedLine, note: event.target.value })} /></label>
        <button onClick={() => deleteAnnotation(selectedLine.id)}>Delete line</button>
      </div>}
      <p role="status" className="review-save-status">{message}</p>
      <small>Annotations describe proposed fixes; regions are rebuilt offline. A / D, arrow keys or Page Up / Page Down browse. Space toggles Reviewed. Keys 1–4 choose tools.</small>
    </aside>
    <ArtworkReviewStage key={assetId} asset={asset} review={current} selected={selected} mode={mode} draft={draft} fillTarget={fillTarget} onMark={addMarker} onSelect={selectAnnotation} onDelete={deleteAnnotation} onDraft={value => { setDraft(value); setFillTarget(undefined); }} onLine={addLine} onChangeLine={changeLine} onFill={(id, point) => { const line = current?.closures?.find(line => line.id === id); if (line) changeLine({ ...line, fillSeed: point }); setFillTarget(undefined); }} onArtwork={data => setArtwork({ id: assetId, data })} />
  </main>;
}
