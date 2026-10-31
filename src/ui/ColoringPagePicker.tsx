import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, FilePlus2, FileUp, Heart, LayoutGrid, PawPrint, Shapes, Smile, Square, Trash2, TreePine } from 'lucide-react';
import type { EditorSetup } from '../editor/setup';
import type { SavedPicture } from '../editor/savedPicture';
import type { PageCategory, PageDetail } from '../editor/coloringPageInfo';
import { pageInfo } from '../app/coloringPageBrowsing';
import { createPageFavorites } from '../platform/pageFavorites';
import { paperSize } from '../editor/document';
import { ColoringPagePreview } from './ColoringPagePreview';
import { ColoringPageTransfer } from './ColoringPageTransfer';
import { DialogHeader } from './DialogHeader';
import { closeOnBackdrop } from './dialog';
import drawingAction from '../assets/interface/start-coloring.png';

const favoritesStore = createPageFavorites();
function LearningIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4q5-2 9 1 4-3 9-1v16q-5-2-9 1-4-3-9-1ZM12 5v16M5.5 14l2-6 2 6m-3.3-2h2.6M15 9h3l-3 5h3" /></svg>;
}
function ThingsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14V7h10v7M13 10h4l4 4v5H3v-5ZM6 7V3h5v4" /><circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" /></svg>;
}
const categories = [
  ['all', 'All subjects', Shapes], ['characters', 'Characters', Smile], ['animals', 'Animals', PawPrint],
  ['nature', 'Places and Nature', TreePine], ['things', 'Things: vehicles and objects', ThingsIcon], ['learning', 'Letters and Numbers', LearningIcon],
] as const;
function Terrain({ detail }: { detail: PageDetail }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={detail === 'simple' ? 'M2 21h20M3 17c6 0 11-2 18-4' : detail === 'medium' ? 'M2 21h20M2 18c4 0 4-9 10-9s7 9 10 9' : 'M2 21h20M2 18 10 4l5 9 3-5 4 10M7.4 8.5 10 10l2.6-1.5'} /></svg>;
}
function Control({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <button type="button" className="page-control" title={label} aria-label={label} {...props}>{children}</button>;
}
export function ColoringPagePicker({ pages, initialPageId, bundledIds, onOpen, onClose, onDelete, onAdded }: {
  pages: EditorSetup[]; initialPageId?: string; bundledIds: Set<string>; onOpen: (page: EditorSetup) => void;
  onClose: () => void; onDelete: (page: SavedPicture) => void; onAdded: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), openButton = useRef<HTMLButtonElement>(null);
  const [grid, setGrid] = useState(false), [selectedId, setSelectedId] = useState(initialPageId);
  const [category, setCategory] = useState<PageCategory | 'all'>('all'), [detail, setDetail] = useState<PageDetail>();
  const [onlyFavorites, setOnlyFavorites] = useState(false), [message, setMessage] = useState('');
  const [favoriteState, setFavoriteState] = useState(() => { try { return { ids: favoritesStore.load(), failed: false }; } catch { return { ids: [] as string[], failed: true }; } });
  const [priority, setPriority] = useState(favoriteState.ids);
  const [transfer, setTransfer] = useState<{ page?: EditorSetup }>();
  const list = useMemo(() => pages.filter(page => {
    const info = pageInfo(page);
    return (category === 'all' || info.categories.includes(category)) && (!detail || info.detail === detail) && (!onlyFavorites || favoriteState.ids.includes(page.id!));
  }).map((page, index) => ({ page, index })).sort((a, b) => Number(priority.includes(b.page.id!)) - Number(priority.includes(a.page.id!)) || a.index - b.index).map(item => item.page), [pages, category, detail, onlyFavorites, favoriteState.ids, priority]);
  const index = Math.max(0, list.findIndex(page => page.id === selectedId)), current = list[index];
  const currentSize = current ? paperSize(current.format, current.size) : { width: 1, height: 1 };
  const batch = Math.floor(index / 6) * 6, shown = grid ? list.slice(batch, batch + 6) : current ? [current] : [];
  const touch = useRef<{ x: number; y: number } | undefined>(undefined);
  const skipClick = useRef(false);
  useEffect(() => { const modal = dialog.current; modal?.showModal(); return () => modal?.close(); }, []);
  const browse = (direction: number) => {
    if (!list.length) return;
    const next = grid ? ((Math.floor(index / 6) + direction + Math.ceil(list.length / 6)) % Math.ceil(list.length / 6)) * 6 : (index + direction + list.length) % list.length;
    setSelectedId(list[next]!.id);
  };
  const toggleFavorite = (page: EditorSetup) => {
    try {
      const ids = favoritesStore.load();
      const next = ids.includes(page.id!) ? ids.filter(id => id !== page.id) : [...ids, page.id!];
      favoritesStore.save(next); setFavoriteState({ ids: next, failed: false }); setMessage('');
    } catch { setMessage('Could not update favorites. Check device storage.'); }
  };
  const resetPosition = () => { setSelectedId(undefined); setPriority(favoriteState.ids); };
  const choose = (page: EditorSetup) => {
    if (grid) { setSelectedId(page.id); setGrid(false); requestAnimationFrame(() => openButton.current?.focus()); }
    else onOpen(page);
  };
  return <>
    <dialog ref={dialog} className="setup-dialog coloring-picker" aria-labelledby="coloring-picker-title" onCancel={onClose} onClick={e => closeOnBackdrop(e, onClose)} onKeyDown={e => {
      if (transfer || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); browse(e.key === 'ArrowLeft' ? -1 : 1); }
    }}>
      <div className="coloring-picker-body" data-grid={grid}>
        <div className="page-browser-top">
          <button type="button" className="page-control page-view-toggle" title={grid ? 'Single page view' : 'Grid overview'} aria-label={grid ? 'Single page view' : 'Grid overview'} aria-pressed={grid} onClick={() => setGrid(value => !value)}>{grid ? <Square /> : <LayoutGrid />}</button>
          <DialogHeader id="coloring-picker-title" title="Coloring Pages" onClose={onClose} closeLabel="Close coloring pages">
          <div className="page-filters">
            <div className="page-filter-well page-categories" role="group" aria-label="Page categories">{categories.map(([id, label, Icon]) => <Control key={id} label={label} aria-pressed={category === id} onClick={() => { setCategory(id); resetPosition(); }}><Icon /></Control>)}</div>
            <div className="page-filter-well page-details" role="group" aria-label="Coloring detail">{(['simple', 'medium', 'detailed'] as const).map(value => <Control key={value} label={`${value === 'simple' ? 'Simple' : value === 'medium' ? 'Medium' : 'High'} detail (toggle filter)`} aria-pressed={detail === value} onClick={() => { setDetail(detail === value ? undefined : value); resetPosition(); }}><Terrain detail={value} /></Control>)}</div>
            <Control label="Favorites only" className="page-control page-favorites-filter" aria-pressed={onlyFavorites} onClick={() => { setOnlyFavorites(value => !value); resetPosition(); }}><Heart /></Control>
          </div>
          </DialogHeader>
        </div>
        <div className="page-browse-content" onPointerDown={e => { skipClick.current = false; if (e.button === 0 && !(e.target as Element).closest('.page-heart')) touch.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={e => {
          const start = touch.current; touch.current = undefined;
          if (start && Math.abs(e.clientX - start.x) > 45 && Math.abs(e.clientX - start.x) > Math.abs(e.clientY - start.y) * 1.5) { skipClick.current = true; browse(e.clientX < start.x ? 1 : -1); }
        }} onPointerCancel={() => { touch.current = undefined; }} onClickCapture={e => { if (skipClick.current) { skipClick.current = false; e.preventDefault(); e.stopPropagation(); } }}>
          <Control label="Previous coloring page" className="page-control page-browse-arrow page-previous" disabled={list.length < (grid ? 7 : 2)} onClick={() => browse(-1)}><ArrowLeft /></Control>
          {list.length ? <div className={grid ? 'coloring-page-grid' : 'coloring-page-single'} style={{ '--preview-ratio': currentSize.width / currentSize.height } as CSSProperties}>{shown.map(page => {
            const size = paperSize(page.format, page.size), favorite = favoriteState.ids.includes(page.id!);
            return <div className="coloring-page-cell" key={page.id}>
              <div className="coloring-page-sheet" style={{ '--page-ratio': size.width / size.height } as CSSProperties}>
                <button type="button" ref={!grid ? openButton : undefined} className="page-artwork-button" title={grid ? `View ${page.title}` : `Draw ${page.title}`} aria-label={grid ? `View ${page.title}` : `Draw ${page.title}`} onClick={() => choose(page)}><ColoringPagePreview page={page} /></button>
                <Control label={`${favorite ? 'Remove' : 'Add'} ${page.title} ${favorite ? 'from' : 'to'} favorites`} className="page-control page-heart" aria-pressed={favorite} onClick={() => toggleFavorite(page)}><Heart /></Control>
                {!grid && <span className="page-number-badge" aria-label={`Page ${index + 1} of ${list.length}`}>{index + 1} / {list.length}</span>}
              </div>
            </div>;
          })}</div> : <div className="page-empty-state"><p>{onlyFavorites ? 'No favorite pages match these filters.' : 'No pages match these filters.'}</p><button className="go-button" onClick={() => { setCategory('all'); setDetail(undefined); setOnlyFavorites(false); resetPosition(); }}>Show all pages</button></div>}
          <Control label="Next coloring page" className="page-control page-browse-arrow page-next" disabled={list.length < (grid ? 7 : 2)} onClick={() => browse(1)}><ArrowRight /></Control>
        </div>
        <footer className="page-browser-footer">
          {grid ? <span className="page-range-badge" role="status">{list.length ? `${batch + 1}-${Math.min(batch + 6, list.length)}` : '0'} / {list.length}</span> : <>
            <div className="page-utilities" role="group" aria-label="Coloring page actions">
              <Control label="Add coloring pages" onClick={() => setTransfer({})}><FilePlus2 /></Control>
              <Control label="Share coloring page" disabled={!current} onClick={() => setTransfer({ page: current })}><FileUp /></Control>
              {current && !bundledIds.has(current.id!) && <Control label="Delete this custom coloring page" onClick={() => onDelete(current as SavedPicture)}><Trash2 /></Control>}
            </div>
            <button type="button" className="page-draw-action" title="Start coloring" aria-label="Start coloring" disabled={!current} onClick={() => { if (current) onOpen(current); }}><img src={drawingAction} alt="" aria-hidden="true" /></button>
          </>}
        </footer>
        <p className="sr-only" role="status">{grid ? `Showing ${list.length ? batch + 1 : 0} to ${Math.min(batch + 6, list.length)} of ${list.length} pages` : current ? `${current.title}, page ${index + 1} of ${list.length}` : 'No matching pages'}</p>
        {(message || favoriteState.failed) && <p className="page-browser-message" role="status">{message || 'Favorites could not be read. Your pages are unchanged.'}</p>}
      </div>
    </dialog>
    {transfer && <ColoringPageTransfer page={transfer.page} onClose={() => setTransfer(undefined)} onAdded={id => { onAdded(id); setCategory('all'); setDetail(undefined); setOnlyFavorites(false); setSelectedId(id); setGrid(false); setTransfer(undefined); }} />}
  </>;
}
