import { cottageMasks as extractedMasks } from '../assets/stickers/cottageMasks';
import { generatedGardenMasks } from '../assets/stickers/generatedGardenMasks';
import { countingMasks } from '../assets/stickers/countingMasks';
import { springMasks } from '../assets/stickers/springMasks';
import { beachMasks } from '../assets/stickers/beachMasks';
import { winterMasks } from '../assets/stickers/winterMasks';
import { cottageMasks as legacyMasks } from '../assets/stickers/legacyCottageMasks';
const cottageMasks = { ...extractedMasks, ...generatedGardenMasks, ...countingMasks, ...springMasks, ...beachMasks, ...winterMasks };
export type CottageStickerKind = keyof typeof cottageMasks;
export const cottageStickerKinds = Object.keys(cottageMasks) as CottageStickerKind[];
export function isCottageSticker(kind: string): kind is CottageStickerKind { return Object.hasOwn(cottageMasks, kind); }
export function bitAt(bits: Uint8Array, index: number) { return (bits[index >> 3]! & (1 << (index & 7))) !== 0; }
const decoded = new Map<string, { width: number; height: number; coverage: Uint8Array; outline: Uint8Array }>();
export function cottageMask(kind: CottageStickerKind, nativePixels = true) {
  const key = `${kind}:${nativePixels}`;
  let mask = decoded.get(key);
  if (!mask) {
    const data = !nativePixels && kind in legacyMasks ? legacyMasks[kind as keyof typeof legacyMasks] : cottageMasks[kind];
    const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    mask = { width: data.width, height: data.height, coverage: decode(data.coverage), outline: decode(data.outline) }; decoded.set(key, mask);
  }
  return mask;
}
