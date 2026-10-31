import { nearestFixedColor } from './colorPalettes';
import type { ColoringPageInfo } from './coloringPageInfo';
import type { ArtworkDocument } from './document';
import { contrastingDrawingColor } from './palette';
export type PaperFormat = 'square' | 'landscape' | 'portrait';
export type EditorSetup = {
  id?: string;
  browse?: ColoringPageInfo;
  document?: ArtworkDocument;
  title: string;
  format: PaperFormat;
  size?: { width: number; height: number };
  printSizeMm?: { width: number; height: number };
  background: string;
  leafColor: number;
};

export function initialDrawingSettings(setup: EditorSetup) {
  const blank = /^blank page$/i.test(setup.title) && !setup.document;
  return {
    tool: blank ? 'brush' as const : 'bucket' as const,
    color: nearestFixedColor(blank ? contrastingDrawingColor(setup.background) : setup.leafColor),
  };
}
