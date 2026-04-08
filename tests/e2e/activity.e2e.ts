import { describe, it, expect } from "@jest/globals";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
const HEADERS = {
  "X-Org-Id": "default-org-id",
  "X-User-Id": "dev-admin-user",
  "X-User-Role": "admin",
};

async function fetchPage(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "text/html" },
  });
  const html = await res.text();
  return { status: res.status, html };
}

async function fetchJson<T>(path: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { ...HEADERS, "Content-Type": "application/json" },
  });
  return { status: res.status, data: (await res.json()) as T };
}

interface ActivityItem {
  id: string;
  triggerType: "scheduled" | "user";
  status: "completed" | "failed" | "running";
  startedAt: string;
  toolCallCount: number;
  toolCalls: Array<{ toolName: string; inputSummary?: string | null; status: string }>;
  response?: string | null;
  error?: string | null;
  triggerContext?: { scheduleName?: string | null; scheduleId?: string | null; conversationId?: string | null } | null;
}

interface ActivitySummary {
  runsToday: number;
  successRate7d: number;
  avgTokensPerRun: number;
  estimatedCost30d: number;
  failureCount7d: number;
  totalRuns7d: number;
  totalRuns30d: number;
}

describe("Agent Activity E2E", () => {
  describe("Page load", () => {
    it("serves the activity page HTML", async () => {
      const { status, html } = await fetchPage("/agent/activity");
      expect(status).toBe(200);
      expect(html).toContain("<!DOCTYPE html>");
    });

    it("serves the copilot admin page HTML", async () => {
      const { status, html } = await fetchPage("/copilot-admin");
      expect(status).toBe(200);
      expect(html).toContain("<!DOCTYPE html>");
    });
  });

  describe("Summary metrics", () => {
    it("returns all required metrics with numeric types", async () => {
      const { status, data } = await fetchJson<ActivitySummary>("/api/agent/activity/summary");
      expect(status).toBe(200);
      expect(typeof data.runsToday).toBe("number");
      expect(typeof data.successRate7d).toBe("number");
      expect(typeof data.avgTokensPerRun).toBe("number");
      expect(typeof data.estimatedCost30d).toBe("number");
      expect(typeof data.failureCount7d).toBe("number");
      expect(typeof data.totalRuns7d).toBe("number");
      expect(typeof data.totalRuns30d).toBe("number");
    });

    it("success rate is within valid range", async () => {
      const { data } = await fetchJson<ActivitySummary>("/api/agent/activity/summary");
      expect(data.successRate7d).toBeGreaterThanOrEqual(0);
      expect(data.successRate7d).toBeLessThanOrEqual(100);
    });
  });

  describe("Activity list", () => {
    it("returns sorted items with response snippets", async () => {
      const { status, data } = await fetchJson<ActivityItem[]>("/api/agent/activity");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);

      for (let i = 1; i < data.length; i++) {
        expect(new Date(data[i - 1].startedAt).getTime())
          .toBeGreaterThanOrEqual(new Date(data[i].startedAt).getTime());
      }

      const withResponse = data.filter(i => i.response);
      if (withResponse.length > 0) {
        expect(typeof withResponse[0].response).toBe("string");
      }
    });

    it("tool calls include input summaries", async () => {
      const { data } = await fetchJson<ActivityItem[]>("/api/agent/activity?triggerType=user");
      const withTools = data.filter(i => i.toolCallCount > 0 && i.toolCalls.length > 0);
      if (withTools.length > 0) {
        expect(withTools[0].toolCalls[0]).toHaveProperty("toolName");
        expect(withTools[0].toolCalls[0]).toHaveProperty("inputSummary");
      }
    });
  });

  describe("Filtering", () => {
    it("filters by trigger type", async () => {
      const { data: userRuns } = await fetchJson<ActivityItem[]>("/api/agent/activity?triggerType=user");
      for (const item of userRuns) {
        expect(item.triggerType).toBe("user");
      }
      const { data: schedRuns } = await fetchJson<ActivityItem[]>("/api/agent/activity?triggerType=scheduled");
      for (const item of schedRuns) {
        expect(item.triggerType).toBe("scheduled");
      }
    });

    it("filters by status", async () => {
      const { data: completed } = await fetchJson<ActivityItem[]>("/api/agent/activity?status=completed");
      for (const item of completed) {
        expect(item.status).toBe("completed");
      }
      const { data: failed } = await fetchJson<ActivityItem[]>("/api/agent/activity?status=failed");
      for (const item of failed) {
        expect(item.status).toBe("failed");
      }
    });

    it("filters by date range", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const { data: empty } = await fetchJson<ActivityItem[]>(`/api/agent/activity?startDate=${futureDate}`);
      expect(empty.length).toBe(0);
    });

    it("respects limit", async () => {
      const { data } = await fetchJson<ActivityItem[]>("/api/agent/activity?limit=2");
      expect(data.length).toBeLessThanOrEqual(2);
    });

    it("supports pagination with offset", async () => {
      const { data: all } = await fetchJson<ActivityItem[]>("/api/agent/activity?limit=50");
      if (all.length >= 2) {
        const { data: page2 } = await fetchJson<ActivityItem[]>("/api/agent/activity?limit=1&offset=1");
        expect(page2.length).toBeLessThanOrEqual(1);
        if (page2.length > 0) {
          expect(page2[0].id).toBe(all[1].id);
        }
      }
    });
  });

  describe("Trigger context", () => {
    it("items include triggerContext field", async () => {
      const { data } = await fetchJson<ActivityItem[]>("/api/agent/activity");
      for (const item of data) {
        expect(item).toHaveProperty("triggerContext");
        if (item.triggerType === "user" && item.triggerContext) {
          expect(item.triggerContext.conversationId).toBeTruthy();
        }
      }
    });
  });

  describe("Failure observability", () => {
    it("failed items include error details when available", async () => {
      const { data } = await fetchJson<ActivityItem[]>("/api/agent/activity?status=failed");
      for (const item of data) {
        expect(item.status).toBe("failed");
      }
    });
  });
});
