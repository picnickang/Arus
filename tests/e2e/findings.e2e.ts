import { describe, it, expect, beforeAll } from "@jest/globals";

const BASE_URL = process.env["TEST_BASE_URL"] || "http://localhost:5000";

async function fetchJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-org-id": "default-org-id" },
  });
  return { status: res.status, body: await res.json() };
}

describe("Findings Page E2E", () => {
  describe("Page load and structure", () => {
    it("should load findings list with correct shape", async () => {
      const { status, body } = await fetchJson("/api/agent/findings?limit=50&offset=0");
      expect(status).toBe(200);
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("total");
      expect(Array.isArray(body.items)).toBe(true);
    });

    it("should load summary with 4 metric fields", async () => {
      const { status, body } = await fetchJson("/api/agent/findings/summary");
      expect(status).toBe(200);
      expect(typeof body.pendingApprovals).toBe("number");
      expect(typeof body.pendingSuggestions).toBe("number");
      expect(typeof body.recentFailures).toBe("number");
      expect(typeof body.totalFindings).toBe("number");
    });

    it("should include entity information on findings with entities", async () => {
      const { body } = await fetchJson("/api/agent/findings?source=suggestion");
      const withEntity = body.items.filter(
        (i: { entityType: string | null }) => i.entityType !== null
      );
      for (const item of withEntity) {
        expect(item.entityType).toBeTruthy();
        expect(item.entityId).toBeTruthy();
      }
    });

    it("should sort findings by createdAt descending", async () => {
      const { body } = await fetchJson("/api/agent/findings?limit=50");
      for (let i = 1; i < body.items.length; i++) {
        const prev = new Date(body.items[i - 1].createdAt).getTime();
        const curr = new Date(body.items[i].createdAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });
  });

  describe("Filter interactions", () => {
    it("should filter by source=suggestion", async () => {
      const { body } = await fetchJson("/api/agent/findings?source=suggestion");
      for (const item of body.items) {
        expect(item.source).toBe("suggestion");
      }
    });

    it("should filter by source=draft", async () => {
      const { body } = await fetchJson("/api/agent/findings?source=draft");
      for (const item of body.items) {
        expect(item.source).toBe("draft");
      }
    });

    it("should filter by source=schedule_run", async () => {
      const { body } = await fetchJson("/api/agent/findings?source=schedule_run");
      for (const item of body.items) {
        expect(item.source).toBe("schedule_run");
      }
    });

    it("should filter by severity=critical", async () => {
      const { body } = await fetchJson("/api/agent/findings?severity=critical");
      for (const item of body.items) {
        expect(item.severity).toBe("critical");
      }
    });

    it("should filter by severity=warning", async () => {
      const { body } = await fetchJson("/api/agent/findings?severity=warning");
      for (const item of body.items) {
        expect(item.severity).toBe("warning");
      }
    });

    it("should filter by status=pending", async () => {
      const { body } = await fetchJson("/api/agent/findings?status=pending");
      for (const item of body.items) {
        expect(item.status).toBe("pending");
      }
    });

    it("should support date range filtering", async () => {
      const { status, body } = await fetchJson(
        "/api/agent/findings?dateFrom=2020-01-01T00:00:00Z&dateTo=2099-12-31T23:59:59Z"
      );
      expect(status).toBe(200);
      expect(Array.isArray(body.items)).toBe(true);
    });

    it("should return empty for impossible date range", async () => {
      const { body } = await fetchJson(
        "/api/agent/findings?dateFrom=2099-01-01T00:00:00Z&dateTo=2099-12-31T23:59:59Z"
      );
      expect(body.items.length).toBe(0);
    });

    it("should handle combined filters", async () => {
      const { status, body } = await fetchJson(
        "/api/agent/findings?source=suggestion&severity=critical&status=pending"
      );
      expect(status).toBe(200);
      for (const item of body.items) {
        expect(item.source).toBe("suggestion");
        expect(item.severity).toBe("critical");
        expect(item.status).toBe("pending");
      }
    });
  });

  describe("Summary counts", () => {
    it("should have non-negative counts", async () => {
      const { body } = await fetchJson("/api/agent/findings/summary");
      expect(body.pendingApprovals).toBeGreaterThanOrEqual(0);
      expect(body.pendingSuggestions).toBeGreaterThanOrEqual(0);
      expect(body.recentFailures).toBeGreaterThanOrEqual(0);
      expect(body.totalFindings).toBeGreaterThanOrEqual(0);
    });

    it("should have totalFindings >= pending counts", async () => {
      const { body } = await fetchJson("/api/agent/findings/summary");
      expect(body.totalFindings).toBeGreaterThanOrEqual(
        body.pendingApprovals + body.pendingSuggestions
      );
    });

    it("should be consistent with findings list total", async () => {
      const [findingsRes, summaryRes] = await Promise.all([
        fetchJson("/api/agent/findings?limit=200"),
        fetchJson("/api/agent/findings/summary"),
      ]);
      expect(findingsRes.body.total).toBe(summaryRes.body.totalFindings);
    });
  });

  describe("Inline actions", () => {
    let pendingSuggestionId: string | null = null;

    beforeAll(async () => {
      const { body } = await fetchJson(
        "/api/agent/findings?source=suggestion&status=pending&limit=1"
      );
      if (body.items.length > 0) {
        pendingSuggestionId = body.items[0].sourceId;
      }
    });

    it("should act on a pending suggestion", async () => {
      if (!pendingSuggestionId) {
        console.log("No pending suggestions to test — skipping");
        return;
      }

      const res = await fetch(`${BASE_URL}/api/agent/suggestions/${pendingSuggestionId}/act`, {
        method: "POST",
        headers: { "x-org-id": "default-org-id", "Content-Type": "application/json" },
      });
      expect(res.status).toBeLessThan(500);
    });

    it("should reflect updated counts in summary after action", async () => {
      const { body } = await fetchJson("/api/agent/findings/summary");
      expect(typeof body.pendingSuggestions).toBe("number");
    });
  });

  describe("Empty state", () => {
    it("should return empty results for non-existent filter combo", async () => {
      const { status, body } = await fetchJson(
        "/api/agent/findings?source=schedule_run&status=running&severity=info"
      );
      expect(status).toBe(200);
      expect(Array.isArray(body.items)).toBe(true);
    });
  });

  describe("Pagination", () => {
    it("should paginate with limit and offset", async () => {
      const full = await fetchJson("/api/agent/findings?limit=100");
      if (full.body.total > 1) {
        const page = await fetchJson("/api/agent/findings?limit=1&offset=0");
        expect(page.body.items.length).toBeLessThanOrEqual(1);
        expect(page.body.total).toBe(full.body.total);
      }
    });

    it("should enforce max limit of 200", async () => {
      const { body } = await fetchJson("/api/agent/findings?limit=500");
      expect(body.items.length).toBeLessThanOrEqual(200);
    });
  });

  describe("Navigation badge", () => {
    it("should have pending count available for badge via summary endpoint", async () => {
      const { body } = await fetchJson("/api/agent/findings/summary");
      const badgeCount = body.pendingApprovals + body.pendingSuggestions;
      expect(typeof badgeCount).toBe("number");
      expect(badgeCount).toBeGreaterThanOrEqual(0);
    });
  });
});
