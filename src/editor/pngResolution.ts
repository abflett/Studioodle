// Canvas exports carry browser-default density metadata. Replace pHYs so print
// tools see the document's chosen density without resampling its pixels.
export async function pngResolution(blob: Blob, dpi: number) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const chunk = new Uint8Array(21), data = new DataView(chunk.buffer);
  data.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4); // pHYs
  const perMeter = Math.round(dpi / .0254);
  data.setUint32(8, perMeter); data.setUint32(12, perMeter); chunk[16] = 1;
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  data.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts: BlobPart[] = [bytes.slice(0, 8)];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const end = offset + view.getUint32(offset) + 12;
    if (end > bytes.length) throw new Error('Invalid PNG chunk');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type !== 'pHYs') parts.push(bytes.slice(offset, end));
    if (type === 'IHDR') parts.push(chunk);
    offset = end;
  }
  return new Blob(parts, { type: 'image/png' });
}
