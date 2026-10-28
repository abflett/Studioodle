import { drawingColors } from './palette';

export const paletteVersion = 1;
export type CustomColors = readonly (number | null)[];
export const emptyCustomColors = (): (number | null)[] => Array(32).fill(null);
export const fixedPalettes = [
  { name: 'Everyday', colors: drawingColors.map(c => c.value), dots: [0xd93b3b,0x68a832,0x4892dc] },
  { name: 'Pastel', colors: [0x000000,0x87909e,0xc8cdd5,0xe5f3ff,0xffffff,0xf8d9bc,0xe9c5a5,0xb59b92,0xd7b29b,0xbfa5a1,0xdca8b8,0xf4b2b9,0xfac1a4,0xf8d4a4,0xf9e8ab,0xfff3c9,0xf7c9dd,0xf4bcca,0xd9b4d5,0xcdbcec,0xbdaee8,0xa89acb,0xa4abe0,0xa0b6d6,0xd9ecb4,0xc3dfa9,0xa9d0b2,0x9fc4b7,0xb1e1d7,0xc4e7fa,0xaccff1,0xb4c1e6], dots: [0xf4b2b9,0xb1e1d7,0xaccff1] },
  { name: 'Vivid', colors: [0x000000,0x575b70,0xbcc4dc,0xd4f8ff,0xffffff,0xffbb8b,0xffa34b,0x582d44,0xb86c33,0x743a37,0xc91658,0xff3157,0xff6b24,0xffab00,0xffe600,0xf9ff70,0xff63ba,0xff4b8e,0xe829a6,0xc272ff,0x9e3cff,0x6625c7,0x5944ff,0x2331a6,0xc4ff24,0x76ee24,0x1ad765,0x079b72,0x00dfc4,0x26d9ff,0x168dff,0x304dff], dots: [0xff3157,0x76ee24,0x168dff] },
  { name: 'Moody', colors: [0x000000,0x515764,0x9296a0,0xb7c6d1,0xffffff,0xc19f8c,0xa98464,0x30232b,0x805d46,0x47332d,0x6e3448,0x9c4e58,0xb36b4d,0xb08a48,0xb4a25b,0xd2c494,0xa56f8e,0xa96778,0x814e78,0x8e7ca8,0x69567f,0x453451,0x4d4976,0x28344d,0x8a9857,0x657c49,0x40624c,0x284b40,0x477d78,0x779eae,0x4b7798,0x354c73], dots: [0x9c4e58,0x40624c,0x354c73] },
 ] as const;
const fixed = fixedPalettes.flatMap(p => p.colors);
/** Negative integer tokens distinguish slot references from literal paper/source RGB. */
export const slotColor = (slot: number) => -1 - slot;
export const colorSlot = (color: number) => -1 - color;
export const validRgb = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffff;
export const validCustomColors = (value: unknown): value is CustomColors => Array.isArray(value) && value.length === 32 && value.every(c => c === null || validRgb(c));
export function definedColor(color: number, custom: CustomColors) {
  if (!Number.isInteger(color)) return false;
  if (color >= 0) return validRgb(color);
  const slot = colorSlot(color);
  return slot >= 0 && slot < 160 && (slot < 128 || custom[slot - 128] !== null && custom[slot - 128] !== undefined);
}
export function resolveColor(color: number, custom: CustomColors = []) {
  if (color >= 0) return color;
  const slot = colorSlot(color);
  const resolved = slot < 128 ? fixed[slot] : custom[slot - 128];
  if (resolved === null || resolved === undefined) throw Error('Undefined palette slot.');
  return resolved;
}
export function nearestFixedColor(rgb: number) {
  let best = 0, distance = Infinity;
  fixed.forEach((value, index) => {
    const d = [0,8,16].reduce((sum, shift) => sum + ((value >> shift & 255) - (rgb >> shift & 255)) ** 2, 0);
    if (d < distance) { distance = d; best = index; }
  });
  return slotColor(best);
}

export const usablePaletteColor = (color:number,custom:CustomColors) => definedColor(color,custom) ? color : slotColor(0);
