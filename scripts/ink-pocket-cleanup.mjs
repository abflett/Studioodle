/** Potrace contour inspection: curve geometry stays unchanged; only selected holes disappear. */
export function traceContours(paths, unit = 10) {
  const result = [];
  for (const d of paths) {
    const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g);
    let i = 0, x = 0, y = 0, startX = 0, startY = 0, command, current;
    const number = () => { const value = Number(tokens[i++]); if (!Number.isFinite(value)) throw Error('Invalid traced coordinate'); return value; };
    while (i < tokens.length) {
      if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
      if (!command) throw Error('Missing traced path command');
      const relative = command === command.toLowerCase();
      switch (command.toLowerCase()) {
        case 'm': {
          x = number() + (relative ? x : 0); y = number() + (relative ? y : 0);
          startX = x; startY = y;
          current = { d: `M${x} ${y}`, points: [[x / unit, y / unit]], closed: false };
          result.push(current); command = relative ? 'l' : 'L'; break;
        }
        case 'l': {
          const a = number(), b = number(); current.d += `${command}${a} ${b}`;
          x = a + (relative ? x : 0); y = b + (relative ? y : 0);
          current.points.push([x / unit, y / unit]); break;
        }
        case 'c': {
          const values = Array.from({ length: 6 }, number);
          current.d += command + values.join(' ');
          const [x1, y1, x2, y2, nx, ny] = values.map((value, index) => value + (relative ? index % 2 ? y : x : 0));
          // Sampling is for measuring area/width only. The emitted cubic is untouched.
          for (let sample = 1; sample <= 24; sample++) {
            const u = sample / 24, v = 1 - u;
            current.points.push([(v ** 3 * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u ** 3 * nx) / unit,
              (v ** 3 * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u ** 3 * ny) / unit]);
          }
          x = nx; y = ny; break;
        }
        case 'z': current.d += 'Z'; current.closed = true; x = startX; y = startY; command = undefined; break;
        default: throw Error(`Unsupported Potrace command ${command}`);
      }
    }
  }
  return result.map((contour, index) => {
    if (!contour.closed) throw Error('Ink cleanup requires closed contours');
    let signedArea = 0, perimeter = 0;
    for (let i = 0; i < contour.points.length; i++) {
      const a = contour.points[i], b = contour.points[(i + 1) % contour.points.length];
      signedArea += (a[0] * b[1] - b[0] * a[1]) / 2;
      perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const area = Math.abs(signedArea);
    return { ...contour, index, signedArea, area, perimeter, width: 2 * area / perimeter, compactness: 4 * Math.PI * area / perimeter ** 2 };
  });
}

export function cleanTinyInkPockets(paths) {
  const contours = traceContours(paths);
  // Potrace's default output: positive outer ink contours, negative enclosed white holes.
  const holes = contours.filter(c => c.signedArea < 0);
  const inkArea = contours.reduce((sum, c) => sum + c.signedArea, 0);
  const boundary = contours.reduce((sum, c) => sum + c.perimeter, 0);
  const meanLineWidth = 2 * inkArea / boundary;
  if (!(meanLineWidth > 0) || !holes.length) return { d: contours.map(c => c.d).join(''), report: { removed: 0, meanLineWidth } };
  const sortedAreas = holes.map(c => c.area).sort((a, b) => a - b);
  const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];
  const maximumArea = Math.min(4 * meanLineWidth ** 2, medianArea * .1);
  const maximumWidth = meanLineWidth * .8;
  const maximumCompactness = .65; // Round sparkles survive even when small.
  const removed = holes.filter(c => c.area <= maximumArea && c.width <= maximumWidth && c.compactness < maximumCompactness);
  const removedIds = new Set(removed.map(c => c.index));
  return {
    d: contours.filter(c => !removedIds.has(c.index)).map(c => c.d).join(''),
    report: { meanLineWidth, maximumArea, maximumWidth, maximumCompactness, beforeHoles: holes.length, afterHoles: holes.length - removed.length, removed: removed.length,
      pockets: removed.map(c => ({ index: c.index, area: c.area, width: c.width, compactness: c.compactness, center: [c.points.reduce((s, p) => s + p[0], 0) / c.points.length, c.points.reduce((s, p) => s + p[1], 0) / c.points.length] })) },
  };
}
