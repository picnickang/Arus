/**
 * Shift forms — useShiftPlanning
 *
 * Lifecycle: POST /api/shifts (template) → GET list contains it → PUT updates
 *            it → DELETE removes it.
 */

import { describe, it, expect, afterAll } from "@jest/globals";
import { api, makeRunId, pool, getRefIds, cleanupByRunId, expectInList } from "./_helpers";

const RUN_ID = makeRunId("shift");

describe("Shift forms — CRUD + propagation", () => {
  let shiftId: string | undefined;

  afterAll(async () => {
    if (shiftId) {
      await pool.query("DELETE FROM shift_templates WHERE id=$1", [shiftId]).catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["shift_templates"]);
  });

  it("creates a shift template", async () => {
    const refs = await getRefIds();
    const { status, data } = await api<{ id: string }>("POST", "/api/shifts", {
      vesselId: refs.vesselId,
      role: `qa-role-${RUN_ID}`.slice(0, 32),
      start: "08:00",
      end: "20:00",
      durationH: 12,
    });
    expect([200, 201]).toContain(status);
    shiftId = data.id;
  });

  it("shift appears in GET /api/shifts", async () => {
    if (!shiftId) {
      return;
    }
    await expectInList<{ id: string }>(
      "/api/shifts",
      (s) => s.id === shiftId,
      "new shift not in /api/shifts"
    );
  });

  it("PUT updates the shift", async () => {
    if (!shiftId) {
      return;
    }
    const { status } = await api("PUT", `/api/shifts/${shiftId}`, {
      role: `qa-updated-${RUN_ID}`.slice(0, 32),
      start: "06:00",
      end: "18:00",
      durationH: 12,
    });
    expect([200, 204]).toContain(status);
  });

  it("DELETE removes the shift", async () => {
    if (!shiftId) {
      return;
    }
    const { status } = await api("DELETE", `/api/shifts/${shiftId}`);
    expect([200, 204]).toContain(status);
    shiftId = undefined;
  });
});
