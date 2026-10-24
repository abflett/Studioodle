import { appCursorGraphics, cursorDensities, rasterizeCursor, cursorImage, draggingCursorGraphics, toolCursorGraphics } from '../../src/ui/toolCursors';

export async function checkCursors() {
  const assets = { ...toolCursorGraphics, ...appCursorGraphics, move: draggingCursorGraphics.select, grabbing: draggingCursorGraphics.pan };
  const backgrounds = ['#ffffff', '#172234', '#888888', '#f3ce58', '#355e3b'];
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = backgrounds.length * 80 + 40;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#dddddd'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let column = 0;
  const originalTheme = document.documentElement.dataset.theme;
  try {
    for (const [name, graphic] of Object.entries(assets)) {
      const source = cursorImage(graphic, 0xf12b88);
      document.documentElement.dataset.theme = 'light';
      const light = cursorImage(graphic, 0xf12b88);
      document.documentElement.dataset.theme = 'dark';
      if (cursorImage(graphic, 0xf12b88) !== light) throw Error('Cursor must be independent of theme');
      if (graphic.svg.includes('#4caaa2') && !decodeURIComponent(source).includes('#f12b88')) throw Error('Selected paint color lost');
      const image = new Image(); image.src = source; await image.decode();
      for (const density of cursorDensities) {
        const rendered = rasterizeCursor(image, graphic, density);
        if (rendered.width !== 40 * density || rendered.height !== 40 * density) throw Error('Cursor density size mismatch');
        const pixels = rendered.getContext('2d')!.getImageData(0, 0, rendered.width, rendered.height).data;
        let partial = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 0 && pixels[i]! < 255) partial++;
        if (partial < 12) throw Error(`Cursor lacks antialiased edges: ${name} at ${density}x`);
      }
      const rendered = rasterizeCursor(image, graphic, 1);
      ctx.fillStyle = '#172234'; ctx.font = '12px sans-serif'; ctx.fillText(name, column * 72 + 4, 24);
      backgrounds.forEach((background, row) => {
        ctx.fillStyle = background; ctx.fillRect(column * 72, row * 80 + 40, 72, 80);
        ctx.drawImage(rendered, column * 72 + 16, row * 80 + 60, 40, 40);
      });
      column++;
    }
    return { themeIndependent: true, selectedPaint: true, antialiasedDensities: cursorDensities, preview: canvas.toDataURL() };
  } finally {
    if (originalTheme === undefined) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = originalTheme;
  }
}
