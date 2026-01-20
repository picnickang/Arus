/**
 * STCW Hours of Rest PDF Generator
 * Translated from Python reportlab version to TypeScript using pdfkit
 * Generates PDF forms showing crew rest hours in STCW format
 */

import PDFDocument from "pdfkit";
import * as fs from "node:fs";
import path from "node:path";
import type { SelectCrewRestSheet, SelectCrewRestDay } from "@shared/schema-runtime";

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

  // Header
  doc.fontSize(14).font("Helvetica-Bold");
  doc.text("RECORD OF HOURS OF REST (STCW)", 20, 30);

  doc.fontSize(10).font("Helvetica");
  doc.text(
    `Vessel: ${sheet.vesselId || ""} | Crew: ${sheet.crewName || ""} | Rank: ${sheet.rank || ""}`,
    20,
    50
  );
  doc.text(`Month: ${sheet.month || ""} ${sheet.year || ""}`, 20, 65);

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
  currentY += 20;
  doc.fontSize(9);
  doc.text("Legend: X = Rest period, Empty = Work period", gridLeft, currentY);
  doc.text(
    "STCW Requirements: Min 10 hours rest in any 24h period, Min 77 hours rest in any 7-day period",
    gridLeft,
    currentY + 15
  );

  // Footer
  doc.fontSize(8);
  doc.text(`Generated: ${new Date().toISOString().split("T")[0]}`, gridLeft, pageHeight - 20);

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
