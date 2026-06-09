import { describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { amosImportService } from "./amos/import-service";
import { shipmateImport } from "./shipmate/import-service";

const fixtureDir = join(process.cwd(), "tests", "fixtures", "imports");
const amosValidEquipment = readFileSync(join(fixtureDir, "amos-equipment-valid.csv"), "utf-8");
const amosMalformedEquipment = readFileSync(
  join(fixtureDir, "amos-equipment-malformed.csv"),
  "utf-8"
);
const shipmateValidEquipment = readFileSync(
  join(fixtureDir, "shipmate-equipment-valid.csv"),
  "utf-8"
);
const shipmateMalformedEquipment = readFileSync(
  join(fixtureDir, "shipmate-equipment-malformed.csv"),
  "utf-8"
);

const orgId = () => `coverage-import-${randomUUID()}`;

describe("AMOS import service dry-run coverage", () => {
  it("parses and validates the equipment golden fixture without database writes", async () => {
    const result = await amosImportService.importFile(orgId(), amosValidEquipment, {
      type: "equipment",
      filename: "amos-equipment-valid.csv",
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(5);
    expect(result.imported).toBe(5);
    expect(result.errors).toHaveLength(0);
    expect(result.ragDocumentsCreated).toBe(0);
    expect(result.dryRun).toBe(true);
  });

  it("surfaces malformed equipment rows while preserving valid dry-run rows", async () => {
    const result = await amosImportService.importFile(orgId(), amosMalformedEquipment, {
      type: "equipment",
      filename: "amos-equipment-malformed.csv",
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(4);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBeGreaterThanOrEqual(3);
    expect(result.errors.map((error) => error.row)).toEqual(expect.arrayContaining([2, 3, 4]));
  });

  it.each([
    [
      "work_orders" as const,
      [
        "JOB_ORDER_NO,DESCRIPTION,EQUIPMENT_NO,STATUS,MAINTENANCE_TYPE,PRIORITY,PLANNED_START_DATE,ACTUAL_HOURS,RESPONSIBLE",
        "WO-1001,Inspect purifier,ME-001,IN PROGRESS,CM,2,15/04/2026,3.5,chief-engineer",
      ].join("\n"),
    ],
    [
      "parts" as const,
      [
        "PART_NO,DESCRIPTION,CATEGORY,UOM,STANDARD_COST,MIN_STOCK,CURRENT_STOCK,LOCATION,BIN_LOCATION,UNIT_COST",
        "FLT-10,Fuel filter,Filters,ea,22.50,4,11,MAIN,A-01,22.50",
      ].join("\n"),
    ],
    [
      "maintenance_plans" as const,
      [
        "PLAN_CODE,DESCRIPTION,EQUIPMENT_NO,FREQUENCY_DAYS,MAINTENANCE_TYPE,TASK_LIST,REQUIRED_SKILLS",
        "PM-250,Quarterly purifier service,ME-001,90,PM,Inspect bowls; replace seals,engine",
      ].join("\n"),
    ],
  ])("dry-runs %s rows through the canonical AMOS mapping", async (type, csv) => {
    const result = await amosImportService.importFile(orgId(), csv, {
      type,
      filename: `amos-${type}.csv`,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe(type);
    expect(result.totalRows).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.dryRun).toBe(true);
  });

  it("returns an actionable error for files with no data rows", async () => {
    const result = await amosImportService.importFile(orgId(), "EQUIPMENT_NO,DESCRIPTION\n", {
      type: "equipment",
      filename: "empty-amos.csv",
      dryRun: true,
    });

    expect(result.success).toBe(false);
    expect(result.totalRows).toBe(0);
    expect(result.errors[0]?.message).toContain("No data rows found");
  });
});

describe("SHIPMATE import service dry-run coverage", () => {
  it("parses and validates equipment with explicit vessel scope", async () => {
    const vesselId = randomUUID();

    const result = await shipmateImport.importFile(orgId(), shipmateValidEquipment, {
      module: "pms_equipment",
      filename: "shipmate-equipment-valid.csv",
      vesselId,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(5);
    expect(result.imported).toBe(5);
    expect(result.errors).toHaveLength(0);
    expect(result.vesselResolved).toBe(vesselId);
    expect(result.hierarchyLevelsDetected).toBe(3);
    expect(result.manifestId).toBeNull();
    expect(result.dryRun).toBe(true);
  });

  it("surfaces row-level equipment errors without masking the valid row", async () => {
    const result = await shipmateImport.importFile(orgId(), shipmateMalformedEquipment, {
      module: "pms_equipment",
      filename: "shipmate-equipment-malformed.csv",
      vesselId: randomUUID(),
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(4);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBeGreaterThanOrEqual(3);
    expect(result.errors.map((error) => error.row)).toEqual(expect.arrayContaining([2, 3, 4]));
  });

  it.each([
    [
      "pms_jobs" as const,
      [
        "work order no,job name,component no,job status,maintenance type,completed date,actual hours,remarks",
        "GB-PM-001,Overhaul purifier,1.1.1,Completed,Preventive,20/05/2026,6.5,completed at sea",
      ].join("\n"),
    ],
    [
      "sps_stores" as const,
      [
        "item code,item name,group,uom,r.o.b,unit price,min stock,store location,bin,hazmat",
        "SP-101,Impeller kit,Pumps,ea,7,120.40,2,Engine Store,B-11,No",
      ].join("\n"),
    ],
    [
      "cms_crew_certs" as const,
      [
        "employee no,name,rank,certificate name,certificate no,issue date,expiry date",
        "E-001,Ana Santos,Chief Engineer,STCW III/2,CERT-1,01-Jan-2024,01-Jan-2029",
      ].join("\n"),
    ],
    [
      "cms_rest_hours" as const,
      [
        "employee no,name,rank,date,work hours,rest hours,violation,comments",
        "E-001,Ana Santos,Chief Engineer,09/06/2026,9,15,No,normal watch",
      ].join("\n"),
    ],
  ])("dry-runs %s rows after SHIPMATE header normalization", async (module, csv) => {
    const result = await shipmateImport.importFile(orgId(), csv, {
      module,
      filename: `shipmate-${module}.csv`,
      vesselId: randomUUID(),
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.module).toBe(module);
    expect(result.totalRows).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.manifestId).toBeNull();
  });

  it("returns an actionable error for empty SHIPMATE exports", async () => {
    const result = await shipmateImport.importFile(orgId(), "Component No,Component Name\n", {
      module: "pms_equipment",
      vesselId: randomUUID(),
      filename: "empty-shipmate.csv",
      dryRun: true,
    });

    expect(result.success).toBe(false);
    expect(result.totalRows).toBe(0);
    expect(result.errors[0]?.message).toContain("No data rows found");
  });
});
