import type { ArtworkDocument } from './document';
import { contrastingDrawingColor } from './palette';
export type PaperFormat = 'square' | 'landscape' | 'portrait';
export type EditorSetup = {
  id?: string;
  /** Ephemeral workshop target; never part of saved pictures or shared books. */
  authoringPageId?: string;
  document?: ArtworkDocument;
  title: string;
  format: PaperFormat;
  size?: { width: number; height: number };
  background: string;
  leafColor: number;
};

export function initialDrawingSettings(setup: EditorSetup) {
  if (setup.authoringPageId) return { tool: 'select' as const, color: setup.leafColor };
  const blank = /^blank page$/i.test(setup.title) && !setup.document;
  return {
    tool: blank ? 'brush' as const : 'bucket' as const,
    color: blank ? contrastingDrawingColor(setup.background) : setup.leafColor,
  };
}
