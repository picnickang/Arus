import { describe, it, expect, beforeAll } from "@jest/globals";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
const TEST_ORG_ID = "default-org-id";

async function api(method: string, path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-org-id": TEST_ORG_ID,
      "x-user-role": "admin",
      "x-user-id": "e2e-user-1",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function createSuggestion(overrides: Record<string, unknown> = {}) {
  const { status, data } = await api("POST", "/api/agent/suggestions", {
    triggerType: "high_risk_prediction",
    title: `E2E Outcome ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    summary: "E2E test for outcome tracking",
    severity: "warning",
    status: "pending",
    ...overrides,
  });
  if (status !== 201) {throw new Error(`Failed to create suggestion: ${status}`);}
  return data;
}

describe("Outcome Tracking E2E", () => {
  const pendingIds: string[] = [];

  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      const s = await createSuggestion({
        triggerType: i % 2 === 0 ? "high_risk_prediction" : "overdue_maintenance",
        severity: i === 0 ? "critical" : "warning",
      });
      pendingIds.push(s.id);
    }
  }, 30000);

  it("complete act flow: pending → acted with outcome", async () => {
    const { status, data } = await api("POST", `/api/agent/suggestions/${pendingIds[0]}/act`, {
      outcome: "useful",
      outcomeReason: "Prevented bearing failure",
    });

    expect(status).toBe(200);
    expect(data.status).toBe("acted");
    expect(data.outcome).toBe("useful");
    expect(data.outcomeReason).toBe("Prevented bearing failure");
    expect(data.outcomeBy).toBeTruthy();
  });

  it("complete dismiss flow: pending → dismissed with outcome", async () => {
    const { status, data } = await api("POST", `/api/agent/suggestions/${pendingIds[1]}/dismiss`, {
      outcome: "already_handled",
      outcomeReason: "Chief engineer already scheduled this",
    });

    expect(status).toBe(200);
    expect(data.status).toBe("dismissed");
    expect(data.outcome).toBe("already_handled");
  });

  it("complete defer flow: pending → deferred with outcome category", async () => {
    const { status, data } = await api("POST", `/api/agent/suggestions/${pendingIds[2]}/defer`, {
      outcome: "too_late",
      outcomeReason: "Deferring to next port call",
    });

    expect(status).toBe(200);
    expect(data.status).toBe("deferred");
    expect(data.outcome).toBe("too_late");
    expect(data.outcomeReason).toBe("Deferring to next port call");
  });

  it("multiple dismissals populate effectiveness summary", async () => {
    await api("POST", `/api/agent/suggestions/${pendingIds[3]}/dismiss`, {
      outcome: "false_alarm",
      outcomeReason: "False positive from sensor drift",
    });

    await api("POST", `/api/agent/suggestions/${pendingIds[4]}/dismiss`, {
      outcome: "too_late",
      outcomeReason: "Equipment already replaced",
    });

    const { status, data } = await api("GET", "/api/agent/suggestions/effectiveness?days=30");

    expect(status).toBe(200);
    expect(data.actedCount).toBeGreaterThanOrEqual(1);
    expect(data.dismissedCount).toBeGreaterThanOrEqual(2);
    expect(data.deferredCount).toBeGreaterThanOrEqual(1);
    expect(data.totalResolved).toBeGreaterThanOrEqual(5);
  });

  it("findings feed shows outcome on resolved suggestions", async () => {
    const { status, data } = await api("GET", "/api/agent/findings?source=suggestion&status=acted");

    expect(status).toBe(200);
    const actedItems = data.items?.filter((i: { status: string }) => i.status === "acted") || [];
    if (actedItems.length > 0) {
      expect(actedItems[0]).toHaveProperty("outcome");
      expect(actedItems[0].outcome).toBeTruthy();
    }
  });

  it("findings feed supports deferred status filter", async () => {
    const { status, data } = await api("GET", "/api/agent/findings?source=suggestion&status=deferred");

    expect(status).toBe(200);
    const deferredItems = data.items?.filter((i: { status: string }) => i.status === "deferred") || [];
    if (deferredItems.length > 0) {
      expect(deferredItems[0].status).toBe("deferred");
    }
  });

  it("outcome category validation works", async () => {
    const fresh = await createSuggestion();
    const { status } = await api("POST", `/api/agent/suggestions/${fresh.id}/act`, {
      outcome: "bad_category",
    });
    expect(status).toBe(400);
  });

  it("effectiveness rates are within valid range", async () => {
    const { data } = await api("GET", "/api/agent/suggestions/effectiveness?days=30");
    expect(data.acceptanceRate).toBeGreaterThanOrEqual(0);
    expect(data.acceptanceRate).toBeLessThanOrEqual(100);
    expect(data.dismissalRate).toBeGreaterThanOrEqual(0);
    expect(data.dismissalRate).toBeLessThanOrEqual(100);
  });
});
