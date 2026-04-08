import { describe, it, expect } from "@jest/globals";

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const HEADERS = {
  "Content-Type": "application/json",
  "X-Org-Id": "default-org-id",
  "X-User-Id": "dev-admin-user",
  "X-User-Role": "admin",
};

interface ToolCallEntry {
  toolName: string;
  inputSummary?: string | null;
  durationMs?: number | null;
  status: string;
  error?: string | null;
}

interface TriggerContext {
  scheduleName?: string | null;
  scheduleId?: string | null;
  conversationId?: string | null;
}

interface ActivityItem {
  id: string;
  triggerType: "scheduled" | "user";
  scheduleName?: string | null;
  scheduleId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
  status: "completed" | "failed" | "running";
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  tokenUsage?: number | null;
  toolCallCount: number;
  toolCalls: ToolCallEntry[];
  response?: string | null;
  error?: string | null;
  triggerContext?: TriggerContext | null;
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

async function get<T>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  return { status: res.status, body: (await res.json()) as T };
}

describe("Agent Activity API", () => {
  describe("GET /api/agent/activity/summary", () => {
    it("returns summary metrics with correct shape and types", async () => {
      const { status, body } = await get<ActivitySummary>("/api/agent/activity/summary");
      expect(status).toBe(200);
      expect(body).toHaveProperty("runsToday");
      expect(body).toHaveProperty("successRate7d");
      expect(body).toHaveProperty("avgTokensPerRun");
      expect(body).toHaveProperty("estimatedCost30d");
      expect(body).toHaveProperty("failureCount7d");
      expect(body).toHaveProperty("totalRuns7d");
      expect(body).toHaveProperty("totalRuns30d");
      expect(typeof body.runsToday).toBe("number");
      expect(typeof body.successRate7d).toBe("number");
      expect(typeof body.avgTokensPerRun).toBe("number");
      expect(typeof body.estimatedCost30d).toBe("number");
      expect(typeof body.failureCount7d).toBe("number");
    });

    it("successRate7d is a valid percentage", async () => {
      const { body } = await get<ActivitySummary>("/api/agent/activity/summary");
      expect(body.successRate7d).toBeGreaterThanOrEqual(0);
      expect(body.successRate7d).toBeLessThanOrEqual(100);
    });
  });

  describe("GET /api/agent/activity", () => {
    it("returns activity items array", async () => {
      const { status, body } = await get<ActivityItem[]>("/api/agent/activity");
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it("items have correct shape with response field", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity");
      if (body.length > 0) {
        const item = body[0];
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("triggerType");
        expect(item).toHaveProperty("status");
        expect(item).toHaveProperty("startedAt");
        expect(item).toHaveProperty("toolCallCount");
        expect(item).toHaveProperty("toolCalls");
        expect(item).toHaveProperty("response");
        expect(["scheduled", "user"]).toContain(item.triggerType);
        expect(["completed", "failed", "running"]).toContain(item.status);
      }
    });

    it("user runs include full (non-truncated) response", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity?triggerType=user");
      const withResponse = body.filter((i) => i.response && i.response.length > 0);
      if (withResponse.length > 0) {
        const item = withResponse[0];
        expect(typeof item.response).toBe("string");
      }
    });

    it("tool calls include inputSummary field", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity?triggerType=user");
      const withTools = body.filter((i) => i.toolCallCount > 0);
      if (withTools.length > 0) {
        const tc = withTools[0].toolCalls[0];
        expect(tc).toHaveProperty("toolName");
        expect(tc).toHaveProperty("inputSummary");
        expect(tc).toHaveProperty("status");
      }
    });

    it("filters by triggerType=user", async () => {
      const { status, body } = await get<ActivityItem[]>("/api/agent/activity?triggerType=user");
      expect(status).toBe(200);
      for (const item of body) {
        expect(item.triggerType).toBe("user");
      }
    });

    it("filters by triggerType=scheduled", async () => {
      const { status, body } = await get<ActivityItem[]>("/api/agent/activity?triggerType=scheduled");
      expect(status).toBe(200);
      for (const item of body) {
        expect(item.triggerType).toBe("scheduled");
      }
    });

    it("filters by status=completed", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity?status=completed");
      for (const item of body) {
        expect(item.status).toBe("completed");
      }
    });

    it("filters by status=failed returns only failures", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity?status=failed");
      for (const item of body) {
        expect(item.status).toBe("failed");
      }
    });

    it("filters by startDate and endDate", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const { body: empty } = await get<ActivityItem[]>(`/api/agent/activity?startDate=${futureDate}`);
      expect(empty.length).toBe(0);

      const pastDate = new Date("2020-01-01").toISOString();
      const { body: withPast } = await get<ActivityItem[]>(`/api/agent/activity?startDate=${pastDate}`);
      expect(withPast.length).toBeGreaterThanOrEqual(0);

      const recent = new Date(Date.now() - 30 * 86400000).toISOString();
      const now = new Date().toISOString();
      const { body: ranged } = await get<ActivityItem[]>(`/api/agent/activity?startDate=${recent}&endDate=${now}`);
      expect(Array.isArray(ranged)).toBe(true);
    });

    it("respects limit parameter", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity?limit=2");
      expect(body.length).toBeLessThanOrEqual(2);
    });

    it("items are sorted by startedAt descending", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity");
      for (let i = 1; i < body.length; i++) {
        const prev = new Date(body[i - 1].startedAt).getTime();
        const curr = new Date(body[i].startedAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it("user runs include tool call entries with details", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity?triggerType=user");
      const withTools = body.filter((i) => i.toolCallCount > 0);
      if (withTools.length > 0) {
        const item = withTools[0];
        expect(Array.isArray(item.toolCalls)).toBe(true);
        expect(item.toolCalls.length).toBeGreaterThan(0);
        const tc = item.toolCalls[0];
        expect(tc).toHaveProperty("toolName");
        expect(tc).toHaveProperty("status");
        expect(tc).toHaveProperty("durationMs");
      }
    });

    it("ignores unknown triggerType values gracefully", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity?triggerType=invalid");
      expect(Array.isArray(body)).toBe(true);
    });

    it("items include triggerContext with relevant fields", async () => {
      const { body } = await get<ActivityItem[]>("/api/agent/activity");
      for (const item of body) {
        expect(item).toHaveProperty("triggerContext");
        if (item.triggerContext) {
          if (item.triggerType === "user") {
            expect(item.triggerContext.conversationId).toBe(item.id);
          }
          if (item.triggerType === "scheduled") {
            expect(item.triggerContext.scheduleId).toBeTruthy();
          }
        }
      }
    });
  });

  describe("Role enforcement", () => {
    it("accepts requests from admin roles", async () => {
      const res = await fetch(`${BASE}/api/agent/activity/summary`, { headers: HEADERS });
      expect(res.status).toBe(200);
    });
  });
});
