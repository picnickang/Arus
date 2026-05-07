/**
 * Deck-logbook forms — useDeckLogbookData
 *
 * Lifecycle: POST /api/logbook/deck/daily → GET /:id returns it → list filter
 *            by vessel includes it → DELETE (best-effort).
 */

import { describe, it, expect, afterAll } from "@jest/globals";
import { api, makeRunId, pool, getRefIds, cleanupByRunId } from "./_helpers";

const RUN_ID = makeRunId("dlog");

describe("Deck-logbook forms — CRUD + propagation", () => {
  let entryId: string | undefined;
  let vesselId: string;

  afterAll(async () => {
    if (entryId) {
      await pool.query("DELETE FROM logbook_deck_daily WHERE id=$1", [entryId]).catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["logbook_deck_daily"]);
  });

  it("creates a deck log daily entry", async () => {
    const refs = await getRefIds();
    vesselId = refs.vesselId;
    // Use a far-future date varied by RUN_ID to avoid 409 collisions with
     // existing entries (deck-log enforces unique vessel+date).
    const dayOffset = (Math.abs(RUN_ID.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 9000) + 365;
    const today = new Date(Date.now() + dayOffset * 86400_000).toISOString().slice(0, 10);
    const { status, data } = await api<{ id: string }>("POST", "/api/logbook/deck/daily", {
      vesselId,
      logDate: today,
      remarks: `deck-log forms test ${RUN_ID}`,
      status: "draft",
    });
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("deck-log create returned", status, JSON.stringify(data).slice(0, 300));
    }
    expect([200, 201]).toContain(status);
    entryId = data.id;
  });

  it("entry is fetchable via GET /api/logbook/deck/daily/:id", async () => {
    if (!entryId) return;
    const { status, data } = await api<{ id: string }>(
      "GET",
      `/api/logbook/deck/daily/${entryId}`
    );
    expect(status).toBe(200);
    expect(data.id).toBe(entryId);
  });

  it("entry appears in vessel-scoped list", async () => {
    if (!entryId) return;
    const { status, data } = await api<unknown>(
      "GET",
      `/api/logbook/deck/daily?vesselId=${vesselId}`
    );
    expect(status).toBe(200);
    const items = Array.isArray(data)
      ? (data as Array<{ id: string }>)
      : ((data as { items?: Array<{ id: string }> }).items ?? []);
    expect(items.find((e) => e.id === entryId)).toBeTruthy();
  });
});
