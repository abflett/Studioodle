export type BrushTip = 'round' | 'diagonal-up' | 'diagonal-down' | 'scatter';
export type BrushOptions = { size: number; tip: BrushTip };
export type FillOptions = { pattern: 'solid' | 'dots' | 'stripes' | 'checker'; spacing: number };
export const defaultBrush: BrushOptions = { size: 5, tip: 'round' };
export const minBrushSize = 1;
export const maxBrushSize = 64;
export const defaultFill: FillOptions = { pattern: 'solid', spacing: 16 };
