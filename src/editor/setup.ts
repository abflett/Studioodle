import type { Mark, ArtworkDocument } from './document';
import { contrastingDrawingColor } from './palette';
export type PaperFormat = 'square' | 'landscape' | 'portrait' | 'window';
export type EditorSetup = {
  id?: string;
  marks?: Mark[];
  document?: ArtworkDocument;
  title: string;
  format: PaperFormat;
  size?: { width: number; height: number };
  background: string;
  leafColor: number;
};

export function initialDrawingSettings(setup: EditorSetup) {
  const blank = setup.title === 'Blank page' && !setup.document && !setup.marks;
  return {
    tool: blank ? 'brush' as const : 'bucket' as const,
    color: blank ? contrastingDrawingColor(setup.background) : setup.leafColor,
  };
}


