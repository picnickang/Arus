/**
 * AMOS File Parser
 *
 * Reads AMOS Business Suite export files (CSV and XML).
 * Normalizes both formats into arrays of Record<string, string> rows
 * for the field mapper to process.
 *
 * AMOS CSV quirks handled:
 *   - BOM (byte order mark) at start of file
 *   - Semicolon delimiter (common in European AMOS installations)
 *   - Quoted fields with embedded semicolons
 *   - Empty trailing columns
 *   - Windows line endings (CRLF)
 *
 * AMOS XML quirks handled:
 *   - Namespace prefixes (amos:, ns0:)
 *   - CDATA sections in description fields
 *   - Attributes vs. child elements (varies by AMOS version)
 */

export interface ParseResult {
  rows: Record<string, string>[];
  headers: string[];
  format: "csv" | "xml";
  warnings: string[];
  rowCount: number;
}

// ============================================================================
// CSV Parser
// ============================================================================

export function parseAmosCSV(
  content: string,
  options?: { delimiter?: string; encoding?: string }
): ParseResult {
  const warnings: string[] = [];

  // Strip BOM
  let text = content.replace(/^\uFEFF/, "");

  // Normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Auto-detect delimiter (semicolon or comma)
  const firstLine = text.split("\n")[0] || "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const delimiter = options?.delimiter || (semicolons > commas ? ";" : ",");

  if (delimiter === ";" && commas > semicolons) {
    warnings.push("Detected semicolon delimiter but file has more commas. Using semicolon as specified.");
  }

  const lines = text.split("\n").filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return { rows: [], headers: [], format: "csv", warnings: ["File has fewer than 2 lines"], rowCount: 0 };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0], delimiter).map((h) => h.trim().toUpperCase());

  // Parse data rows
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);

    if (values.length === 0 || (values.length === 1 && values[0].trim() === "")) {
      continue; // Skip empty rows
    }

    if (values.length !== headers.length) {
      warnings.push(`Row ${i + 1}: expected ${headers.length} columns, got ${values.length}. Padding/truncating.`);
    }

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] || "").trim();
    }
    rows.push(row);
  }

  return { rows, headers, format: "csv", warnings, rowCount: rows.length };
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);

  return result;
}

// ============================================================================
// XML Parser (lightweight, no external deps)
// ============================================================================

export function parseAmosXML(content: string): ParseResult {
  const warnings: string[] = [];
  const rows: Record<string, string>[] = [];

  // Strip XML declaration and namespace prefixes
  let text = content
    .replace(/<\?xml[^?]*\?>/g, "")
    .replace(/<\/?(?:amos|ns\d+):/g, (match) => match.replace(/(?:amos|ns\d+):/, ""));

  // Find the repeating record elements
  // AMOS exports use <Equipment>, <JobOrder>, <SparePart>, or <MaintenancePlan>
  const recordTags = ["Equipment", "JobOrder", "SparePart", "MaintenancePlan", "Record", "Row"];
  let recordTag = "";
  let records: string[] = [];

  for (const tag of recordTags) {
    const regex = new RegExp(`<${tag}[\\s>]`, "gi");
    if (regex.test(text)) {
      recordTag = tag;
      // Extract all record blocks
      const blockRegex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gis");
      const matches = text.matchAll(blockRegex);
      records = [...matches].map((m) => m[1]);
      break;
    }
  }

  if (records.length === 0) {
    // Try generic approach: look for repeated sibling elements
    const topLevelMatch = text.match(/<(\w+)>[\s\S]*<\/\1>/g);
    if (topLevelMatch && topLevelMatch.length > 1) {
      const tagMatch = topLevelMatch[0].match(/^<(\w+)/);
      if (tagMatch) {
        recordTag = tagMatch[1];
        const blockRegex = new RegExp(`<${recordTag}[^>]*>(.*?)</${recordTag}>`, "gis");
        records = [...text.matchAll(blockRegex)].map((m) => m[1]);
      }
    }
  }

  if (records.length === 0) {
    return { rows: [], headers: [], format: "xml", warnings: ["Could not find record elements in XML"], rowCount: 0 };
  }

  const allHeaders = new Set<string>();

  for (const record of records) {
    const row: Record<string, string> = {};

    // Extract child elements: <FIELD_NAME>value</FIELD_NAME>
    const fieldRegex = /<(\w+)(?:\s[^>]*)?>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/\1>/gs;
    for (const match of record.matchAll(fieldRegex)) {
      const fieldName = match[1].toUpperCase();
      const value = (match[2] ?? match[3] ?? "").trim();
      row[fieldName] = value;
      allHeaders.add(fieldName);
    }

    // Also extract attributes from the record element itself
    const attrRegex = /(\w+)="([^"]*)"/g;
    const recordStart = text.substring(
      text.indexOf(record) - 200,
      text.indexOf(record)
    );
    for (const attrMatch of recordStart.matchAll(attrRegex)) {
      const attrName = attrMatch[1].toUpperCase();
      if (!row[attrName]) {
        row[attrName] = attrMatch[2];
        allHeaders.add(attrName);
      }
    }

    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  return {
    rows,
    headers: [...allHeaders].sort(),
    format: "xml",
    warnings,
    rowCount: rows.length,
  };
}

// ============================================================================
// Auto-detect and parse
// ============================================================================

export function parseAmosFile(content: string, filename?: string): ParseResult {
  const ext = (filename || "").toLowerCase();

  if (ext.endsWith(".xml")) {
    return parseAmosXML(content);
  }

  if (ext.endsWith(".csv") || ext.endsWith(".tsv") || ext.endsWith(".txt")) {
    return parseAmosCSV(content);
  }

  // Auto-detect: check for XML declaration or opening tag
  if (content.trim().startsWith("<?xml") || content.trim().startsWith("<")) {
    return parseAmosXML(content);
  }

  return parseAmosCSV(content);
}
