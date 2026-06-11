/**
 * LR-2 — AMOS import golden-fixture tests.
 *
 * Pins three contracts against `tests/fixtures/imports/amos-equipment-*.csv`:
 *   1. **Valid** — happy-path import returns success with the exact
 *      row counts the fixture documents (dryRun, no DB write).
 *   2. **Malformed** — rows with missing required fields are surfaced
 *      as errors WITHOUT crashing the import; the one valid row in
 *      the mixed fixture must still come through.
 *   3. **Idempotent** — importing the same valid file twice against a
 *      throwaway tenant id results in `imported>0` on the first call
 *      and `updated>0 / imported=0` on the second call (upsert
 *      semantics). Real DB writes; teardown deletes everything the
 *      test created so it never leaks into shared dev data.
 *
 * Why these three: they're the smallest set that catches the three
 * historical failure modes — parser regression, validator regression,
 * and upsert key drift (the worst of the three, because it silently
 * duplicates equipment).
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "imports");
const VALID = readFileSync(join(FIXTURE_DIR, "amos-equipment-valid.csv"), "utf-8");
const MALFORMED = readFileSync(join(FIXTURE_DIR, "amos-equipment-malformed.csv"), "utf-8");

describe("AMOS import — golden fixtures", () => {
  it("valid fixture imports 5 rows with zero errors (dry-run)", async () => {
    const { amosImportService } = await import(
      "../../server/import-adapters/amos/import-service.js"
    );
    const result = await amosImportService.importFile(`amos-test-${randomUUID()}`, VALID, {
      type: "equipment",
      filename: "amos-equipment-valid.csv",
      dryRun: true,
    });

    expect(result.totalRows).toBe(5);
    expect(result.imported).toBe(5);
    expect(result.errors).toHaveLength(0);
    expect(result.dryRun).toBe(true);
  }, 30_000);

  it("malformed fixture surfaces row-level errors without crashing", async () => {
    const { amosImportService } = await import(
      "../../server/import-adapters/amos/import-service.js"
    );
    const result = await amosImportService.importFile(`amos-test-${randomUUID()}`, MALFORMED, {
      type: "equipment",
      filename: "amos-equipment-malformed.csv",
      dryRun: true,
    });

    // 4 rows, 3 broken (missing EQUIPMENT_NO or DESCRIPTION) + 1 valid.
    expect(result.totalRows).toBe(4);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.imported).toBe(1);
    // The errors carry a row number and a useful message — not just a
    // generic "validation failed". This is what makes the import UI
    // actionable for the operator.
    for (const e of result.errors) {
      expect(typeof e.row).toBe("number");
      expect(e.message.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it("re-importing the same fixture is idempotent (upsert, not duplicate)", async () => {
    // Real DB writes — use a tenant id that no real tenant uses, and
    // tear the data down at the end so we never leak.
    const orgId = `amos-idem-${randomUUID()}`;
    const { amosImportService } = await import(
      "../../server/import-adapters/amos/import-service.js"
    );
    const { db } = await import("../../server/db.js");
    const { equipment } = await import("../../shared/schema.js");
    const { eq } = await import("drizzle-orm");

    try {
      const first = await amosImportService.importFile(orgId, VALID, {
        type: "equipment",
        filename: "amos-equipment-valid.csv",
        dryRun: false,
      });
      expect(first.errors).toHaveLength(0);
      expect(first.imported + first.updated).toBe(5);

      const second = await amosImportService.importFile(orgId, VALID, {
        type: "equipment",
        filename: "amos-equipment-valid.csv",
        dryRun: false,
      });
      expect(second.errors).toHaveLength(0);
      // The second pass must NOT insert again — every row should be
      // a no-op update against the same primary key.
      expect(second.imported).toBe(0);
      expect(second.updated).toBe(5);
    } finally {
      await db.delete(equipment).where(eq(equipment.orgId, orgId));
    }
  }, 60_000);
});
