import { svgPrintSize } from '../editor/exportResolution';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';

/** Kept in a lazy chunk: PDF tooling is unnecessary for editing, SVG or PNG. */
export async function picturePdf(svg: SVGSVGElement, title: string): Promise<Blob> {
  const {width,height}=svgPrintSize(svg);
  const pageWidth=width*72,pageHeight=height*72;
  const pdf = new jsPDF({ orientation: width > height ? 'landscape' : 'portrait', unit: 'pt', format: [pageWidth, pageHeight], compress: true });
  pdf.setProperties({ title, creator: 'Studioodle' });
  await svg2pdf(svg, pdf, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  return pdf.output('blob');
}
