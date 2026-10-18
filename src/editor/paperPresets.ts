// Physical formats use the engine's 96 scene units per inch. Paint density and
// fit-relative zoom remain independent of the chosen page dimensions.
export const paperPresets = [
  { id: 'full', title: 'Full page', detail: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'half', title: 'Half page', detail: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'photo', title: 'Photo', detail: '4 × 6 in', widthMm: 101.6, heightMm: 152.4 },
  { id: 'square', title: 'Square', detail: '6 × 6 in', widthMm: 152.4, heightMm: 152.4 },
] as const;
export type PaperPresetId = typeof paperPresets[number]['id'];
export function presetSize(id: PaperPresetId, orientation: 'portrait' | 'landscape') {
  const preset = paperPresets.find(item => item.id === id)!;
  const width = Math.round(preset.widthMm / 25.4 * 96), height = Math.round(preset.heightMm / 25.4 * 96);
  return orientation === 'landscape' ? { width: height, height: width } : { width, height };
}
