export type BrushTip = 'round' | 'diagonal-up' | 'diagonal-down' | 'scatter';
export type BrushOptions = { size: number; tip: BrushTip };
export type FillOptions = { pattern: 'solid' | 'dots' | 'stripes' | 'checker'; spacing: number };
export const defaultBrush: BrushOptions = { size: 5, tip: 'round' };
export const minBrushSize = 1;
export const maxBrushSize = 64;
export const defaultFill: FillOptions = { pattern: 'solid', spacing: 16 };

export function patternPixel(x: number, y: number, options: FillOptions) {
  const spacing = options.spacing;
  if (options.pattern === 'stripes') return (x + y) % spacing < spacing / 2;
  if (options.pattern === 'checker') return (Math.floor(x / spacing) + Math.floor(y / spacing)) % 2 === 0;
  if (options.pattern === 'dots') return (x % spacing - spacing / 2) ** 2 + (y % spacing - spacing / 2) ** 2 <= (spacing / 4) ** 2;
  return true;
}
