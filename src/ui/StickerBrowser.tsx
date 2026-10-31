import { ArrowLeft, ArrowRight, LayoutGrid } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { stickerCategories } from './stickerCatalog';
import type { StickerDetail } from './stickerCatalog';
import type { StickerKind } from '../editor/document';

export function StickerFilters({ value, onChange }: { value?: StickerDetail; onChange: (value?: StickerDetail) => void }) {
  return <div className="sticker-detail-well" role="group" aria-label="Sticker detail">{([undefined, 'simple', 'moderate', 'detailed'] as const).map(level => <button type="button" key={level ?? 'all'} title={level === undefined ? 'All stickers' : level === 'simple' ? 'Easy stickers' : level === 'moderate' ? 'Medium stickers' : 'Detailed stickers'} aria-label={level === undefined ? 'All stickers' : level === 'simple' ? 'Easy stickers' : level === 'moderate' ? 'Medium stickers' : 'Detailed stickers'} aria-pressed={value === level} onClick={() => onChange(level)}>
    {level === undefined ? <LayoutGrid aria-hidden="true" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d={level === 'simple' ? 'M2 21h20M3 17c6 0 11-2 18-4' : level === 'moderate' ? 'M2 21h20M2 18c4 0 4-9 10-9s7 9 10 9' : 'M2 21h20M2 18 10 4l5 9 3-5 4 10M7.4 8.5 10 10l2.6-1.5'} /></svg>}
  </button>)}</div>;
}
export function StickerBrowser({ categoryId, detail, onCategory, onAdd }: {
  categoryId: string | null; detail?: StickerDetail;
  onCategory: (id: string) => void; onAdd: (kind: StickerKind) => void;
}) {
  const [first, setFirst] = useState(0), [layout, setLayout] = useState({ columns: 4, rows: 3 });
  const collection = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = collection.current, body = element?.closest<HTMLElement>('.wizard-body'), dialog = element?.closest<HTMLDialogElement>('dialog');
    if (!element || !body || !dialog || !categoryId) return;
    const fit = () => {
      const style = getComputedStyle(element), wizard = getComputedStyle(body.parentElement!);
      const gap = parseFloat(style.getPropertyValue('--sticker-grid-gap')), cardHeight = parseFloat(style.getPropertyValue('--sticker-card-height'));
      const dialogStyle = getComputedStyle(dialog), capacity = parseFloat(dialogStyle.maxHeight) || dialog.clientHeight;
      const height = capacity - (body.getBoundingClientRect().top - dialog.getBoundingClientRect().top) - parseFloat(wizard.paddingBottom) - parseFloat(dialogStyle.paddingBottom) - parseFloat(dialogStyle.borderBottomWidth);
      const columns = Math.max(1, Math.min(6, Math.floor((body.clientWidth + gap) / ((body.clientWidth <= 500 ? 84 : 128) + gap))));
      // Leave space for paging even on a short final page; bound mounted previews.
      const rows = Math.max(1, Math.min(4, Math.floor((height - 66 + gap) / (cardHeight + gap))));
      setLayout(previous => previous.columns === columns && previous.rows === rows ? previous : { columns, rows });
    };
    fit(); const observer = new ResizeObserver(fit); observer.observe(body); observer.observe(dialog);
    return () => observer.disconnect();
  }, [categoryId]);
  const count = layout.columns * layout.rows;
  const category = stickerCategories.find(item => item.id === categoryId);
  const matches = (item: { detail: StickerDetail }) => !detail || item.detail === detail;
  const items = category?.items.filter(matches) ?? [];
  const pages = Math.max(1, Math.ceil(items.length / count));
  const current = Math.min(Math.floor(first / count), pages - 1);
  const browse = (next: number) => setFirst(((next + pages) % pages) * count);
  return <div ref={collection} className="sticker-collection" style={{ '--sticker-columns': layout.columns } as CSSProperties}>
    {category ? <><div className="sticker-item-grid" role="group" aria-label={`${category.title} stickers`}>
      {items.slice(current * count, (current + 1) * count).map(({ kind, title, icon: Icon, preview }) => <button type="button" className="sticker-item" key={kind} title={title} aria-label={title} onClick={() => onAdd(kind)}>{preview ? <img src={preview} alt="" /> : <Icon aria-hidden="true" />}</button>)}
    </div>{!items.length && <p className="sticker-empty" role="status">No stickers match this detail level.</p>}
    {pages > 1 && <nav className="sticker-paging" aria-label="Browse stickers"><button className="icon-button" aria-label="Previous stickers" onClick={() => browse(current - 1)}><ArrowLeft aria-hidden="true" /></button><span role="status">{current + 1} / {pages}</span><button className="icon-button" aria-label="Next stickers" onClick={() => browse(current + 1)}><ArrowRight aria-hidden="true" /></button></nav>}</> : <div className="sticker-category-grid" role="group" aria-label="Sticker categories">
      {stickerCategories.map(({ id, title, icon: Icon, items }) => <button type="button" key={id} title={title} aria-label={title} disabled={!items.some(matches)} onClick={() => onCategory(id)}><Icon aria-hidden="true" /></button>)}
    </div>}
  </div>;
}
