import { useEffect, useRef } from 'react';
import { paperSize } from '../editor/document';
import { Artwork } from '../editor/Artwork';
import type { EditorSetup } from '../editor/setup';
export function SavedPreview({ picture }: { picture: EditorSetup }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = paperSize(picture.format, picture.size);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const artwork = picture.document ? Artwork.restore(picture.document) : Artwork.create(width, height, picture.background);
    if (!picture.document && picture.marks) artwork.importMarks(picture.marks);
    artwork.render(ctx);
  }, [picture, width, height]);
  return <canvas ref={canvas} width={width} height={height} className="saved-preview" aria-hidden="true" style={{ background: picture.background, width: '100%', height: '100%', objectFit: 'contain' }} />;
}

