export type PaperOrientation = 'portrait' | 'landscape' | 'square';
export type PageSize = { width: number; height: number };
export const pageShortSide = 1000;
export const paperPresets = [
  { id: 'display', title: 'Display', detail: 'Display' },
  { id: 'full', title: 'Full page', detail: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'half', title: 'Half page', detail: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'photo', title: 'Photo', detail: '4 \u00d7 6 in', widthMm: 101.6, heightMm: 152.4 },
] as const;
export type PaperPresetId = typeof paperPresets[number]['id'];
export function validDisplaySize(size: PageSize) { return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0; }
export function orientSize(size: PageSize, orientation: PaperOrientation): PageSize {
  const short = Math.min(size.width, size.height), long = Math.max(size.width, size.height);
  return orientation === 'square' ? {width:short,height:short} : orientation === 'landscape' ? {width:long,height:short} : {width:short,height:long};
}
/** Stable document coordinates; display density and physical output are independent. */
export function normalizedPageSize(size: PageSize, orientation: PaperOrientation): PageSize {
  const source=validDisplaySize(size)?size:{width:4,height:3};
  const ratio=Math.min(8192/pageShortSide,Math.max(source.width,source.height)/Math.min(source.width,source.height));
  return orientSize({width:pageShortSide,height:Math.round(pageShortSide*ratio)},orientation);
}
export function presetMillimeters(id: PaperPresetId, orientation: PaperOrientation, display: PageSize={width:4,height:3}): PageSize {
  const preset=paperPresets.find(p=>p.id===id)!;
  if(preset.id!=='display')return orientSize({width:preset.widthMm,height:preset.heightMm},orientation);
  const size=normalizedPageSize(display,orientation);
  return {width:size.width/pageShortSide*210,height:size.height/pageShortSide*210};
}
/** Physical units are useful to tools and existing bundled layouts, not new-page geometry. */
export function presetSize(id: PaperPresetId, orientation: PaperOrientation): PageSize {
  const size=presetMillimeters(id,orientation);
  return {width:Math.round(size.width/25.4*96),height:Math.round(size.height/25.4*96)};
}
export function blankPageSize(id:PaperPresetId,orientation:PaperOrientation,display:PageSize):PageSize {
  return normalizedPageSize(id==='display'?display:presetMillimeters(id,orientation),orientation);
}
export function aspectRatioLabel(size:PageSize,orientation:PaperOrientation) {
  const oriented=orientSize(validDisplaySize(size)?size:{width:4,height:3},orientation),ratio=oriented.width/oriented.height;
  let best={numerator:1,denominator:1,error:Infinity};
  for(let denominator=1;denominator<=32;denominator++){
    const numerator=Math.max(1,Math.round(ratio*denominator)),error=Math.abs(numerator/denominator-ratio)/ratio;
    if(error<best.error)best={numerator,denominator,error};
    if(error<.002)break;
  }
  return `${best.numerator}:${best.denominator}`;
}
