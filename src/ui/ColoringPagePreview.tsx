import { useEffect, useState } from 'react';
import { ImageOff, LoaderCircle } from 'lucide-react';
import { pictureSvg } from '../editor/pictureSvg';
import type { EditorSetup } from '../editor/setup';

/** Small, disposable SVG previews; browsing never prepares editor hit maps. */
export function ColoringPagePreview({ page }: { page: EditorSetup }) {
  const [result, setResult] = useState<{ page: EditorSetup; url?: string }>();
  useEffect(() => {
    let active = true, url: string | undefined;
    void pictureSvg(page).then(svg => {
      if (!active) return;
      url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
      setResult({ page, url });
    }).catch(() => { if (active) setResult({ page }); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [page]);
  if (result?.page === page) return result.url ? <img src={result.url} alt={page.title} draggable={false} /> : <span className="page-preview-status" role="status"><ImageOff /><span className="sr-only">Preview unavailable for {page.title}</span></span>;
  return <span className="page-preview-status" role="status"><LoaderCircle className="preview-spinner" /><span className="sr-only">Loading {page.title}</span></span>;
}
