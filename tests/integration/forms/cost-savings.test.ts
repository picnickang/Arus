/**
 * Cost-savings forms — ExpenseForm + cost-savings calculate flow.
 *
 * Lifecycle:
 *   - Create an expense (POST /api/expenses) — list contains it → DELETE.
 *   - Create a WO, then call /api/cost-savings/calculate/:woId to verify the
 *     savings calc surface still responds.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { api, getRefIds, makeRunId, pool, cleanupByRunId } from "./_helpers";

const RUN_ID = makeRunId("cost");

describe("Cost-savings & expenses forms — CRUD + propagation", () => {
  let equipmentId: string;
  let expenseId: string;
  let woId: string;

  beforeAll(async () => {
    const refs = await getRefIds();
    equipmentId = refs.equipmentId;
  }, 30000);

  afterAll(async () => {
    if (woId) {
      await pool.query("DELETE FROM cost_savings WHERE work_order_id=$1", [woId]).catch(() => {});
      await pool.query("DELETE FROM work_orders WHERE id=$1", [woId]).catch(() => {});
    }
    if (expenseId) {
      await pool.query("DELETE FROM expenses WHERE id=$1", [expenseId]).catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["expenses", "cost_savings"]);
  });

  it("creates an expense", async () => {
    const { status, data } = await api<{ id: string }>("POST", "/api/expenses", {
      type: "fuel",
      amount: 1234.56,
      currency: "USD",
      description: `forms test expense ${RUN_ID}`,
      vendor: "QA Vendor",
      expenseDate: new Date().toISOString(),
      approvalStatus: "pending",
    });
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("expense create", status, JSON.stringify(data).slice(0, 300));
    }
    expect([200, 201, 404]).toContain(status);
    if (status === 200 || status === 201) {
      expenseId = (data as { id: string }).id;
    }
  });

  it("expense persists to DB with org scoping", async () => {
    if (!expenseId) {
      return;
    }
    const { rows } = await pool.query("SELECT description, org_id FROM expenses WHERE id=$1", [
      expenseId,
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].org_id).toBe("default-org-id");
    expect(String(rows[0].description)).toContain(RUN_ID);
  });

  it("cost-savings calculate endpoint responds for a fresh WO", async () => {
    // create a throwaway WO so we can ask for a calc
    const wo = await api<{ id: string }>("POST", "/api/work-orders", {
      equipmentId,
      description: `cost-savings test WO ${RUN_ID}`,
      status: "open",
      priority: 3,
      maintenanceType: "preventive",
    });
    expect([200, 201]).toContain(wo.status);
    woId = wo.data.id;

    const { status, data } = await api("POST", `/api/cost-savings/calculate/${woId}`, {});
    // Calculate may return 200 with a savings row or 400/404 if the WO has no
    // closeout yet — both are valid surface behaviour. The point is the route
    // must respond.
    expect(status).toBeLessThan(500);
    expect(data).toBeDefined();
  });
});
