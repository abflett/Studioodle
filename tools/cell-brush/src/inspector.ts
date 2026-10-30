import type { CellField, CellDiagnostic } from './model';
/** Opt-in bounded snapshots for inspecting the most recent fit of each cell. */
export class CellInspector {
  readonly cells = new Map<number, CellDiagnostic>();
  selected: number | undefined;
  constructor(private panel: HTMLElement, private getField: () => CellField) {}
  capture = (index: number, diagnostic: CellDiagnostic) => { this.cells.set(index, diagnostic); };
  clear() { this.cells.clear(); this.selected = undefined; this.panel.replaceChildren(); }
  show(index: number) {
    this.selected = index;
    const diagnostic = this.cells.get(index), field = this.getField();
    this.panel.replaceChildren();
    const title = document.createElement('p');
    title.textContent = `Cell (${index % 100}, ${Math.floor(index / 100)}) · ${diagnostic?.mode ?? 'not captured'}`;
    this.panel.append(title);
    if (!diagnostic) return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 300;
    canvas.style.width = '100%'; canvas.style.maxWidth = '300px';
    canvas.setAttribute('aria-label', 'Three by three cells: actual crossings orange, snapped crossings blue');
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, 300, 300);
    const colors = ['#fffdf6', '#25343a', '#d85a55', '#e9ad45', '#6c9c75', '#508aa5', '#8973ad', '#e999ad'];
    const cx = index % 100, cy = Math.floor(index / 100);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= 100 || y < 0 || y >= 100) continue;
      const cell = field.cell(y * 100 + x), left = (dx + 1) * 100, top = (dy + 1) * 100;
      ctx.fillStyle = colors[cell.back]!; ctx.fillRect(left, top, 100, 100);
      ctx.fillStyle = colors[cell.front]!; ctx.beginPath();
      field.tables.variants[cell.profile]!.forEach(([px, py], i) => i ? ctx.lineTo(left + px * 100, top + py * 100) : ctx.moveTo(left + px * 100, top + py * 100));
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#9caaa7'; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 100, 0); ctx.lineTo(i * 100, 300); ctx.moveTo(0, i * 100); ctx.lineTo(300, i * 100); ctx.stroke(); }
    ctx.strokeStyle = '#d85a55'; ctx.lineWidth = 2; ctx.strokeRect(101, 101, 98, 98);
    for (const [points, color, radius] of [[diagnostic.actual, '#eea32d', 5], [diagnostic.snapped, '#309bd3', 3]] as const) {
      ctx.fillStyle = color;
      for (const [x, y] of points) { ctx.beginPath(); ctx.arc(100 + x * 100, 100 + y * 100, radius, 0, Math.PI * 2); ctx.fill(); }
    }
    this.panel.append(canvas);
    const detail = document.createElement('pre');
    const format = (points: readonly (readonly number[])[]) => points.map(p => `(${p.map(v => Number(v.toFixed(4))).join(', ')})`).join(' ') || 'none';
    detail.textContent = `Actual: ${format(diagnostic.actual)}\nSnapped: ${format(diagnostic.snapped)}\nProfile byte: ${diagnostic.selected.profile}\nFront/back: ${diagnostic.selected.front}/${diagnostic.selected.back}`;
    detail.style.whiteSpace = 'pre-wrap'; detail.style.fontSize = '11px';
    this.panel.append(detail);
  }
}
