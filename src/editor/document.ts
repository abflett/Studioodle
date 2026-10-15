export type Mark =
  | { kind: 'tree' | 'flower' | 'circle' | 'square' | 'triangle'; x: number; y: number; color: number }
  | { kind: 'stroke'; color: number; points: { x: number; y: number }[] };

export function paperSize(format: 'square' | 'landscape' | 'portrait') {
  return format === 'square' ? { width: 800, height: 800 } : format === 'portrait' ? { width: 700, height: 1000 } : { width: 1000, height: 700 };
}

