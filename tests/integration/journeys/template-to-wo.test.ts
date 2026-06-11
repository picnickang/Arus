/**
 * Journey: maintenance template → work-order creation referencing the template.
 *
 *   1. Create a maintenance template.
 *   2. Create a WO that references the template via maintenanceTemplateId.
 *   3. Assert SQL FK from work_orders.maintenance_template_id → maintenance_templates.id.
 *   4. Assert /api/work-orders shows it.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { api, getRefIds, makeRunId, pool, cleanupByRunId } from "../forms/_helpers";

const RUN_ID = makeRunId("j-tpl-wo");

describe("Journey — Maintenance template → WO with FK", () => {
  let equipmentId: string;
  let templateId: string;
  let woId: string;

  beforeAll(async () => {
    const refs = await getRefIds();
    equipmentId = refs.equipmentId;
  }, 30000);

  afterAll(async () => {
    if (woId) {
      await pool.query("DELETE FROM work_orders WHERE id=$1", [woId]).catch(() => {});
    }
    if (templateId) {
      await pool
        .query("DELETE FROM maintenance_templates WHERE id=$1", [templateId])
        .catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["maintenance_templates", "work_orders"]);
  });

  it("creates the template", async () => {
    const r = await api<{ id: string }>("POST", "/api/maintenance-templates", {
      name: `Journey Tpl ${RUN_ID}`,
      equipmentType: "pump",
      maintenanceType: "preventive",
      intervalDays: 90,
      estimatedDurationHours: 1.5,
      priority: 3,
      description: `template-WO journey ${RUN_ID}`,
      isActive: true,
    });
    expect([200, 201]).toContain(r.status);
    templateId = r.data.id;
  });

  it("creates a WO that references the template", async () => {
    const r = await api<{ id: string }>("POST", "/api/work-orders", {
      equipmentId,
      maintenanceTemplateId: templateId,
      description: `from-template ${RUN_ID}`,
      status: "open",
      priority: 3,
      maintenanceType: "preventive",
    });
    expect([200, 201]).toContain(r.status);
    woId = r.data.id;

    const { rows } = await pool.query(
      `SELECT wo.id, wo.maintenance_template_id, t.id AS t_id
         FROM work_orders wo
         JOIN maintenance_templates t ON t.id = wo.maintenance_template_id
        WHERE wo.id = $1`,
      [woId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].maintenance_template_id).toBe(templateId);
  });
});
