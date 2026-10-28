import { ArrowLeft, ArrowRight, LayoutGrid } from 'lucide-react';
import { useEffect, useState } from 'react';
import { stickerCategories } from './stickerCatalog';
import type { StickerDetail } from './stickerCatalog';
import type { StickerKind } from '../editor/document';

export function StickerFilters({ value, onChange }: { value?: StickerDetail; onChange: (value?: StickerDetail) => void }) {
  return <div className="sticker-detail-well" role="group" aria-label="Sticker detail">{([undefined, 'simple', 'moderate', 'detailed'] as const).map(level => <button type="button" key={level ?? 'all'} title={level === undefined ? 'All stickers' : level === 'simple' ? 'Easy stickers' : level === 'moderate' ? 'Medium stickers' : 'Detailed stickers'} aria-label={level === undefined ? 'All stickers' : level === 'simple' ? 'Easy stickers' : level === 'moderate' ? 'Medium stickers' : 'Detailed stickers'} aria-pressed={value === level} onClick={() => onChange(level)}>
    {level === undefined ? <LayoutGrid aria-hidden="true" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d={level === 'simple' ? 'M2 21h20M3 17c6 0 11-2 18-4' : level === 'moderate' ? 'M2 21h20M2 18c4 0 4-9 10-9s7 9 10 9' : 'M2 21h20M2 18 10 4l5 9 3-5 4 10M7.4 8.5 10 10l2.6-1.5'} /></svg>}
  </button>)}</div>;
}
function batchSize() { return matchMedia('(max-width: 560px), (max-height: 500px)').matches ? 6 : 12; }
export function StickerBrowser({ categoryId, detail, onCategory, onAdd }: {
  categoryId: string | null; detail?: StickerDetail;
  onCategory: (id: string) => void; onAdd: (kind: StickerKind) => void;
}) {
  const [page, setPage] = useState(0), [count, setCount] = useState(batchSize);
  useEffect(() => { const resize = () => setCount(batchSize()); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const category = stickerCategories.find(item => item.id === categoryId);
  const matches = (item: { detail: StickerDetail }) => !detail || item.detail === detail;
  const items = category?.items.filter(matches) ?? [];
  const pages = Math.max(1, Math.ceil(items.length / count));
  const current = Math.min(page, pages - 1);
  const browse = (next: number) => setPage((next + pages) % pages);
  return <div className="sticker-collection">
    {category ? <><div className="sticker-item-grid" role="group" aria-label={`${category.title} stickers`}>
      {items.slice(current * count, (current + 1) * count).map(({ kind, title, icon: Icon, preview }) => <button type="button" className="sticker-item" key={kind} title={title} aria-label={title} onClick={() => onAdd(kind)}>{preview ? <img src={preview} alt="" /> : <Icon aria-hidden="true" />}</button>)}
    </div>{!items.length && <p className="sticker-empty" role="status">No stickers match this detail level.</p>}
    {pages > 1 && <nav className="sticker-paging" aria-label="Browse stickers"><button className="icon-button" aria-label="Previous stickers" onClick={() => browse(current - 1)}><ArrowLeft aria-hidden="true" /></button><span role="status">{current + 1} / {pages}</span><button className="icon-button" aria-label="Next stickers" onClick={() => browse(current + 1)}><ArrowRight aria-hidden="true" /></button></nav>}</> : <div className="sticker-category-grid" role="group" aria-label="Sticker categories">
      {stickerCategories.map(({ id, title, icon: Icon, items }) => <button type="button" key={id} title={title} aria-label={title} disabled={!items.some(matches)} onClick={() => onCategory(id)}><Icon aria-hidden="true" /></button>)}
    </div>}
  </div>;
}
