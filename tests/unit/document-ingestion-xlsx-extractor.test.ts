/**
 * XLSX extractor hardening (security follow-up).
 *
 * `xlsx` ships unfixed prototype-pollution / ReDoS advisories with no upstream
 * patch. The document-ingestion extractor is the only path that parses
 * attacker-controlled spreadsheets, so it caps input size and disables
 * formula/HTML/VBA parsing. These pins keep that hardening in place:
 *   - oversize buffers are rejected before the parser runs (ReDoS / zip-bomb bound);
 *   - clean workbooks still extract their cell text;
 *   - formula cells surface only their cached value, never the formula text;
 *   - empty workbooks raise the existing "no extractable text" error.
 */
import { describe, it, expect, jest, afterEach } from "@jest/globals";
import * as XLSX from "xlsx";

function makeXlsx(rows: Array<Array<string | number>>, sheetName = "Sheet1"): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
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
    const buf = makeXlsx([
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
    const buf = makeXlsx([["a", "b"]]);
    await expect(extractor.extract(buf)).rejects.toThrow(/too large|exceeds/i);
  });

  it("surfaces a formula cell's cached value, not the formula text", async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["base", "calc"]]);
    // A formula cell with a cached value. With cellFormula:false on read, the
    // formula string must not appear; the cached value still does.
    ws["B2"] = { t: "n", f: "1+1", v: 2 };
    ws["A2"] = { t: "n", v: 7 };
    ws["!ref"] = "A1:B2";
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const extractor = await loadExtractor();
    const text = await extractor.extract(buf);
    expect(text).toContain("2"); // cached value preserved
    expect(text).not.toContain("1+1"); // formula text never surfaced
  });

  it("throws the existing error for an empty workbook", async () => {
    const extractor = await loadExtractor();
    const buf = makeXlsx([[]]);
    await expect(extractor.extract(buf)).rejects.toThrow(/no extractable text|extraction failed/i);
  });
});
