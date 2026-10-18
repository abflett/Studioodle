import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { stickerCategories } from './stickerCatalog';
import type { StickerKind } from '../editor/document';

export function StickerBrowser({ categoryId, color, onCategory, onAdd }: {
  categoryId: string | null; color: number;
  onCategory: (id: string) => void; onAdd: (kind: StickerKind) => void;
}) {
  const [page, setPage] = useState(0);
  const category = stickerCategories.find(item => item.id === categoryId);
  const total = category?.items.length ?? stickerCategories.length;
  const pages = Math.ceil(total / 6);
  const subject = category ? 'stickers' : 'categories';
  return <div className="sticker-browser">
    <nav className="sticker-pages" aria-label={category ? 'Browse stickers' : 'Browse sticker categories'}>
      {pages > 1 && <button className="icon-button" aria-label={`Previous ${subject}`} onClick={() => setPage((page + pages - 1) % pages)}><ArrowLeft aria-hidden="true" /></button>}
    <div className={`art-options ${category ? 'shape-options' : 'category-options'}`} style={{ color: `#${color.toString(16).padStart(6, '0')}` }}>
      {category ? category.items.slice(page * 6, page * 6 + 6).map(({ kind, title, icon: Icon, preview }) => <button className="format-button sticker-option" key={kind} onClick={() => onAdd(kind)}>
        {preview ? <img className="sticker-preview" src={preview} alt="" /> : <Icon aria-hidden="true" />}<span>{title}</span>
      </button>) : stickerCategories.slice(page * 6, page * 6 + 6).map(({ id, title, icon: Icon }) => <button className="format-button" key={id} onClick={() => onCategory(id)}><Icon aria-hidden="true" /><span>{title}</span></button>)}
    </div>
      {pages > 1 && <button className="icon-button" aria-label={`Next ${subject}`} onClick={() => setPage((page + 1) % pages)}><ArrowRight aria-hidden="true" /></button>}
    </nav>
    <span className="sr-only" role="status">Page {page + 1} of {pages}</span>
    <div className="sticker-page-indicators">
      {pages > 1 && <div className="carousel-dots" aria-hidden="true">{Array.from({ length: Math.min(pages, 5) }, (_, i) => <span key={i} className={i === Math.min(page, 4) ? 'active' : ''} />)}</div>}
    </div>
  </div>;
}
