import paper from 'paper';
import { inflatePathsD, unionD, JoinType, EndType, FillRule } from 'clipper2-ts';

const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

/** Preserve existing Beziers; outline only the new strokes, then boolean-union the ink. */
export function mergeReviewLines(svg, closures, width, height) {
  const scope = new paper.PaperScope(); scope.setup(new scope.Size(width, height));
  scope.settings.precision = 8;
  try {
    const group = /<g id="ink"[^>]*>([\s\S]*)<\/g><\/svg>/.exec(svg)?.[1];
    if (!group || /<g\b|clip-path|<image\b/.test(group)) throw Error('Expected unclipped filled vector ink');
    const originals = [...group.matchAll(/<path\b[^>]*\/>/g)].map(match => {
      const a = attrs(match[0]);
      if (a.fill !== 'black' || a.stroke !== 'none') throw Error('Expected solid filled ink');
      const item = new scope.CompoundPath({ pathData: a.d, insert: false });
      if (a.transform) item.transform(new scope.Matrix(...a.transform.replace(/^matrix\(|\)$/g, '').trim().split(/[ ,]+/).map(Number)));
      return item;
    });
    if (!originals.length) throw Error('No original ink');
    let original = originals[0];
    for (const item of originals.slice(1)) { const next = original.unite(item, { insert: false }); original.remove(); item.remove(); original = next; }
    const polygons = [];
    for (const line of closures) {
      const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height;
      if (!valid(line.a) || !valid(line.b) || (line.control !== null && !valid(line.control)) || !Number.isFinite(line.width) || line.width < .1 || line.width > 32) throw Error('Invalid closure geometry');
      const curve = new scope.Path({ insert: false }); curve.moveTo(new scope.Point(line.a));
      if (line.control) curve.quadraticCurveTo(new scope.Point(line.control), new scope.Point(line.b));
      else curve.lineTo(new scope.Point(line.b));
      curve.flatten(.002);
      polygons.push(...inflatePathsD([curve.segments.map(s => ({ x: s.point.x, y: s.point.y }))], line.width / 2, JoinType.Round, EndType.Round, 2, 5, .002));
      curve.remove();
    }
    const patches = new scope.CompoundPath({ pathData: unionD(polygons, [], FillRule.NonZero, 5).map(p => p.map((v, i) => `${i ? 'L' : 'M'}${v.x} ${v.y}`).join('') + 'Z').join(''), insert: false });
    const merged = original.unite(patches, { insert: false });
    const lost = original.subtract(merged, { insert: false });
    if (Math.abs(lost.area) > .01) throw Error(`Union removed original ink (${lost.area})`);
    const addedArea = Math.abs(merged.area) - Math.abs(original.area);
    if (addedArea < -.01) throw Error('Ink area shrank');
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path fill="black" stroke="none" d="${merged.pathData}"/></svg>\n`, addedArea, lines: closures.length };
  } finally { scope.remove(); }
}
