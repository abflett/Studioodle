/** Preserve SVG rect geometry exactly; quadratic corners are not circular arcs. */
export function svgRectPath(a) {
  const x = Number(a.x ?? 0), y = Number(a.y ?? 0), w = Number(a.width), h = Number(a.height);
  const rx = Math.max(0, Math.min(Number(a.rx ?? a.ry ?? 0), w / 2));
  const ry = Math.max(0, Math.min(Number(a.ry ?? a.rx ?? 0), h / 2));
  if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
}
