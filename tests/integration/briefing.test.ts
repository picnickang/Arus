import { describe, it, expect } from "@jest/globals";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

async function api(method: string, path: string, body?: Record<string, unknown>) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

describe("Briefing API", () => {
  describe("GET /api/agent/briefings/latest", () => {
    it("returns null when no briefing exists", async () => {
      const { status, data } = await api("GET", "/api/agent/briefings/latest");
      expect(status).toBe(200);
      expect(data === null || data?.id).toBeTruthy();
    });
  });

  describe("POST /api/agent/briefings/generate", () => {
    it("generates a new briefing successfully", async () => {
      const { status, data } = await api("POST", "/api/agent/briefings/generate");
      expect(status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.orgId).toBeDefined();
      expect(data.status).toBe("ready");
      expect(data.periodStart).toBeDefined();
      expect(data.periodEnd).toBeDefined();
      expect(data.generatedAt).toBeDefined();
      expect(data.aiSummary).toBeDefined();
      expect(Array.isArray(data.sections)).toBe(true);
    });

    it("briefing has all required sections", async () => {
      const { data } = await api("GET", "/api/agent/briefings/latest");
      expect(data).not.toBeNull();
      const sections = data.sections as Array<{ key: string; title: string; items: unknown[] }>;
      expect(sections.length).toBe(6);

      const keys = sections.map((s) => s.key);
      expect(keys).toContain("overnight_alerts");
      expect(keys).toContain("pending_approvals");
      expect(keys).toContain("maintenance_due");
      expect(keys).toContain("expiring_certifications");
      expect(keys).toContain("low_stock");
      expect(keys).toContain("equipment_health");
    });

    it("each section has title and items array", async () => {
      const { data } = await api("GET", "/api/agent/briefings/latest");
      const sections = data.sections as Array<{ key: string; title: string; items: unknown[] }>;
      for (const section of sections) {
        expect(section.title).toBeDefined();
        expect(typeof section.title).toBe("string");
        expect(Array.isArray(section.items)).toBe(true);
      }
    });
  });

  describe("GET /api/agent/briefings", () => {
    it("lists briefings", async () => {
      const { status, data } = await api("GET", "/api/agent/briefings");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it("filters by date", async () => {
      const today = new Date().toISOString().split("T")[0];
      const { status, data } = await api("GET", `/api/agent/briefings?date=${today}`);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it("returns empty array for future date", async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const { status, data } = await api("GET", `/api/agent/briefings?date=${futureDate}`);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it("rejects invalid date format", async () => {
      const { status } = await api("GET", "/api/agent/briefings?date=not-a-date");
      expect(status).toBe(400);
    });
  });

  describe("GET /api/agent/briefings/latest after generation", () => {
    it("returns the most recently generated briefing", async () => {
      const { status, data } = await api("GET", "/api/agent/briefings/latest");
      expect(status).toBe(200);
      expect(data).not.toBeNull();
      expect(data.id).toBeDefined();
      expect(data.status).toBe("ready");
      expect(data.aiSummary).toBeDefined();
      expect(typeof data.aiSummary).toBe("string");
    });
  });

  describe("Briefing section item structure", () => {
    it("items have required fields when present", async () => {
      const { data } = await api("GET", "/api/agent/briefings/latest");
      const sections = data.sections as Array<{
        items: Array<{ id: string; title: string; description: string }>;
      }>;
      for (const section of sections) {
        for (const item of section.items) {
          expect(item.id).toBeDefined();
          expect(item.title).toBeDefined();
          expect(item.description).toBeDefined();
        }
      }
    });
  });
});
