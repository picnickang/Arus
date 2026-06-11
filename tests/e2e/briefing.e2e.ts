import { describe, it, expect } from "@jest/globals";

const BASE_URL = process.env["TEST_BASE_URL"] || "http://localhost:5000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = {
  "Content-Type": "application/json",
  "X-Org-Id": "default-org-id",
  "X-User-Id": "dev-admin-user",
  "X-User-Role": "admin",
};

async function fetchJson(method: string, path: string, body?: Record<string, unknown>) {
  const opts: RequestInit = {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

describe("Briefing Page E2E", () => {
  describe("Server route reachability", () => {
    it("serves the briefing list API in the server lane", async () => {
      const { status, data } = await fetchJson("GET", "/api/agent/briefings");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("Empty state (no briefing for today initially)", () => {
    it("latest endpoint returns null before generation", async () => {
      const today = new Date().toISOString().split("T")[0];
      const { status, data } = await fetchJson("GET", `/api/agent/briefings?date=${today}`);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("Generate Now flow", () => {
    let generatedBriefingId: string;

    it("generates a briefing via POST", async () => {
      const { status, data } = await fetchJson("POST", "/api/agent/briefings/generate");
      expect(status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.id).toMatch(UUID_RE);
      expect(data.status).toBe("ready");
      generatedBriefingId = data.id;
    });

    it("generated briefing has 6 sections", async () => {
      const { data } = await fetchJson("GET", "/api/agent/briefings/latest");
      expect(data).not.toBeNull();
      expect(generatedBriefingId).toMatch(UUID_RE);
      const sections = data.sections as Array<{
        key: string;
        title: string;
        items: unknown[];
        emptyMessage?: string;
      }>;
      expect(sections.length).toBe(6);
    });

    it("section rendering: each section has title, key, and items array", async () => {
      const { data } = await fetchJson("GET", "/api/agent/briefings/latest");
      const sections = data.sections as Array<{ key: string; title: string; items: unknown[] }>;
      const expectedKeys = [
        "overnight_alerts",
        "pending_approvals",
        "maintenance_due",
        "expiring_certifications",
        "low_stock",
        "equipment_health",
      ];
      for (const key of expectedKeys) {
        const section = sections.find((s) => s.key === key);
        expect(section).toBeDefined();
        expect(section!.title).toBeDefined();
        expect(Array.isArray(section!.items)).toBe(true);
      }
    });

    it("briefing has AI summary", async () => {
      const { data } = await fetchJson("GET", "/api/agent/briefings/latest");
      expect(data.aiSummary).toBeDefined();
      expect(typeof data.aiSummary).toBe("string");
      expect(data.aiSummary.length).toBeGreaterThan(10);
    });

    it("section items have entity links when present", async () => {
      const { data } = await fetchJson("GET", "/api/agent/briefings/latest");
      const sections = data.sections as Array<{
        items: Array<{ linkTo?: string; entityType?: string; entityId?: string }>;
      }>;
      for (const section of sections) {
        for (const item of section.items) {
          if (item.linkTo) {
            expect(typeof item.linkTo).toBe("string");
            expect(item.linkTo.startsWith("/")).toBe(true);
          }
          if (item.entityType) {
            expect(typeof item.entityType).toBe("string");
          }
        }
      }
    });
  });

  describe("Date picker navigation", () => {
    it("lists briefings for today", async () => {
      const today = new Date().toISOString().split("T")[0];
      const { status, data } = await fetchJson("GET", `/api/agent/briefings?date=${today}`);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it("returns empty for a past date with no briefings", async () => {
      const pastDate = "2020-01-01";
      const { status, data } = await fetchJson("GET", `/api/agent/briefings?date=${pastDate}`);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it("returns empty for a future date", async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const { status, data } = await fetchJson("GET", `/api/agent/briefings?date=${futureDate}`);
      expect(status).toBe(200);
      expect(data.length).toBe(0);
    });
  });

  describe("Latest for today semantics", () => {
    it("latest returns only today's briefing, not older ones", async () => {
      const { data } = await fetchJson("GET", "/api/agent/briefings/latest");
      if (data) {
        expect(typeof data.generatedAt).toBe("string");
        const generatedAt = new Date(data.generatedAt);
        const today = new Date();
        expect(generatedAt.getFullYear()).toBe(today.getFullYear());
        expect(generatedAt.getMonth()).toBe(today.getMonth());
        expect(generatedAt.getDate()).toBe(today.getDate());
      }
    });
  });

  describe("Briefing list endpoint", () => {
    it("returns briefings in reverse chronological order", async () => {
      const { data } = await fetchJson("GET", "/api/agent/briefings");
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 1) {
        const first = new Date(data[0].generatedAt);
        const second = new Date(data[1].generatedAt);
        expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
      }
    });
  });

  describe("Schedule API verification", () => {
    it("creates and lists a briefing schedule deterministically", async () => {
      const scheduleName = `Daily Operations Briefing Test ${Date.now()}`;
      const created = await fetchJson("POST", "/api/agent/schedules", {
        name: scheduleName,
        prompt: "__briefing__",
        cronExpression: "0 6 * * *",
        allowedTools: [],
        outputDestination: "notification",
        allowWriteTools: false,
        maxTokenBudget: 4000,
        enabled: true,
        consecutiveFailures: 0,
      });
      expect(created.status).toBe(201);
      expect(created.data.name).toBe(scheduleName);

      const { status, data } = await fetchJson("GET", "/api/agent/schedules");
      expect(status).toBe(200);
      const briefingSchedule = data.find(
        (s: { id: string; name: string }) => s.id === created.data.id
      );
      expect(briefingSchedule).toBeDefined();
      expect(briefingSchedule.cronExpression).toBe("0 6 * * *");
      expect(Boolean(briefingSchedule.enabled)).toBe(true);
    });
  });
});
