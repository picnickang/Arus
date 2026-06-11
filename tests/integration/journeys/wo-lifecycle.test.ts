/**
 * Journey: full Work-Order lifecycle ties together equipment, work-orders,
 * structured closeout (WO completions), and downtime aggregation on the WO row.
 *
 *   1. Create equipment under an existing vessel.
 *   2. Create a WO against that equipment.
 *   3. Complete the WO with a structured closeout payload.
 *   4. Assert work_order_completions captured the closeout (DB).
 *   5. Assert work_orders.status flipped to 'completed' and downtime aggregated.
 *   6. Assert /api/work-orders list reflects the completed status.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { api, getRefIds, makeRunId, pool, cleanupByRunId } from "../forms/_helpers";

const RUN_ID = makeRunId("j-wo-lifecycle");

describe("Journey — WO lifecycle (create → complete-with-feedback → propagation)", () => {
  let vesselId: string;
  let equipmentId: string;
  let woId: string;

  beforeAll(async () => {
    const refs = await getRefIds();
    vesselId = refs.vesselId;
  }, 30000);

  afterAll(async () => {
    if (woId) {
      await pool
        .query("DELETE FROM work_order_completions WHERE work_order_id=$1", [woId])
        .catch(() => {});
      await pool.query("DELETE FROM work_orders WHERE id=$1", [woId]).catch(() => {});
    }
    if (equipmentId) {
      await pool
        .query("DELETE FROM equipment_decommission_events WHERE equipment_id=$1", [equipmentId])
        .catch(() => {});
      await pool.query("DELETE FROM equipment WHERE id=$1", [equipmentId]).catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["equipment", "work_orders", "work_order_completions"]);
  });

  it("creates equipment for the journey", async () => {
    const r = await api<{ id: string }>("POST", "/api/equipment", {
      name: `Journey Pump ${RUN_ID}`,
      type: "pump",
      vesselId,
      criticalityLevel: "high",
      systemType: "fluid_systems",
    });
    expect([200, 201]).toContain(r.status);
    equipmentId = r.data.id;
  });

  it("creates a WO against that equipment", async () => {
    const r = await api<{ id: string; equipmentId: string }>("POST", "/api/work-orders", {
      equipmentId,
      vesselId,
      description: `Journey WO ${RUN_ID}`,
      status: "open",
      priority: 2,
      maintenanceType: "preventive",
      reason: `journey ${RUN_ID}`,
    });
    expect([200, 201]).toContain(r.status);
    expect(r.data.equipmentId).toBe(equipmentId);
    woId = r.data.id;
  });

  it("completes the WO with structured closeout and propagates", async () => {
    const closeout = {
      workPerformed: `replaced impeller ${RUN_ID}`,
      causeFound: "wear",
      laborHours: 2.5,
      downtimeHours: 1.0,
      partsUsed: "impeller x1",
      checklistVerified: true,
      supervisorVerified: true,
    };
    const r = await api("POST", `/api/work-orders/${woId}/complete-with-feedback`, {
      completionNotes: `journey closeout ${RUN_ID}`,
      actualHours: 2.5,
      actualDowntimeHours: 1.0,
      closeout,
    });
    expect(r.status).toBe(200);

    // 1) work_order_completions captured the structured payload
    const { rows: completions } = await pool.query(
      `SELECT completion_notes, actual_duration_hours, actual_downtime_hours, parts_count
         FROM work_order_completions WHERE work_order_id=$1
         ORDER BY completed_at DESC LIMIT 1`,
      [woId]
    );
    expect(completions.length).toBe(1);
    expect(String(completions[0].completion_notes)).toContain(RUN_ID);
    expect(String(completions[0].completion_notes)).toContain("Work performed");
    expect(Number(completions[0].actual_duration_hours)).toBe(2.5);
    expect(Number(completions[0].actual_downtime_hours)).toBe(1.0);

    // 2) work_orders row flipped to completed + downtime aggregated
    const { rows: woRows } = await pool.query(
      `SELECT status, actual_downtime_hours FROM work_orders WHERE id=$1`,
      [woId]
    );
    expect(woRows[0].status).toBe("completed");
    expect(Number(woRows[0].actual_downtime_hours)).toBeGreaterThan(0);

    // 3) /api/work-orders list shows it as completed
    const list = await api<unknown>("GET", `/api/work-orders?status=completed`);
    expect(list.status).toBe(200);
    const items = Array.isArray(list.data)
      ? (list.data as Array<{ id: string; status: string }>)
      : ((list.data as { items?: Array<{ id: string }> }).items ?? []);
    expect(items.find((w) => w.id === woId)).toBeTruthy();
  });
});
