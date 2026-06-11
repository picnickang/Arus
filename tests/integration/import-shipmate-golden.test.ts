/**
 * LR-2 — SHIPMATE import golden-fixture tests.
 *
 * Mirrors `import-amos-golden.test.ts` for the SHIPMATE adapter.
 * Same three contracts: valid → success, malformed → row-level errors,
 * re-import → upsert (not duplicate). Vessel resolution is bypassed by
 * passing an explicit `vesselId` so the test does not depend on the
 * vessels table containing a row named "SHIPMATE-FIXT-001".
 *
 * Idempotency test uses a freshly-generated `orgId` + `vesselId` and
 * cleans them up in `finally` so it never leaks into dev data.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "imports");
const VALID = readFileSync(join(FIXTURE_DIR, "shipmate-equipment-valid.csv"), "utf-8");
const MALFORMED = readFileSync(join(FIXTURE_DIR, "shipmate-equipment-malformed.csv"), "utf-8");
const SHIPMATE_DIR = join(process.cwd(), "server", "import-adapters", "shipmate");

describe("SHIPMATE import — golden fixtures", () => {
  it("keeps import-service as an orchestration shell over internal modules", () => {
    const service = readFileSync(join(SHIPMATE_DIR, "import-service.ts"), "utf-8");
    const types = readFileSync(join(SHIPMATE_DIR, "types.ts"), "utf-8");
    const resolver = readFileSync(join(SHIPMATE_DIR, "vessel-resolver.ts"), "utf-8");
    const upserts = readFileSync(join(SHIPMATE_DIR, "row-upserts.ts"), "utf-8");
    const rag = readFileSync(join(SHIPMATE_DIR, "rag-docs.ts"), "utf-8");

    expect(service).toContain('from "./types"');
    expect(service).toContain('from "./vessel-resolver"');
    expect(service).toContain('from "./row-upserts"');
    expect(service).toContain('from "./rag-docs"');
    expect(service).toContain('export { VesselResolutionError } from "./types"');
    expect(types).toContain("export interface ShipmateImportOptions");
    expect(resolver).toContain("export async function resolveVesselId");
    expect(upserts).toContain("export async function upsertShipmateRow");
    expect(rag).toContain("export async function feedShipmateRowsToRag");
  });

  it("valid fixture imports 5 rows with zero errors (dry-run)", async () => {
    const { shipmateImport } = await import(
      "../../server/import-adapters/shipmate/import-service.js"
    );
    const result = await shipmateImport.importFile(`shipmate-test-${randomUUID()}`, VALID, {
      module: "pms_equipment",
      filename: "shipmate-equipment-valid.csv",
      vesselId: randomUUID(), // bypass vessel-name lookup
      dryRun: true,
    });

    expect(result.totalRows).toBe(5);
    expect(result.imported).toBe(5);
    expect(result.errors).toHaveLength(0);
    expect(result.dryRun).toBe(true);
  }, 30_000);

  it("malformed fixture surfaces row-level errors without crashing", async () => {
    const { shipmateImport } = await import(
      "../../server/import-adapters/shipmate/import-service.js"
    );
    const result = await shipmateImport.importFile(`shipmate-test-${randomUUID()}`, MALFORMED, {
      module: "pms_equipment",
      filename: "shipmate-equipment-malformed.csv",
      vesselId: randomUUID(),
      dryRun: true,
    });

    expect(result.totalRows).toBe(4);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.imported).toBe(1);
    for (const e of result.errors) {
      expect(typeof e.row).toBe("number");
      expect(e.message.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it("re-importing the same fixture is idempotent (upsert, not duplicate)", async () => {
    const orgId = `shipmate-idem-${randomUUID()}`;
    const vesselId = randomUUID();
    const { shipmateImport } = await import(
      "../../server/import-adapters/shipmate/import-service.js"
    );
    const { db } = await import("../../server/db.js");
    const { equipment, importManifest } = await import("../../shared/schema.js");
    const { eq } = await import("drizzle-orm");

    try {
      const first = await shipmateImport.importFile(orgId, VALID, {
        module: "pms_equipment",
        filename: "shipmate-equipment-valid.csv",
        vesselId,
        dryRun: false,
      });
      expect(first.errors).toHaveLength(0);
      expect(first.imported + first.updated).toBe(5);

      const second = await shipmateImport.importFile(orgId, VALID, {
        module: "pms_equipment",
        filename: "shipmate-equipment-valid.csv",
        vesselId,
        dryRun: false,
      });
      expect(second.errors).toHaveLength(0);
      expect(second.imported).toBe(0);
      expect(second.updated).toBe(5);
    } finally {
      await db.delete(equipment).where(eq(equipment.orgId, orgId));
      await db.delete(importManifest).where(eq(importManifest.orgId, orgId));
    }
  }, 180_000);
});
