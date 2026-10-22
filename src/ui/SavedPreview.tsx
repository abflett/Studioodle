import { useLayoutEffect, useRef, useState } from 'react';
import { LoaderCircle, ImageOff } from 'lucide-react';
import { paperSize } from '../editor/document';
import { Artwork } from '../editor/Artwork';
import { prepareStickers } from '../editor/vectorStickers';
import type { EditorSetup } from '../editor/setup';

export function SavedPreview({ picture, pending = false, unavailable = false, fit = 'contain' }: { picture: EditorSetup; pending?: boolean; unavailable?: boolean; fit?: 'contain' | 'cover' }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<{ picture: EditorSetup; failed: boolean }>();
  const ready = !pending && !unavailable && result?.picture === picture && !result.failed;
  const failed = unavailable || (result?.picture === picture && result.failed);
  const { width, height } = paperSize(picture.format, picture.size);
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element || pending || unavailable) return;
    let active = true;
    let artwork: Artwork | undefined;
    const draw = () => {
      if (!active || !artwork) return;
      // Render vectors directly at the displayed size, with device-pixel backing.
      // Local dimensions exclude page-turn/tilt transforms, which must not alter the crop.
      const density = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(element.clientWidth * density));
      const h = Math.max(1, Math.round(element.clientHeight * density));
      if (element.width !== w) element.width = w;
      if (element.height !== h) element.height = h;
      const ctx = element.getContext('2d');
      if (!ctx) return;
      if (fit === 'cover') {
        const scale = Math.max(w / width, h / height);
        ctx.setTransform(scale, 0, 0, scale, (w - width * scale) / 2, (h - height * scale) / 2);
      } else ctx.setTransform(w / width, 0, 0, h / height, 0, 0);
      artwork.render(ctx, true);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    void prepareStickers(picture.document?.surfaces.map(surface => surface.kind) ?? []).then(() => {
      if (!active) return;
      artwork = picture.document ? Artwork.restore(picture.document) : Artwork.create(width, height, picture.background);
      draw();
      setResult({ picture, failed: false });
    }).catch(() => { if (active) setResult({ picture, failed: true }); });
    return () => { active = false; observer.disconnect(); artwork?.dispose(); };
  }, [picture, width, height, pending, unavailable, fit]);
  return <span className="saved-preview preview-frame" data-fit={fit} aria-busy={!ready && !failed} style={{ background: picture.background, aspectRatio: `${width} / ${height}`, width: fit === 'cover' ? '100%' : `min(100%, calc(var(--preview-height, 240px) * ${width / height}))`, height: fit === 'cover' ? '100%' : 'auto' }}>
    <canvas ref={canvas} width={1} height={1} aria-hidden="true" style={{ visibility: ready ? 'visible' : 'hidden' }} />
    {!ready && <span className={`preview-loading${failed ? ' is-error' : ''}`}>{failed ? <ImageOff aria-hidden="true" /> : <LoaderCircle className="preview-spinner" aria-hidden="true" />}<span className="sr-only" role="status">{failed ? 'Preview unavailable' : 'Loading picture preview'}</span></span>}
  </span>;
}
