import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';

/** Kept in a lazy chunk: PDF tooling is unnecessary for editing, SVG or PNG. */
export async function picturePdf(svg: SVGSVGElement, title: string): Promise<Blob> {
  const [, , width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number) as [number, number, number, number];
  const pdf = new jsPDF({ orientation: width > height ? 'landscape' : 'portrait', unit: 'pt', format: [width * .75, height * .75], compress: true });
  pdf.setProperties({ title, creator: 'Studioodle' });
  await svg2pdf(svg, pdf, { x: 0, y: 0, width: width * .75, height: height * .75 });
  return pdf.output('blob');
}
