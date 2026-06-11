/**
 * STCW Hours of Rest PDF Generator
 * Translated from Python reportlab version to TypeScript using pdfkit
 * Generates PDF forms showing crew rest hours in STCW format
 */

import PDFDocument from "pdfkit";
import * as fs from "node:fs";
import path from "node:path";
import type { SelectCrewRestSheet, SelectCrewRestDay } from "@shared/schema";

export interface PdfGenerationOptions {
  outputPath: string;
  title?: string;
}

/**
 * Render STCW Hours of Rest PDF form
 * Creates a visual grid showing rest hours for each day of the month
 */
export async function renderRestPdf(
  sheet: SelectCrewRestSheet,
  days: SelectCrewRestDay[],
  options: PdfGenerationOptions
): Promise<string> {
  const doc = new PDFDocument({ size: "A4", margin: 20 });

  // Ensure output directory exists
  const outputDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Stream to file
  const stream = fs.createWriteStream(options.outputPath);
  doc.pipe(stream);

  // Page dimensions
  const pageWidth = doc.page.width - 40; // Account for margins
  const pageHeight = doc.page.height - 40;

  // Header — match STCW/MLC reference form
  doc.fontSize(13).font("Helvetica-Bold");
  doc.text("RECORD OF HOURS OF REST", 20, 25, { align: "center", width: pageWidth });
  doc.fontSize(9).font("Helvetica");
  doc.text(
    "STCW 2010 Regulation VIII/1 and Code Section A-VIII/1 · MLC 2006 Standard A2.3",
    20,
    42,
    { align: "center", width: pageWidth }
  );

  doc.fontSize(10).font("Helvetica");
  doc.text(`Vessel / IMO No.: ${sheet.vesselId || ""}`, 20, 60);
  doc.text(`Seafarer (Name): ${sheet.crewName || ""}`, 20, 73);
  doc.text(`Position / Rank: ${sheet.rank || ""}`, 300, 73);
  doc.text(`Month: ${sheet.month || ""} ${sheet.year || ""}`, 300, 60);

  // Grid layout
  const gridTop = 85;
  const gridLeft = 20;
  const cellWidth = Math.min(20, (pageWidth - 60) / 24); // 24 hours + day column
  const cellHeight = 15;
  const dayColumnWidth = 30;

  // Hour headers (00-23)
  doc.fontSize(8);
  for (let h = 0; h < 24; h++) {
    const x = gridLeft + dayColumnWidth + h * cellWidth;
    doc.text(h.toString().padStart(2, "0"), x + 2, gridTop - 15);
  }

  // Data rows
  let currentY = gridTop;

  for (const day of days) {
    // Day number (extract from date)
    const dayNum = day.date.split("-")[2] || "??";
    doc.text(dayNum, gridLeft + 2, currentY + 3);

    // Rest/work cells for each hour
    for (let h = 0; h < 24; h++) {
      const x = gridLeft + dayColumnWidth + h * cellWidth;
      const hourKey = `h${h}` as keyof SelectCrewRestDay;
      const value = day[hourKey] || 0;

      // Draw cell border
      doc.rect(x, currentY, cellWidth, cellHeight).stroke();

      // Fill rest periods with X marks
      if (value === 1) {
        // Draw X for rest periods
        doc
          .moveTo(x + 2, currentY + 2)
          .lineTo(x + cellWidth - 2, currentY + cellHeight - 2)
          .stroke();
        doc
          .moveTo(x + 2, currentY + cellHeight - 2)
          .lineTo(x + cellWidth - 2, currentY + 2)
          .stroke();
      }
    }

    currentY += cellHeight;

    // Check if we need a new page
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 30;
    }
  }

  // Legend
  currentY += 18;
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Legend", gridLeft, currentY);
  doc.font("Helvetica");
  doc.text("X (shaded) = Hour of rest    ·    Blank = Hour of work", gridLeft + 45, currentY);

  // Compliance footer — exact STCW/MLC wording
  currentY += 18;
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Minimum hours of rest (STCW A-VIII/1 · MLC A2.3):", gridLeft, currentY);
  doc.font("Helvetica");
  currentY += 13;
  doc.text("1. A minimum of 10 hours of rest in any 24-hour period.", gridLeft + 10, currentY);
  currentY += 12;
  doc.text("2. A minimum of 77 hours of rest in any 7-day period.", gridLeft + 10, currentY);
  currentY += 12;
  doc.text(
    "3. Hours of rest may be divided into no more than two periods, one of which shall be at least 6 hours in length,",
    gridLeft + 10,
    currentY
  );
  currentY += 11;
  doc.text(
    "   and the intervals between consecutive periods of rest shall not exceed 14 hours.",
    gridLeft + 10,
    currentY
  );

  // Signature block
  const sigY = Math.max(currentY + 30, pageHeight - 90);
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Declaration", gridLeft, sigY);
  doc.font("Helvetica").fontSize(8);
  doc.text(
    "I confirm that this record is an accurate reflection of the hours of rest of the seafarer concerned.",
    gridLeft,
    sigY + 12
  );

  const colWidth = (pageWidth - 20) / 2;
  const lineY = sigY + 50;
  doc
    .moveTo(gridLeft, lineY)
    .lineTo(gridLeft + colWidth - 10, lineY)
    .stroke();
  doc
    .moveTo(gridLeft + colWidth + 10, lineY)
    .lineTo(gridLeft + pageWidth, lineY)
    .stroke();
  doc.fontSize(8);
  doc.text("Signature of seafarer", gridLeft, lineY + 4);
  doc.text(`Date: ____________________`, gridLeft, lineY + 16);
  doc.text("Signature of Master (or authorised person)", gridLeft + colWidth + 10, lineY + 4);
  doc.text(`Date: ____________________`, gridLeft + colWidth + 10, lineY + 16);

  // Generation footer
  doc.fontSize(7);
  doc.text(
    `Generated by ARUS on ${new Date().toISOString().split("T")[0]} · Page ${doc.bufferedPageRange().count} of ${doc.bufferedPageRange().count}`,
    gridLeft,
    pageHeight - 12,
    { width: pageWidth, align: "center" }
  );

  doc.end();

  // Wait for stream to finish
  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(options.outputPath));
    stream.on("error", reject);
  });
}

/**
 * Generate filename for PDF export
 */
export function generatePdfFilename(
  crewId: string,
  year: number,
  month: string,
  basePath: string = "bundles"
): string {
  const sanitizedCrewId = crewId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sanitizedMonth = month.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(basePath, `hours_rest_${sanitizedCrewId}_${year}_${sanitizedMonth}.pdf`);
}

/**
 * Convert month name to number for date calculations
 */
export function monthNameToNumber(monthName: string): number {
  const months = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];

  const index = months.indexOf(monthName.toUpperCase());
  return index >= 0 ? index + 1 : 1; // Default to January if not found
}
