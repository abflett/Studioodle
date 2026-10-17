// A shared 32-color drawing palette; artwork stores RGB values independently.
export const drawingColors = [
  { name: 'Dark charcoal', value: 0x242428 },
  { name: 'Slate gray', value: 0x6c717b },
  { name: 'Cool silver', value: 0xb0b5bc },
  { name: 'Icy blue-white', value: 0xcce8ff },
  { name: 'Warm cream', value: 0xf6f2e8 },
  { name: 'Soft peach', value: 0xf1c49c },
  { name: 'Golden tan', value: 0xd79862 },
  { name: 'Dark cocoa', value: 0x2b1810 },

  { name: 'Warm saddle', value: 0x9e5e38 },
  { name: 'Deep espresso', value: 0x563222 },
  { name: 'Deep burgundy', value: 0x8c1d2a },
  { name: 'Retro red', value: 0xd93b3b },
  { name: 'Warm orange', value: 0xe86a33 },
  { name: 'Golden amber', value: 0xee9b33 },
  { name: 'Sunny yellow', value: 0xfad02c },
  { name: 'Butter yellow', value: 0xfdf08a },

  { name: 'Baby pink', value: 0xf28da8 },
  { name: 'Soft coral', value: 0xe66782 },
  { name: 'Deep magenta', value: 0xa33878 },
  { name: 'Pastel lavender', value: 0xa888db },
  { name: 'Vibrant purple', value: 0x7c43b2 },
  { name: 'Deep plum', value: 0x4d2163 },
  { name: 'Deep blue-violet', value: 0x43318f },
  { name: 'Midnight indigo', value: 0x1e2756 },

  { name: 'Lime', value: 0xa4df55 },
  { name: 'Leaf green', value: 0x68a832 },
  { name: 'Forest green', value: 0x2d783b },
  { name: 'Deep moss', value: 0x1b4b38 },
  { name: 'Retro teal', value: 0x38b29c },
  { name: 'Sky blue', value: 0x82cafa },
  { name: 'Classic blue', value: 0x4892dc },
  { name: 'Royal blue', value: 0x254e9b },
] as const;

function luminance(color: number) {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  };
  return .2126 * linear(color >> 16 & 255) + .7152 * linear(color >> 8 & 255) + .0722 * linear(color & 255);
}

export function contrastingDrawingColor(background: string): number {
  const darkest = drawingColors.reduce((a, b) => luminance(a.value) < luminance(b.value) ? a : b);
  const lightest = drawingColors.reduce((a, b) => luminance(a.value) > luminance(b.value) ? a : b);
  const paper = luminance(parseInt(background.slice(1), 16));
  const contrast = (color: number) => {
    const ink = luminance(color);
    return (Math.max(paper, ink) + .05) / (Math.min(paper, ink) + .05);
  };
  return contrast(darkest.value) >= contrast(lightest.value) ? darkest.value : lightest.value;
}
