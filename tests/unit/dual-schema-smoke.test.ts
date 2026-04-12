import { describe, test, expect, afterAll } from "@jest/globals";
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

describe("Dual-mode query shape smoke tests", () => {
  const runtimePath = join(process.cwd(), "shared", "schema-runtime.ts");
  const runtimeContent = readFileSync(runtimePath, "utf-8");

  const pgSchemaPath = join(process.cwd(), "shared", "schema", "index.ts");
  const sqliteSchemaPath = join(process.cwd(), "shared", "sqlite-schema", "index.ts");
  const pgContent = readFileSync(pgSchemaPath, "utf-8");
  const sqliteContent = readFileSync(sqliteSchemaPath, "utf-8");

  const criticalTables = [
    { table: "vessels", pgDomain: "vessels", sqliteDomain: "core" },
    { table: "equipment", pgDomain: "equipment", sqliteDomain: "core" },
    { table: "workOrders", pgDomain: "work-orders", sqliteDomain: "work-orders" },
    { table: "inventoryParts", pgDomain: "inventory", sqliteDomain: "inventory" },
    { table: "parts", pgDomain: "inventory", sqliteDomain: "inventory" },
    { table: "crew", pgDomain: "crew", sqliteDomain: "crew" },
  ];

  test.each(criticalTables)(
    "table '$table' exported from schema-runtime with PG='$pgDomain' and SQLite='$sqliteDomain'",
    ({ table, pgDomain, sqliteDomain }) => {
      expect(pgContent).toContain(`./${pgDomain}`);
      expect(sqliteContent).toContain(`./${sqliteDomain}`);
      const exportRe = new RegExp(`export\\s+const\\s+${table}\\s*=`);
      expect(exportRe.test(runtimeContent)).toBe(true);
    }
  );

  test("schema-runtime ternary guards produce valid table references", () => {
    const ternaryMatches = runtimeContent.match(/IS_POSTGRES\s*\?/g);
    expect(ternaryMatches).not.toBeNull();
    expect(ternaryMatches!.length).toBeGreaterThanOrEqual(40);
  });

  test("PG and SQLite schemas both export critical shared domain modules", () => {
    const sharedDomains = ["work-orders", "inventory", "crew"];
    for (const domain of sharedDomains) {
      expect(pgContent).toContain(`./${domain}`);
      expect(sqliteContent).toContain(`./${domain}`);
    }
  });

  test("critical PG tables have matching SQLite column definitions", () => {
    const result = execSync("node scripts/validate-dual-schema.mjs", {
      encoding: "utf-8",
      timeout: 15000,
    });
    const pairsMatch = result.match(/Pairs with columns:\s+(\d+)/);
    expect(pairsMatch).not.toBeNull();
    const pairCount = parseInt(pairsMatch![1], 10);
    expect(pairCount).toBeGreaterThanOrEqual(100);
  });

  test("no new schema drift beyond known allowlist", () => {
    const result = execSync("node scripts/validate-dual-schema.mjs", {
      encoding: "utf-8",
      timeout: 15000,
    });
    expect(result).toContain("New drift (blocking):  0");
    expect(result).toContain("Missing tables:        0");
  });

  test("check:route-registration guard passes", () => {
    const result = execSync("node scripts/check-route-registration.mjs", {
      encoding: "utf-8",
      timeout: 15000,
    });
    expect(result).toContain("All route registrations follow the domain router registry pattern");
  });

  test("check:domain-boundaries guard passes", () => {
    const result = execSync("node scripts/check-domain-boundaries.mjs", {
      encoding: "utf-8",
      timeout: 15000,
    });
    expect(result).toContain("Domain boundary check passed");
  });
});
