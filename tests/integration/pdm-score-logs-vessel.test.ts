/**
 * pdm_score_logs schema reconciliation — vessel/embedded read path.
 *
 * pdm_score_logs was cloud-only (undefined in the runtime schema under vessel
 * mode) AND its physical SQLite DDL diverged from the PG shape
 * (score/computed_at vs health_idx/p_fail_30d/predicted_due_date/ts). After
 * reconciliation it is a dual-mode pickSchema table with the canonical columns,
 * the fresh DDL matches, and a compatibility migration recreates legacy tables.
 * So DatabaseDevicesStorage.getPdmScores now reads it in embedded mode instead
 * of dereferencing an undefined table.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";

import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { dbDevicesStorage } from "../../server/db/devices";

const ORG_ID = DEFAULT_ORG_ID;
const EQUIP_ID = `psl-${randomUUID().slice(0, 8)}`;

let client: Client;

beforeAll(async () => {
  const { libsqlClient } = await import("../../server/db-config.js");
  if (!libsqlClient) {
    throw new Error("Embedded SQLite client unavailable — run via the embedded integration lane.");
  }
  client = libsqlClient;
  // Seed a score row using the canonical columns the migration guarantees exist.
  await client.execute({
    sql: "INSERT INTO pdm_score_logs (id, org_id, equipment_id, ts, health_idx, p_fail_30d) VALUES (?, ?, ?, ?, ?, ?)",
    args: [randomUUID(), ORG_ID, EQUIP_ID, Math.floor(Date.now() / 1000), 25, 0.8],
  });
});

afterAll(async () => {
  try {
    await client?.execute({
      sql: "DELETE FROM pdm_score_logs WHERE equipment_id = ?",
      args: [EQUIP_ID],
    });
  } catch {
    // best-effort cleanup
  }
});

describe("pdm_score_logs reconciliation (vessel/embedded)", () => {
  it("getPdmScores reads the reconciled canonical columns instead of 500ing", async () => {
    const rows = await dbDevicesStorage.getPdmScores(EQUIP_ID);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(Number(rows[0]!.healthIdx)).toBe(25);
    expect(Number(rows[0]!.pFail30d)).toBeCloseTo(0.8, 5);
  });
});
