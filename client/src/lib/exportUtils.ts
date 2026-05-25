/**
 * Centralized data export utility for CSV, JSON, and PDF exports
 *
 * @example CSV Export with custom columns and headers
 * ```typescript
 * import { exportToCSV } from '@/lib/exportUtils';
 *
 * const data = [
 *   { id: '1', name: 'Pump A', status: 'healthy', value: 42.5 },
 *   { id: '2', name: 'Engine B', status: 'warning', value: 85.3 }
 * ];
 *
 * exportToCSV(data, {
 *   filename: 'equipment-export.csv',
 *   columns: ['id', 'name', 'status', 'value'],
 *   headers: {
 *     id: 'Equipment ID',
 *     name: 'Equipment Name',
 *     status: 'Health Status',
 *     value: 'Reading Value'
 *   }
 * });
 * ```
 *
 * @example CSV Export with automatic columns
 * ```typescript
 * exportToCSV(vessels, {
 *   filename: `fleet-export-${new Date().toISOString().split('T')[0]}.csv`
 * });
 * ```
 *
 * @example JSON Export
 * ```typescript
 * import { exportToJSON } from '@/lib/exportUtils';
 *
 * const reportData = {
 *   metadata: { generatedAt: new Date(), version: '1.0' },
 *   equipment: equipmentList,
 *   summary: { totalCount: 10, avgHealth: 85 }
 * };
 *
 * exportToJSON(reportData, {
 *   filename: 'marine-report.json'
 * });
 * ```
 *
 * @example PDF Export with sections
 * ```typescript
 * import { exportToPDF } from '@/lib/exportUtils';
 *
 * const sections = [
 *   {
 *     title: 'Fleet Overview',
 *     content: [
 *       { key: 'Total Vessels', value: '12' },
 *       { key: 'Active', value: '10' }
 *     ]
 *   }
 * ];
 *
 * await exportToPDF(sections, {
 *   filename: 'fleet-report.pdf',
 *   title: 'Fleet Report',
 *   subtitle: 'Generated on 2025-11-22'
 * });
 * ```
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportOptions {
  filename: string;
  columns?: string[];
  headers?: Record<string, string>;
}

export interface PDFSection {
  title: string;
  content: Array<{ key: string; value: string }>;
}

export interface PDFExportOptions {
  filename: string;
  title?: string;
  subtitle?: string;
  orientation?: "portrait" | "landscape";
}

export interface PDFTableData {
  headers: string[];
  rows: string[][];
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = globalThis.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  globalThis.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

export function exportToCSV(data: Record<string, unknown>[], options: ExportOptions): boolean {
  if (!data || data.length === 0) {
    return false; // Return false to indicate no data, let caller handle messaging
  }

  const columns = options.columns || Object.keys(data[0] ?? {});
  const headers = options.headers ?? {};

  const headerRow = columns
    .map((col) => headers[col] || col)
    .map(escapeCSVValue)
    .join(",");

  const dataRows = data.map((row) => columns.map((col) => escapeCSVValue(row[col])).join(","));

  const csvContent = [headerRow, ...dataRows].join("\n");

  downloadFile(csvContent, options.filename, "text/csv;charset=utf-8;");
  return true; // Return true on successful export
}

export function exportToJSON(data: unknown, options: Pick<ExportOptions, "filename">): boolean {
  if (!data) {
    return false; // Return false to indicate no data, let caller handle messaging
  }

  const jsonContent = JSON.stringify(data, null, 2);

  downloadFile(jsonContent, options.filename, "application/json;charset=utf-8;");
  return true; // Return true on successful export
}

export async function exportToPDF(
  sections: PDFSection[],
  options: PDFExportOptions
): Promise<boolean> {
  if (!sections || sections.length === 0) {
    return false;
  }

  try {
    const doc = new jsPDF({
      orientation: options.orientation || "portrait",
      unit: "mm",
      format: "a4",
    });

    let yPosition = 20;

    if (options.title) {
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(options.title, 20, yPosition);
      yPosition += 10;
    }

    if (options.subtitle) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(options.subtitle, 20, yPosition);
      yPosition += 15;
      doc.setTextColor(0);
    }

    sections.forEach((section, _index) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(section.title, 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      section.content.forEach((item) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`${item.key}: ${item.value}`, 25, yPosition);
        yPosition += 6;
      });

      yPosition += 5;
    });

    doc.save(options.filename);
    return true;
  } catch (error) {
    console.error("PDF export failed:", error);
    return false;
  }
}

export async function exportTableToPDF(
  tableData: PDFTableData,
  options: PDFExportOptions
): Promise<boolean> {
  if (!tableData?.headers || !tableData.rows || tableData.rows.length === 0) {
    return false;
  }

  try {
    const doc = new jsPDF({
      orientation: options.orientation || "landscape",
      unit: "mm",
      format: "a4",
    });

    let yPosition = 20;

    if (options.title) {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(options.title, 14, yPosition);
      yPosition += 8;
    }

    if (options.subtitle) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(options.subtitle, 14, yPosition);
      yPosition += 10;
      doc.setTextColor(0);
    }

    autoTable(doc, {
      head: [tableData.headers],
      body: tableData.rows,
      startY: yPosition,
      theme: "grid",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });

    doc.save(options.filename);
    return true;
  } catch (error) {
    console.error("PDF table export failed:", error);
    return false;
  }
}
