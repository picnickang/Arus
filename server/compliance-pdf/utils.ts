/**
 * Compliance PDF Utils - Shared PDF utilities
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, RGB } from 'pdf-lib';
import { formatDate, countByStatus } from '../compliance-shared/utils';

export { formatDate, countByStatus };

export interface PDFContext {
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  yPosition: number;
}

export async function createPDFContext(): Promise<PDFContext> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]);

  return {
    pdfDoc,
    page,
    font,
    boldFont,
    yPosition: 800,
  };
}

export function getStatusColor(status: string): RGB {
  if (status === 'healthy') { return rgb(0, 0.6, 0); }
  if (status === 'warning') { return rgb(0.8, 0.6, 0); }
  return rgb(0.8, 0, 0);
}

export function getComplianceColor(rate: number): RGB {
  return rate >= 90 ? rgb(0, 0.6, 0) : rgb(0.8, 0.4, 0);
}

export function getHealthColor(health: number): RGB {
  if (health >= 80) { return rgb(0, 0.6, 0); }
  if (health >= 60) { return rgb(0.8, 0.6, 0); }
  return rgb(0.8, 0, 0);
}

export const COLORS = {
  black: rgb(0, 0, 0),
  blue: rgb(0.2, 0.2, 0.8),
  green: rgb(0, 0.6, 0),
  orange: rgb(0.8, 0.4, 0),
  yellow: rgb(0.8, 0.6, 0),
  red: rgb(0.8, 0, 0),
};

export function drawTitle(ctx: PDFContext, text: string, size: number = 18): void {
  ctx.page.drawText(text, {
    x: 50,
    y: ctx.yPosition,
    size,
    font: ctx.boldFont,
    color: COLORS.black,
  });
  ctx.yPosition -= 40;
}

export function drawSectionHeader(ctx: PDFContext, text: string): void {
  ctx.page.drawText(text, {
    x: 50,
    y: ctx.yPosition,
    size: 12,
    font: ctx.boldFont,
    color: COLORS.blue,
  });
  ctx.yPosition -= 20;
}

export function drawText(
  ctx: PDFContext,
  text: string,
  options?: { size?: number; color?: RGB; bold?: boolean }
): void {
  ctx.page.drawText(text, {
    x: 50,
    y: ctx.yPosition,
    size: options?.size ?? 10,
    font: options?.bold ? ctx.boldFont : ctx.font,
    color: options?.color ?? COLORS.black,
  });
  ctx.yPosition -= (options?.size ?? 10) + 5;
}

export function addSpacing(ctx: PDFContext, amount: number = 20): void {
  ctx.yPosition -= amount;
}
