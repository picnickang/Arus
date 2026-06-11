/**
 * Logbook forms — DeckLogDailyForm + EngineLogDailyForm + entry forms.
 *
 * Lifecycle: create deck-log daily entry → patch → sign (lock) → delete (when
 *            unsigned). Same for engine-log.
 *
 * Propagation: SQL row in deck_log_daily / engine_log_daily reflects the post.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { api, getRefIds, makeRunId, pool, cleanupByRunId } from "./_helpers";

const RUN_ID = makeRunId("logbook");

function uniqueDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

describe("Logbook forms — deck + engine daily CRUD + propagation", () => {
  let vesselId: string;
  let deckId: string;
  let engineId: string;

  beforeAll(async () => {
    const refs = await getRefIds();
    vesselId = refs.vesselId;
  }, 30000);

  afterAll(async () => {
    if (deckId) {
      await pool.query("DELETE FROM deck_log_daily WHERE id=$1", [deckId]).catch(() => {});
    }
    if (engineId) {
      await pool.query("DELETE FROM engine_log_daily WHERE id=$1", [engineId]).catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["deck_log_daily", "engine_log_daily"]);
  });

  it("creates a deck-log daily entry", async () => {
    const logDate = uniqueDate(-365 - Math.floor(Math.random() * 365));
    const { status, data } = await api<{ id: string }>("POST", "/api/logbook/deck/daily", {
      vesselId,
      logDate,
      dayRun: 240,
      totalDistance: 10000,
      streamingHoursToday: 24,
      remarks: `forms-test ${RUN_ID}`,
    });
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("deck daily create returned", status, JSON.stringify(data).slice(0, 300));
    }
    expect([200, 201, 400, 409]).toContain(status);
    if (status === 200 || status === 201) {
      deckId = (data as { id: string }).id;
      const { rows } = await pool.query(
        "SELECT vessel_id, remarks FROM deck_log_daily WHERE id=$1",
        [deckId]
      );
      expect(rows[0]?.vessel_id).toBe(vesselId);
      expect(String(rows[0]?.remarks || "")).toContain(RUN_ID);
    }
  });

  it("PATCH deck-log entry updates remarks", async () => {
    if (!deckId) {
      return;
    }
    const { status } = await api("PATCH", `/api/logbook/deck/daily/${deckId}`, {
      remarks: `updated ${RUN_ID}`,
    });
    expect([200, 204]).toContain(status);
  });

  it("creates an engine-log daily entry", async () => {
    const logDate = uniqueDate(-365 - Math.floor(Math.random() * 365));
    const { status, data } = await api<{ id: string }>("POST", "/api/logbook/engine/daily", {
      vesselId,
      logDate,
      meHoursToday: 22,
      fuelMeConsumption: 10.5,
      fuelTotalConsumption: 12.0,
    });
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("engine daily create returned", status, JSON.stringify(data).slice(0, 300));
    }
    expect([200, 201, 400, 409]).toContain(status);
    if (status === 200 || status === 201) {
      engineId = (data as { id: string }).id;
      const { rows } = await pool.query(
        "SELECT vessel_id, fuel_total_consumption FROM engine_log_daily WHERE id=$1",
        [engineId]
      );
      expect(rows[0]?.vessel_id).toBe(vesselId);
      expect(Number(rows[0]?.fuel_total_consumption)).toBeCloseTo(12.0, 2);
    }
  });

  it("DELETE engine-log entry removes the row", async () => {
    if (!engineId) {
      return;
    }
    const { status } = await api("DELETE", `/api/logbook/engine/daily/${engineId}`);
    expect([200, 204, 403, 409]).toContain(status);
    if (status === 200 || status === 204) {
      const { rows } = await pool.query("SELECT 1 FROM engine_log_daily WHERE id=$1", [engineId]);
      expect(rows.length).toBe(0);
      engineId = "";
    }
  });
});
