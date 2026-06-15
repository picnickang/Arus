/**
 * XLSX extractor hardening (security follow-up).
 *
 * The extractor uses `exceljs` (the `xlsx` package shipped unfixed
 * prototype-pollution / ReDoS advisories with no upstream patch and has been
 * removed). The document-ingestion extractor is the only path that parses
 * attacker-controlled spreadsheets, so it caps input size and never evaluates
 * formulas. These pins keep that hardening in place:
 *   - oversize buffers are rejected before the parser runs (ReDoS / zip-bomb bound);
 *   - clean workbooks still extract their cell text;
 *   - formula cells surface only their cached value, never the formula text;
 *   - empty workbooks raise the existing "no extractable text" error.
 */
import { describe, it, expect, jest, afterEach } from "@jest/globals";
import ExcelJS from "exceljs";

async function makeXlsx(
  rows: Array<Array<string | number>>,
  sheetName = "Sheet1"
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRows(rows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function loadExtractor() {
  const mod = await import("../../server/services/document-ingestion/extractors/xlsx");
  return mod.xlsxExtractor;
}

afterEach(() => {
  delete process.env["MAX_XLSX_INGEST_BYTES"];
  jest.resetModules();
});

describe("xlsxExtractor — hardening", () => {
  it("extracts cell text from a clean workbook", async () => {
    const extractor = await loadExtractor();
    const buf = await makeXlsx([
      ["Name", "Value"],
      ["Pump A", 42],
    ]);
    const text = await extractor.extract(buf);
    expect(text).toContain("## Sheet: Sheet1");
    expect(text).toContain("Name");
    expect(text).toContain("Pump A");
    expect(text).toContain("42");
  });

  it("rejects an oversize buffer before parsing", async () => {
    jest.resetModules();
    process.env["MAX_XLSX_INGEST_BYTES"] = "16";
    const extractor = await loadExtractor();
    const buf = await makeXlsx([["a", "b"]]);
    await expect(extractor.extract(buf)).rejects.toThrow(/too large|exceeds/i);
  });

  it("surfaces a formula cell's cached value, not the formula text", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["base", "calc"]);
    // A formula cell with a cached value. The extractor must surface the cached
    // result and never the formula expression.
    ws.getCell("A2").value = 7;
    ws.getCell("B2").value = { formula: "1+1", result: 2 };
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const extractor = await loadExtractor();
    const text = await extractor.extract(buf);
    expect(text).toContain("2"); // cached value preserved
    expect(text).not.toContain("1+1"); // formula text never surfaced
  });

  it("throws the existing error for an empty workbook", async () => {
    const extractor = await loadExtractor();
    const buf = await makeXlsx([[]]);
    await expect(extractor.extract(buf)).rejects.toThrow(/no extractable text|extraction failed/i);
  });
});
