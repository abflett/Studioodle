import { execFileSync } from 'node:child_process';

/** Turn offline region labels into closed paths; no raster maps are shipped. */
export function regionSvg({ width, height, bounds, regionCount, scale, lookupScale = scale, labels, commands, matrix }) {
  const w = width * scale, h = height * scale;
  const boxes = Array.from({ length: regionCount + 1 }, () => ({ left: w, top: h, right: 0, bottom: 0 }));
  for (let i = 0; i < labels.length; i++) {
    const id = labels[i]; if (id <= 0) continue;
    const b = boxes[id], x = i % w, y = Math.floor(i / w);
    b.left = Math.min(b.left, x); b.top = Math.min(b.top, y);
    b.right = Math.max(b.right, x + 1); b.bottom = Math.max(b.bottom, y + 1);
  }
  const regionPaths = [];
  for (let id = 1; id <= regionCount; id++) {
    const b = { ...boxes[id] };
    if (b.right <= b.left) throw new Error(`Missing region ${id}`);
    // Add a white border, including regions that touch an asset edge.
    const x0 = b.left - 1, y0 = b.top - 1, sw = b.right - b.left + 2, sh = b.bottom - b.top + 2;
    const stride = Math.ceil(sw / 8), bitmap = Buffer.alloc(stride * sh);
    for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
      const px=x0+x,py=y0+y,index=py*w+px;
      const inside=labels[index]===id;
      if (inside) bitmap[y * stride + (x >> 3)] |= 1 << (7 - (x & 7));
    }
    const pbm = Buffer.concat([Buffer.from(`P4\n${sw} ${sh}\n`), bitmap]);
    const svg = execFileSync(process.env.POTRACE_PATH ?? 'tools/bin/potrace/potrace-1.16.win64/potrace.exe',
      ['-', '-s', '-a', '1', '-O', String(.015 * scale), '-t', '0', '-o', '-'], { input: pbm, maxBuffer: 32e6 }).toString();
    const paths = [...svg.matchAll(/<path\s+d="([^"]+)"/g)].map(match => match[1]);
    if (!paths.length) throw new Error(`Empty traced region ${id}`);
    const transform = [.1 / scale, 0, 0, -.1 / scale, x0 / scale, (y0 + sh) / scale];
    regionPaths.push(`<path id="region-${id}" data-bounds="${[b.left / scale, b.top / scale, b.right / scale, b.bottom / scale].join(' ')}" transform="matrix(${transform.join(' ')})" d="${paths.join(' ')}"/>`);
  }
  // Later white shapes occlude earlier ink. Encode the existing inverse clips
  // as SVG geometry instead of flattening authored vectors back into pixels.
  const [a, b, c, d, e, f] = matrix, determinant = a * d - b * c;
  if (!determinant) throw new Error('Invalid artwork transform');
  const inverse = (x, y) => [(d * (x - e) - c * (y - f)) / determinant, (-b * (x - e) + a * (y - f)) / determinant];
  const corners = [[-100, -100], [width + 100, -100], [width + 100, height + 100], [-100, height + 100]].map(([x, y]) => inverse(x, y));
  const outer = corners.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + 'Z';
  const clips = commands.flatMap((command, index) => command.fill !== 'base' ? [] :
    [`<clipPath id="clip-base-${index}" clipPathUnits="userSpaceOnUse"><path transform="matrix(${matrix.join(' ')})" clip-rule="evenodd" fill-rule="evenodd" d="${outer} ${command.d}"/></clipPath>`]);
  const inkPaths = commands.flatMap((command, index) => {
    if (command.fill !== 'ink' && !command.stroke) return [];
    let ink = `<path id="ink-${index + 1}" transform="matrix(${matrix.join(' ')})" fill="${command.fill === 'ink' ? 'black' : 'none'}" stroke="${command.stroke ? 'black' : 'none'}" stroke-width="${command.width}" d="${command.d}"/>`;
    for (let later = index + 1; later < commands.length; later++)
      if (commands[later].fill === 'base') ink = `<g clip-path="url(#clip-base-${later})">${ink}</g>`;
    return [ink];
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" data-region-format="1" data-region-scale="${lookupScale}"${lookupScale !== scale ? ` data-analysis-scale="${scale}"` : ''} data-bounds="${[bounds.left, bounds.top, bounds.right, bounds.bottom].join(' ')}">${clips.length ? `<defs>${clips.join('')}</defs>` : ''}<g id="regions" fill="white" fill-rule="nonzero">${regionPaths.join('')}</g><g id="ink" stroke-linejoin="round" stroke-linecap="round">${inkPaths.join('')}</g></svg>`;
}
