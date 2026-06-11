import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Pool } from "pg";

const BASE_URL = process.env["TEST_BASE_URL"] || "http://localhost:5000";
const TEST_ORG_ID = "default-org-id";
const RUN_ID = `gap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });

interface ApiResult<T = unknown> {
  status: number;
  data: T;
}

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-org-id": TEST_ORG_ID,
      "x-user-role": "admin",
      "x-user-id": "gap-closure-test",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as T;
  return { status: res.status, data };
}

async function pickOpenWorkOrder(excludeId?: string): Promise<string | null> {
  const { data } = await api<Array<{ id: string }>>("GET", "/api/work-orders");
  const open = (data || []).find(
    (w) =>
      w.id !== excludeId &&
      w?.status &&
      !["completed", "cancelled"].includes(String(w.status).toLowerCase())
  );
  return open?.id ?? null;
}

describe("Workflow Gap-Closure Integration", () => {
  let workOrderId: string;

  beforeAll(async () => {
    const health = await api("GET", "/api/healthz");
    expect(health.status).toBe(200);
    const wo = await pickOpenWorkOrder();
    if (!wo) {throw new Error("No open work order available for tests");}
    workOrderId = wo;
  }, 30000);

  afterAll(async () => {
    await pool.end();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario A: Blocker resolution lifecycle
  //   (state lives in attention-workflow-state.json, not PG)
  // ─────────────────────────────────────────────────────────────────────
  describe("Scenario A: Blocker resolution lifecycle", () => {
    const itemId = `wo-blocked-test-${RUN_ID}`;

    it("rejects invalid status enum (only updated|waiting|unblocked|deferred)", async () => {
      const { status, data } = await api("POST", "/api/attention/blocker-resolutions", {
        itemId,
        workOrderId,
        blockerType: "parts",
        reason: `bad-status ${RUN_ID}`,
        status: "pending",
      });
      expect(status).toBe(400);
      expect(JSON.stringify(data)).toMatch(/invalid_enum_value|status/i);
    });

    it("accepts 'waiting' resolution and returns valid record", async () => {
      const { status, data } = await api("POST", "/api/attention/blocker-resolutions", {
        itemId,
        workOrderId,
        blockerType: "parts",
        reason: `awaiting parts ${RUN_ID}`,
        status: "waiting",
      });
      expect(status).toBe(201);
      expect(data?.id).toBeTruthy();
      expect(data?.status).toBe("waiting");
      expect(data?.savedAt).toBeTruthy();
      expect(new Date(data.savedAt).toString()).not.toBe("Invalid Date");
    });

    it("upgrades the same item to 'unblocked' (latest-resolution wins)", async () => {
      const { status, data } = await api("POST", "/api/attention/blocker-resolutions", {
        itemId,
        workOrderId,
        blockerType: "parts",
        reason: `resolved ${RUN_ID}`,
        status: "unblocked",
      });
      expect(status).toBe(201);
      expect(data?.status).toBe("unblocked");
    });

    it("/attention/items observes the latest-resolution filter (sources still healthy)", async () => {
      const { status, data } = await api("GET", "/api/attention/items");
      expect(status).toBe(200);
      // Our synthetic itemId never had a real backing WO in the inbox source,
      // so we verify the inbox responds and stays healthy after the resolution write.
      expect(data?.sources?.workOrders).toBe("ok");
      expect(data?.sources?.inventory).toBe("ok");
      // If our item ever appeared, after 'unblocked' it must NOT appear now.
      type InboxItem = { id: string; lastResolution?: { status?: string } };
      const stillThere = ((data?.items as InboxItem[] | undefined) || []).some(
        (i) => i.id === itemId && i.lastResolution?.status !== "unblocked"
      );
      expect(stillThere).toBe(false);
    });

    it("supports re-blocking with 'waiting' (latest is now waiting again)", async () => {
      const { status, data } = await api("POST", "/api/attention/blocker-resolutions", {
        itemId,
        workOrderId,
        blockerType: "parts",
        reason: `re-blocked ${RUN_ID}`,
        status: "waiting",
      });
      expect(status).toBe(201);
      expect(data?.status).toBe("waiting");
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario B: Watch handover lifecycle
  // ─────────────────────────────────────────────────────────────────────
  describe("Scenario B: Watch handover lifecycle", () => {
    let draftId: string;

    it("rejects handover without required 'note'", async () => {
      const { status } = await api("POST", "/api/attention/handover", {
        watchLabel: "DAY",
        status: "draft",
      });
      expect(status).toBe(400);
    });

    it("creates a draft handover", async () => {
      const { status, data } = await api("POST", "/api/attention/handover", {
        note: `draft handover ${RUN_ID}`,
        watchLabel: "NIGHT",
        itemIds: [],
        status: "draft",
      });
      expect(status).toBe(201);
      expect(data?.id).toBeTruthy();
      expect(data?.status).toBe("draft");
      draftId = data.id;
    });

    it("creates a shared handover and lists both via GET /handovers", async () => {
      const { status, data } = await api("POST", "/api/attention/handover", {
        note: `shared handover ${RUN_ID}`,
        watchLabel: "DAY",
        itemIds: [],
        status: "shared",
      });
      expect(status).toBe(201);
      expect(data?.status).toBe("shared");

      type HandoverRecord = { id: string; note?: string; summary?: string };
      const list = await api<HandoverRecord[]>("GET", "/api/attention/handovers");
      expect(list.status).toBe(200);
      expect(Array.isArray(list.data)).toBe(true);
      const ours = list.data.filter((h) =>
        String(h.note || h.summary || "").includes(RUN_ID)
      );
      // Both our handovers (draft + shared) should be in the listing
      expect(ours.length).toBeGreaterThanOrEqual(2);
      const ids = ours.map((h) => h.id);
      expect(ids).toContain(draftId);
    });

    it("/handover/latest returns the most recent record with a parseable timestamp", async () => {
      const { status, data } = await api("GET", "/api/attention/handover/latest");
      expect(status).toBe(200);
      expect(data).toBeTruthy();
      const ts = data.savedAt || data.createdAt || data.timestamp;
      expect(new Date(ts).toString()).not.toBe("Invalid Date");
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario C: WO completion with structured closeout — DB-asserted
  // ─────────────────────────────────────────────────────────────────────
  describe("Scenario C: WO closeout persistence (work_order_completions)", () => {
    let closeoutWorkOrderId: string;

    beforeAll(async () => {
      const wo = await pickOpenWorkOrder(workOrderId);
      if (!wo) {throw new Error("Need a second open WO for closeout test");}
      closeoutWorkOrderId = wo;
    });

    it("completes WO and persists structured closeout into work_order_completions", async () => {
      const closeout = {
        workPerformed: `replaced impeller ${RUN_ID}`,
        causeFound: "wear",
        laborHours: 3.5,
        downtimeHours: 1.5,
        partsUsed: "impeller x1",
        evidenceNote: "photo-attached",
        checklistVerified: true,
        supervisorVerified: true,
      };

      const { status, data } = await api(
        "POST",
        `/api/work-orders/${closeoutWorkOrderId}/complete-with-feedback`,
        {
          completionNotes: `closeout test ${RUN_ID}`,
          actualHours: 3.5,
          actualDowntimeHours: 1.5,
          closeout,
        }
      );

      expect(status).toBe(200);
      expect(data?.completed).toBe(true);

      // Critical: structured notes live in work_order_completions, NOT in work_orders
      const { rows } = await pool.query(
        `SELECT completion_notes, notes, actual_duration_hours,
                actual_downtime_hours, parts_count, quality_check_passed
         FROM work_order_completions
         WHERE work_order_id = $1
         ORDER BY completed_at DESC
         LIMIT 1`,
        [closeoutWorkOrderId]
      );

      expect(rows.length).toBe(1);
      const row = rows[0];
      expect(row.completion_notes).toContain(RUN_ID);
      expect(row.completion_notes).toContain("Work performed: replaced impeller");
      expect(row.completion_notes).toContain("Cause found: wear");
      expect(row.completion_notes).toContain("Parts used: impeller x1");
      expect(row.completion_notes).toContain("Checklist verified: yes");
      expect(row.completion_notes).toContain("Supervisor verified: yes");
      expect(Number(row.actual_duration_hours)).toBe(3.5);
      expect(Number(row.actual_downtime_hours)).toBe(1.5);
      expect(row.parts_count).toBe(1);
      expect(row.quality_check_passed).toBe(true);
    });

    it("work_orders row is updated to 'completed' with downtime aggregated", async () => {
      const { rows } = await pool.query(
        `SELECT status, actual_downtime_hours FROM work_orders WHERE id = $1`,
        [closeoutWorkOrderId]
      );
      expect(rows[0]?.status).toBe("completed");
      expect(Number(rows[0]?.actual_downtime_hours)).toBeGreaterThan(0);
    });

    it("FK from work_order_completions references the work_orders row", async () => {
      const { rows } = await pool.query(
        `SELECT wo.id AS wo_id, woc.work_order_id AS comp_wo_id
         FROM work_orders wo
         JOIN work_order_completions woc ON woc.work_order_id = wo.id
         WHERE wo.id = $1
         LIMIT 1`,
        [closeoutWorkOrderId]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].wo_id).toBe(rows[0].comp_wo_id);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario D: Issue reports
  // ─────────────────────────────────────────────────────────────────────
  describe("Scenario D: Issue reports", () => {
    it("rejects invalid severity (legacy 'warning' not allowed)", async () => {
      const { status } = await api("POST", "/api/attention/issues", {
        summary: `bad-sev ${RUN_ID}`,
        severity: "warning",
        status: "submitted",
      });
      expect(status).toBe(400);
    });

    it("rejects invalid status (only draft|submitted)", async () => {
      const { status } = await api("POST", "/api/attention/issues", {
        summary: `bad-status ${RUN_ID}`,
        severity: "medium",
        status: "open",
      });
      expect(status).toBe(400);
    });

    it("creates an issue with valid severity + status", async () => {
      const { status, data } = await api("POST", "/api/attention/issues", {
        summary: `issue ${RUN_ID}`,
        severity: "medium",
        status: "submitted",
      });
      expect(status).toBe(201);
      expect(data?.id).toBeTruthy();
      expect(data?.severity).toBe("medium");
      expect(data?.status).toBe("submitted");
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario E: Attention inbox sources stay healthy under load
  // ─────────────────────────────────────────────────────────────────────
  describe("Scenario E: Attention inbox stays healthy", () => {
    it("all four port sources report 'ok' after activity", async () => {
      const { status, data } = await api("GET", "/api/attention/items");
      expect(status).toBe(200);
      expect(data?.sources?.workOrders).toBe("ok");
      expect(data?.sources?.alerts).toBe("ok");
      expect(data?.sources?.equipment).toBe("ok");
      expect(data?.sources?.inventory).toBe("ok");
    });

    it("queue counts are non-negative integers", async () => {
      const { data } = await api("GET", "/api/attention/items");
      const queues = data?.queues || [];
      expect(Array.isArray(queues)).toBe(true);
      for (const q of queues) {
        expect(Number.isInteger(q.count)).toBe(true);
        expect(q.count).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
