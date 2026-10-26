import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { drawingColors } from '../editor/palette';

function pageSize() {
  if (matchMedia('(max-width: 559px) and (max-height: 499px)').matches) return 8;
  return matchMedia('(max-width: 559px), (max-height: 429px)').matches ? 16 : 32;
}

export function ColorPicker({ color, onChoose, label = 'Drawing colors', allColors = false }: { color: number; onChoose: (color: number) => void; label?: string; allColors?: boolean }) {
  const [responsiveCount, setCount] = useState(pageSize);
  const count = allColors ? drawingColors.length : responsiveCount;
  const [page, setPage] = useState(() => {
    const index = drawingColors.findIndex((item) => item.value === color);
    return Math.floor(Math.max(0, index) / pageSize());
  });
  useEffect(() => {
    const resize = () => { setCount(pageSize()); setPage(0); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const pages = drawingColors.length / count;
  const current = allColors ? 0 : Math.min(page, pages - 1);
  return <div className="color-picker">
    <div className="art-colors" role="group" aria-label={label}>
      {drawingColors.slice(current * count, (current + 1) * count).map((item) => <button
        className="paper-color" key={item.name} aria-label={item.name} title={item.name}
        aria-pressed={color === item.value}
        style={{ backgroundColor: `#${item.value.toString(16).padStart(6, '0')}` }}
        onClick={() => onChoose(item.value)}>
        {color === item.value && <Check className="color-check" aria-hidden="true" />}
      </button>)}
    </div>
    {pages > 1 && <nav className="palette-pages" aria-label="More colors">
      <button className="icon-button" aria-label="Previous colors" onClick={() => setPage((current + pages - 1) % pages)}><ArrowLeft /></button>
      <div className="carousel-dots" aria-hidden="true">{Array.from({ length: pages }, (_, index) => <span key={index} className={index === current ? 'active' : ''} />)}</div>
      <span className="sr-only" role="status">Color page {current + 1} of {pages}</span>
      <button className="icon-button" aria-label="Next colors" onClick={() => setPage((current + 1) % pages)}><ArrowRight /></button>
    </nav>}
  </div>;
}
