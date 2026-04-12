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
    expect(result).toContain("storage facade imports eliminated");
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

describe("PG query shape smoke tests — critical domain paths", () => {
  const fs = require("fs");
  const tmpDir = join(process.cwd(), "tests", "unit");

  function queryTable(tableName: string): { ok: boolean; count: number; keys: string[] } {
    const scriptFile = join(tmpDir, `_query_${tableName}.ts`);
    const scriptContent = [
      `import { db } from '../../server/db-config';`,
      `import { ${tableName} } from '../../shared/schema-runtime';`,
      `(async () => {`,
      `  try {`,
      `    const r = await db.select().from(${tableName}).limit(1);`,
      `    console.log(JSON.stringify({ ok: true, count: r.length, keys: r.length > 0 ? Object.keys(r[0]) : [] }));`,
      `  } catch(e) { const msg = e instanceof Error ? e.message : String(e); console.log(JSON.stringify({ ok: false, count: 0, keys: [], error: msg })); }`,
      `  process.exit(0);`,
      `})();`,
    ].join('\n');
    fs.writeFileSync(scriptFile, scriptContent);
    try {
      const result = execSync(`npx tsx ${scriptFile}`, { encoding: "utf-8", timeout: 30000, cwd: process.cwd() });
      const lines = result.trim().split("\n");
      return JSON.parse(lines[lines.length - 1]);
    } finally {
      try { fs.unlinkSync(scriptFile); } catch {}
    }
  }

  test("vessels table is queryable and returns expected columns", () => {
    const parsed = queryTable("vessels");
    expect(parsed.ok).toBe(true);
    if (parsed.count > 0) {
      expect(parsed.keys).toContain("id");
      expect(parsed.keys).toContain("name");
      expect(parsed.keys).toContain("orgId");
    }
  });

  test("equipment table is queryable and returns expected columns", () => {
    const parsed = queryTable("equipment");
    expect(parsed.ok).toBe(true);
    if (parsed.count > 0) {
      expect(parsed.keys).toContain("id");
      expect(parsed.keys).toContain("name");
      expect(parsed.keys).toContain("orgId");
    }
  });

  test("workOrders table is queryable and returns expected columns", () => {
    const parsed = queryTable("workOrders");
    expect(parsed.ok).toBe(true);
    if (parsed.count > 0) {
      expect(parsed.keys).toContain("id");
      expect(parsed.keys).toContain("orgId");
      expect(parsed.keys).toContain("status");
    }
  });

  test("inventoryParts table is queryable and returns expected columns", () => {
    const parsed = queryTable("inventoryParts");
    expect(parsed.ok).toBe(true);
    if (parsed.count > 0) {
      expect(parsed.keys).toContain("id");
      expect(parsed.keys).toContain("orgId");
    }
  });

  test("crew table is queryable and returns expected columns", () => {
    const parsed = queryTable("crew");
    expect(parsed.ok).toBe(true);
    if (parsed.count > 0) {
      expect(parsed.keys).toContain("id");
      expect(parsed.keys).toContain("orgId");
    }
  });
});

describe("SQLite schema structural parity", () => {
  const criticalColumnChecks = [
    { table: "vessels", pgFile: "shared/schema/vessels.ts", sqliteFile: "shared/sqlite-schema/core.ts", fields: ["orgId", "name", "imo"] },
    { table: "equipment", pgFile: "shared/schema/equipment.ts", sqliteFile: "shared/sqlite-schema/core.ts", fields: ["orgId", "name", "vesselId"] },
    { table: "workOrders", pgFile: "shared/schema/work-orders.ts", sqliteFile: "shared/sqlite-schema/work-orders.ts", fields: ["orgId", "priority"] },
  ];

  test.each(criticalColumnChecks)(
    "$table Drizzle fields exist in both PG and SQLite definitions",
    ({ pgFile, sqliteFile, fields }) => {
      const pgContent = readFileSync(join(process.cwd(), pgFile), "utf-8");
      const sqliteContent = readFileSync(join(process.cwd(), sqliteFile), "utf-8");
      for (const field of fields) {
        const fieldPattern = new RegExp(`\\b${field}\\s*:`);
        if (fieldPattern.test(pgContent)) {
          expect(fieldPattern.test(sqliteContent)).toBe(true);
        }
      }
    }
  );

  test("schema-runtime has sufficient ternary guards (>=40)", () => {
    const runtimeContent = readFileSync(join(process.cwd(), "shared", "schema-runtime.ts"), "utf-8");
    const ternaryMatches = runtimeContent.match(/IS_POSTGRES\s*\?/g) ?? [];
    expect(ternaryMatches.length).toBeGreaterThanOrEqual(40);
  });

  test("PG and SQLite schemas both export critical shared domain modules", () => {
    const pgContent = readFileSync(join(process.cwd(), "shared", "schema", "index.ts"), "utf-8");
    const sqliteContent = readFileSync(join(process.cwd(), "shared", "sqlite-schema", "index.ts"), "utf-8");
    const sharedDomains = ["work-orders", "inventory", "crew"];
    for (const domain of sharedDomains) {
      expect(pgContent).toContain(`./${domain}`);
      expect(sqliteContent).toContain(`./${domain}`);
    }
  });

  test("critical PG tables have matching SQLite column definitions (>=100 pairs)", () => {
    const result = execSync("node scripts/validate-dual-schema.mjs", { encoding: "utf-8", timeout: 15000 });
    const pairsMatch = result.match(/Pairs with columns:\s+(\d+)/);
    expect(pairsMatch).not.toBeNull();
    const pairCount = parseInt((pairsMatch ?? ["", "0"])[1], 10);
    expect(pairCount).toBeGreaterThanOrEqual(100);
  });

  test("no new schema drift beyond known allowlist", () => {
    const result = execSync("node scripts/validate-dual-schema.mjs", { encoding: "utf-8", timeout: 15000 });
    expect(result).toContain("New drift (blocking):  0");
    expect(result).toContain("Missing tables:        0");
  });

  test("drift count must never increase (monotonic guard)", () => {
    const result = execSync("node scripts/validate-dual-schema.mjs", { encoding: "utf-8", timeout: 15000 });
    const knownMatch = result.match(/Known drift \(allowed\):\s+(\d+)/);
    const knownCount = parseInt((knownMatch ?? ["", "999"])[1], 10);
    expect(knownCount).toBeLessThanOrEqual(116);
  });
});

describe("SQLite mode import resolution", () => {
  const fs = require("fs");
  const tmpDir = join(process.cwd(), "tests", "unit");

  function verifyLocalModeImports(tableName: string): { ok: boolean; hasTable: boolean } {
    const scriptFile = join(tmpDir, `_sqlite_check_${tableName}.ts`);
    const scriptContent = [
      `import { ${tableName} } from '../../shared/schema-runtime';`,
      `const hasTable = !!${tableName};`,
      `console.log(JSON.stringify({ ok: true, hasTable }));`,
    ].join('\n');
    fs.writeFileSync(scriptFile, scriptContent);
    try {
      const result = execSync(
        `LOCAL_MODE=true npx tsx ${scriptFile}`,
        { encoding: "utf-8", timeout: 30000, cwd: process.cwd() }
      );
      const lines = result.trim().split("\n");
      return JSON.parse(lines[lines.length - 1]);
    } finally {
      try { fs.unlinkSync(scriptFile); } catch {}
    }
  }

  const criticalTables = ["vessels", "equipment", "workOrders", "inventoryParts", "crew"];

  test.each(criticalTables)(
    "%s table resolves in LOCAL_MODE (SQLite mode)",
    (tableName) => {
      const parsed = verifyLocalModeImports(tableName);
      expect(parsed.ok).toBe(true);
      expect(parsed.hasTable).toBe(true);
    }
  );
});

describe("Additional guardrail scripts", () => {
  test("check:route-registration guard passes", () => {
    const result = execSync("node scripts/check-route-registration.mjs", { encoding: "utf-8", timeout: 15000 });
    expect(result).toContain("All route registrations follow the domain router registry pattern");
  });

  test("check:domain-boundaries guard passes", () => {
    const result = execSync("node scripts/check-domain-boundaries.mjs", { encoding: "utf-8", timeout: 15000 });
    expect(result).toContain("Domain boundary check passed");
  });
});
