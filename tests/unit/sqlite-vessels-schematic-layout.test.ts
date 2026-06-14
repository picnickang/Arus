/**
 * Regression: the embedded SQLite `vessels` bootstrap DDL
 * (server/sqlite/vessel-tables.ts) must include `schematic_layout`.
 *
 * That column exists in both the PG schema and the drizzle SQLite schema, so
 * the runtime INSERT is generated with it — but the hand-written CREATE TABLE
 * omitted it, so every vessel insert in embedded / VESSEL / desktop mode failed
 * with "table vessels has no column named schematic_layout" (HTTP 500). The
 * dual-schema validator never caught it because it diffs the two drizzle
 * schemas, not this bootstrap DDL.
 */
import { describe, it, expect } from "@jest/globals";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getVesselTablesSql } from "../../server/sqlite/vessel-tables";

describe("SQLite vessels bootstrap DDL", () => {
  it("creates a vessels table with schematic_layout and accepts an insert that sets it", async () => {
    const client = createClient({ url: ":memory:" });
    const db = drizzle(client);

    for (const stmt of getVesselTablesSql()) {
      await db.run(stmt);
    }

    const info = await client.execute("PRAGMA table_info(vessels)");
    const cols = info.rows.map((r) => String(r["name"]));
    expect(cols).toContain("schematic_layout");

    // Reproduces the exact production failure path: an insert that sets
    // schematic_layout throws if the column is missing from the DDL.
    await client.execute({
      sql: "INSERT INTO vessels (id, org_id, name, schematic_layout, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        "v1",
        "default-org-id",
        "Test Vessel",
        JSON.stringify({ zones: [] }),
        Date.now(),
        Date.now(),
      ],
    });

    const row = await client.execute("SELECT schematic_layout FROM vessels WHERE id = 'v1'");
    expect(row.rows.length).toBe(1);
    expect(String(row.rows[0]?.["schematic_layout"])).toContain("zones");
  });
});
