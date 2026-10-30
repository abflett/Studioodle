import { useEffect, useState } from 'react';
import { ImageOff, LoaderCircle } from 'lucide-react';
import { pictureThumbnails } from '../app/pictureThumbnails';
import { createPictureThumbnailRepository } from '../platform/pictureThumbnails';
import { paperSize } from '../editor/document';
import type { PictureSummary } from '../editor/pictureSummary';

export function GalleryPreview({ picture, onMetadata, onUnavailable }: { picture: PictureSummary; onMetadata?: (value: PictureSummary) => void; onUnavailable?: (value: PictureSummary) => void }) {
  const [result, setResult] = useState<{ key: string; url?: string; failed?: boolean }>();
  const [attempt, setAttempt] = useState(0);
  const key = `${picture.id}:${picture.updatedAt}`, warm = pictureThumbnails.peek(picture);
  const url = result?.key === key ? result.url : warm?.url;
  const failed = result?.key === key && result.failed;
  const size = paperSize(picture.format, picture.size);
  useEffect(() => {
    const controller = new AbortController();
    void pictureThumbnails.get(picture, controller.signal).then(entry => {
      if (controller.signal.aborted) return;
      setResult({ key, url: entry.url });
      onMetadata?.({ ...picture, pageLayout: entry.thumbnail.pageLayout, stickerCount: entry.thumbnail.stickerCount });
    }).catch(() => { if (!controller.signal.aborted) { setResult({ key, failed: true }); onUnavailable?.(picture); } });
    return () => controller.abort();
  }, [picture, onMetadata, onUnavailable, key, attempt]);
  return <span className="saved-preview preview-frame" data-fit="cover" aria-busy={!url && !failed} style={{ aspectRatio: `${size.width} / ${size.height}`, width: '100%', height: '100%' }}>
    {url && <img src={url} alt="" draggable={false} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={() => {
      pictureThumbnails.invalidate(picture.id, picture.updatedAt);
      setResult({ key, failed: true });
      if (attempt < 1) void createPictureThumbnailRepository().delete(picture.id, picture.updatedAt).catch(() => {}).finally(() => setAttempt(value => value + 1));
      else onUnavailable?.(picture);
    }} />}
    {!url && <span className={`preview-loading${failed ? ' is-error' : ''}`}>{failed ? <ImageOff aria-hidden="true" /> : <LoaderCircle className="preview-spinner" aria-hidden="true" />}<span className="sr-only" role="status">{failed ? 'Preview unavailable' : 'Loading picture preview'}</span></span>}
  </span>;
}
