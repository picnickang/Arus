import { describe, test, expect } from "@jest/globals";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

describe("Dual-DB guardrail scripts", () => {
  test("validate-dual-schema.mjs passes (export guard + column parity + missing tables)", () => {
    const result = execSync("node scripts/validate-dual-schema.mjs", {
      encoding: "utf-8",
      timeout: 15000,
    });
    expect(result).toContain("All checks passed");
    expect(result).toContain("Guarded exports:");
    expect(result).toContain("Switched table pairs:");
    expect(result).toContain("New drift (blocking):  0");
    expect(result).toContain("Missing tables:        0");
  });

  test("check-storage-imports.mjs passes", () => {
    const result = execSync("node scripts/check-storage-imports.mjs", {
      encoding: "utf-8",
      timeout: 15000,
    });
    expect(result).toContain("All storage facade imports are within the allowed exception list");
  });

  test("check-schema-imports.mjs passes", () => {
    const result = execSync("node scripts/check-schema-imports.mjs", {
      encoding: "utf-8",
      timeout: 15000,
    });
    expect(result).toContain("All clear");
  });
});

describe("Schema-runtime file structural checks", () => {
  const runtimePath = join(process.cwd(), "shared", "schema-runtime.ts");
  let runtimeContent: string;

  beforeAll(() => {
    runtimeContent = readFileSync(runtimePath, "utf-8");
  });

  test("schema-runtime.ts exists and is non-empty", () => {
    expect(runtimeContent.length).toBeGreaterThan(0);
  });

  test("schema-runtime exports IS_POSTGRES guard", () => {
    expect(runtimeContent).toContain("IS_POSTGRES");
  });

  test("schema-runtime uses ternary guard pattern", () => {
    const ternaryPattern = /IS_POSTGRES\s*\?\s*\w+\s*:\s*\w+/;
    expect(ternaryPattern.test(runtimeContent)).toBe(true);
  });

  const criticalTables = [
    "vessels",
    "equipment",
    "workOrders",
    "inventoryParts",
    "crew",
    "alertConfigurations",
    "sensorConfigurations",
    "maintenanceRecords",
    "parts",
    "failurePredictions",
  ];

  test.each(criticalTables)(
    "schema-runtime exports critical table '%s'",
    (tableName) => {
      const exportPattern = new RegExp(`export\\s+const\\s+${tableName}\\s*=`);
      expect(exportPattern.test(runtimeContent)).toBe(true);
    }
  );
});

describe("PG and SQLite schema directories", () => {
  test("shared/schema/ directory has index.ts", () => {
    const content = readFileSync(
      join(process.cwd(), "shared", "schema", "index.ts"),
      "utf-8"
    );
    expect(content.length).toBeGreaterThan(0);
  });

  test("shared/sqlite-schema/ directory has index.ts", () => {
    const content = readFileSync(
      join(process.cwd(), "shared", "sqlite-schema", "index.ts"),
      "utf-8"
    );
    expect(content.length).toBeGreaterThan(0);
  });

  const criticalDomainPaths = [
    "./vessels",
    "./equipment",
    "./work-orders",
    "./crew",
    "./inventory",
  ];

  test.each(criticalDomainPaths)(
    "PG schema barrel re-exports domain '%s'",
    (domainPath) => {
      const pgIndex = readFileSync(
        join(process.cwd(), "shared", "schema", "index.ts"),
        "utf-8"
      );
      expect(pgIndex).toContain(domainPath);
    }
  );
});
