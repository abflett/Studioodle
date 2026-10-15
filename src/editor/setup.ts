import type { Mark } from './document';
export type PaperFormat = 'square' | 'landscape' | 'portrait';
export type EditorSetup = {
  id?: string;
  marks?: Mark[];
  title: string;
  format: PaperFormat;
  background: string;
  leafColor: number;
};

