import { describe, it, expect, beforeAll } from "@jest/globals";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
const TEST_ORG_ID = "default-org-id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function api(method: string, path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-org-id": TEST_ORG_ID,
      "x-user-role": "admin",
      "x-user-id": "test-user-1",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function createSuggestion(overrides: Record<string, unknown> = {}) {
  const { status, data } = await api("POST", "/api/agent/suggestions", {
    triggerType: "high_risk_prediction",
    title: `Outcome Test ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    summary: "Test summary for outcome tracking",
    severity: "warning",
    status: "pending",
    ...overrides,
  });
  if (status !== 201) {
    throw new Error(`Failed to create suggestion: ${status} ${JSON.stringify(data)}`);
  }
  expect(data.id).toMatch(UUID_RE);
  return data;
}

describe("Outcome Tracking API", () => {
  const suggestionIds: string[] = [];

  beforeAll(async () => {
    for (let i = 0; i < 4; i++) {
      const s = await createSuggestion({
        triggerType: i % 2 === 0 ? "high_risk_prediction" : "overdue_maintenance",
        severity: i === 0 ? "critical" : "warning",
      });
      suggestionIds.push(s.id);
    }
  }, 30000);

  describe("POST /api/agent/suggestions/:id/act", () => {
    it("records outcome with category and reason", async () => {
      const { status, data } = await api("POST", `/api/agent/suggestions/${suggestionIds[0]}/act`, {
        outcome: "useful",
        outcomeReason: "Helped prevent downtime",
      });

      expect(status).toBe(200);
      expect(data.status).toBe("acted");
      expect(data.actedOn).toBe(true);
      expect(data.outcome).toBe("useful");
      expect(data.outcomeReason).toBe("Helped prevent downtime");
      expect(data.outcomeAt).toBeTruthy();
      expect(data.outcomeBy).toBeTruthy();
    });

    it("rejects invalid outcome category", async () => {
      const fresh = await createSuggestion();
      const { status } = await api("POST", `/api/agent/suggestions/${fresh.id}/act`, {
        outcome: "invalid_category",
      });
      expect(status).toBe(400);
    });

    it("returns 404 for non-existent suggestion", async () => {
      const { status } = await api("POST", "/api/agent/suggestions/nonexistent-id-123/act", {
        outcome: "useful",
      });
      expect(status).toBe(404);
    });
  });

  describe("POST /api/agent/suggestions/:id/dismiss", () => {
    it("records outcome with category and reason", async () => {
      const { status, data } = await api(
        "POST",
        `/api/agent/suggestions/${suggestionIds[1]}/dismiss`,
        {
          outcome: "false_alarm",
          outcomeReason: "Sensor was miscalibrated",
        }
      );

      expect(status).toBe(200);
      expect(data.status).toBe("dismissed");
      expect(data.outcome).toBe("false_alarm");
      expect(data.outcomeReason).toBe("Sensor was miscalibrated");
    });

    it("allows skip without outcome when none provided", async () => {
      const fresh = await createSuggestion();
      const { status, data } = await api("POST", `/api/agent/suggestions/${fresh.id}/dismiss`);

      expect(status).toBe(200);
      expect(data.status).toBe("dismissed");
      expect(data.outcome).toBeNull();
      expect(data.outcomeReason).toBeNull();
    });
  });

  describe("POST /api/agent/suggestions/:id/defer", () => {
    it("creates deferred status", async () => {
      const { status, data } = await api(
        "POST",
        `/api/agent/suggestions/${suggestionIds[2]}/defer`,
        {
          outcomeReason: "Will review next week",
        }
      );

      expect(status).toBe(200);
      expect(data.status).toBe("deferred");
      expect(data.outcomeReason).toBe("Will review next week");
    });
  });

  describe("GET /api/agent/suggestions/effectiveness", () => {
    it("returns summary with all required fields", async () => {
      const { status, data } = await api("GET", "/api/agent/suggestions/effectiveness?days=30");

      expect(status).toBe(200);
      expect(data).toHaveProperty("totalResolved");
      expect(data).toHaveProperty("actedCount");
      expect(data).toHaveProperty("dismissedCount");
      expect(data).toHaveProperty("deferredCount");
      expect(data).toHaveProperty("acceptanceRate");
      expect(data).toHaveProperty("dismissalRate");
      expect(data).toHaveProperty("topDismissalReasons");
      expect(data).toHaveProperty("outcomeCounts");
      expect(typeof data.acceptanceRate).toBe("number");
      expect(typeof data.dismissalRate).toBe("number");
      expect(Array.isArray(data.topDismissalReasons)).toBe(true);
    });

    it("totals match resolved sum", async () => {
      const { data } = await api("GET", "/api/agent/suggestions/effectiveness?days=30");
      expect(data.totalResolved).toBe(data.actedCount + data.dismissedCount + data.deferredCount);
    });

    it("rates are within valid range", async () => {
      const { data } = await api("GET", "/api/agent/suggestions/effectiveness?days=30");
      expect(data.acceptanceRate).toBeGreaterThanOrEqual(0);
      expect(data.acceptanceRate).toBeLessThanOrEqual(100);
      expect(data.dismissalRate).toBeGreaterThanOrEqual(0);
      expect(data.dismissalRate).toBeLessThanOrEqual(100);
    });
  });

  describe("Transition guards", () => {
    it("rejects re-acting on already acted suggestion", async () => {
      const fresh = await createSuggestion();
      await api("POST", `/api/agent/suggestions/${fresh.id}/act`, { outcome: "useful" });
      const { status, data } = await api("POST", `/api/agent/suggestions/${fresh.id}/act`, {
        outcome: "useful",
      });
      expect(status).toBe(500);
      expect(data.error).toContain("Cannot transition");
    });

    it("rejects dismissing already dismissed suggestion", async () => {
      const fresh = await createSuggestion();
      await api("POST", `/api/agent/suggestions/${fresh.id}/dismiss`, { outcome: "not_relevant" });
      const { status, data } = await api("POST", `/api/agent/suggestions/${fresh.id}/dismiss`, {
        outcome: "not_relevant",
      });
      expect(status).toBe(500);
      expect(data.error).toContain("Cannot transition");
    });
  });

  describe("Findings integration", () => {
    it("findings API returns outcome fields for resolved suggestions", async () => {
      const { status, data } = await api("GET", "/api/agent/findings?source=suggestion");

      expect(status).toBe(200);
      const resolved = data.items?.filter((i: { status: string }) =>
        ["acted", "dismissed", "deferred"].includes(i.status)
      );
      if (resolved && resolved.length > 0) {
        expect(resolved[0]).toHaveProperty("outcome");
        expect(resolved[0]).toHaveProperty("outcomeReason");
        expect(resolved[0]).toHaveProperty("outcomeAt");
      }
    });
  });
});
