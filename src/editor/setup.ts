import type { ArtworkDocument } from './document';
import { contrastingDrawingColor } from './palette';
export type PaperFormat = 'square' | 'landscape' | 'portrait';
export type EditorSetup = {
  id?: string;
  document?: ArtworkDocument;
  title: string;
  format: PaperFormat;
  size?: { width: number; height: number };
  background: string;
  leafColor: number;
};

export function initialDrawingSettings(setup: EditorSetup) {
  const blank = /^blank page$/i.test(setup.title) && !setup.document;
  return {
    tool: blank ? 'brush' as const : 'bucket' as const,
    color: blank ? contrastingDrawingColor(setup.background) : setup.leafColor,
  };
}


