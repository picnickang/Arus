import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

const TEST_ORG_ID = "default-org-id";

describe("Agent Findings API", () => {
  let app: Express;

  beforeAll(async () => {
    const { createTestApp } = await import("../../server/app.js");
    app = await createTestApp();
  }, 60000);

  afterAll(async () => {});

  describe("GET /api/agent/findings", () => {
    it("should return findings list with items and total", async () => {
      const response = await request(app)
        .get("/api/agent/findings")
        .set("x-org-id", TEST_ORG_ID)
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty("items");
      expect(response.body).toHaveProperty("total");
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(typeof response.body.total).toBe("number");
    });

    it("should validate finding item shape", async () => {
      const response = await request(app)
        .get("/api/agent/findings?limit=5")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      if (response.body.items.length > 0) {
        const item = response.body.items[0];
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("source");
        expect(item).toHaveProperty("sourceId");
        expect(item).toHaveProperty("title");
        expect(item).toHaveProperty("summary");
        expect(item).toHaveProperty("severity");
        expect(item).toHaveProperty("status");
        expect(item).toHaveProperty("requiresAction");
        expect(item).toHaveProperty("createdAt");
        expect(["suggestion", "draft", "schedule_run"]).toContain(item.source);
        expect(["info", "warning", "critical"]).toContain(item.severity);
      }
    });

    it("should filter by source=suggestion", async () => {
      const response = await request(app)
        .get("/api/agent/findings?source=suggestion")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      for (const item of response.body.items) {
        expect(item.source).toBe("suggestion");
      }
    });

    it("should filter by severity=critical", async () => {
      const response = await request(app)
        .get("/api/agent/findings?severity=critical")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      for (const item of response.body.items) {
        expect(item.severity).toBe("critical");
      }
    });

    it("should filter by status=pending", async () => {
      const response = await request(app)
        .get("/api/agent/findings?status=pending")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      for (const item of response.body.items) {
        expect(item.status).toBe("pending");
      }
    });

    it("should support date range filtering", async () => {
      const response = await request(app)
        .get("/api/agent/findings?dateFrom=2020-01-01T00:00:00Z&dateTo=2099-12-31T23:59:59Z")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it("should paginate with limit and offset", async () => {
      const full = await request(app)
        .get("/api/agent/findings?limit=100")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      if (full.body.total > 1) {
        const page = await request(app)
          .get("/api/agent/findings?limit=1&offset=0")
          .set("x-org-id", TEST_ORG_ID)
          .expect(200);

        expect(page.body.items.length).toBeLessThanOrEqual(1);
        expect(page.body.total).toBe(full.body.total);
      }
    });

    it("should enforce max limit of 200", async () => {
      const response = await request(app)
        .get("/api/agent/findings?limit=500")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(200);
    });

    it("should return empty results for non-existent source type combinations", async () => {
      const response = await request(app)
        .get("/api/agent/findings?source=schedule_run&status=running")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      expect(Array.isArray(response.body.items)).toBe(true);
    });
  });

  describe("GET /api/agent/findings/summary", () => {
    it("should return summary with all required fields", async () => {
      const response = await request(app)
        .get("/api/agent/findings/summary")
        .set("x-org-id", TEST_ORG_ID)
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty("pendingApprovals");
      expect(response.body).toHaveProperty("pendingSuggestions");
      expect(response.body).toHaveProperty("recentFailures");
      expect(response.body).toHaveProperty("totalFindings");

      expect(typeof response.body.pendingApprovals).toBe("number");
      expect(typeof response.body.pendingSuggestions).toBe("number");
      expect(typeof response.body.recentFailures).toBe("number");
      expect(typeof response.body.totalFindings).toBe("number");
    });

    it("should return non-negative counts", async () => {
      const response = await request(app)
        .get("/api/agent/findings/summary")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      expect(response.body.pendingApprovals).toBeGreaterThanOrEqual(0);
      expect(response.body.pendingSuggestions).toBeGreaterThanOrEqual(0);
      expect(response.body.recentFailures).toBeGreaterThanOrEqual(0);
      expect(response.body.totalFindings).toBeGreaterThanOrEqual(0);
    });

    it("should have totalFindings >= sum of pending approvals and suggestions", async () => {
      const response = await request(app)
        .get("/api/agent/findings/summary")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      expect(response.body.totalFindings).toBeGreaterThanOrEqual(
        response.body.pendingApprovals + response.body.pendingSuggestions
      );
    });
  });

  describe("Findings consistency", () => {
    it("should have consistent counts between findings list and summary", async () => {
      const [findingsRes, summaryRes] = await Promise.all([
        request(app).get("/api/agent/findings?limit=200").set("x-org-id", TEST_ORG_ID).expect(200),
        request(app).get("/api/agent/findings/summary").set("x-org-id", TEST_ORG_ID).expect(200),
      ]);

      expect(findingsRes.body.total).toBe(summaryRes.body.totalFindings);
    });

    it("should sort findings by createdAt descending", async () => {
      const response = await request(app)
        .get("/api/agent/findings?limit=50")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      const items = response.body.items;
      for (let i = 1; i < items.length; i++) {
        const prevDate = new Date(items[i - 1].createdAt).getTime();
        const currDate = new Date(items[i].createdAt).getTime();
        expect(prevDate).toBeGreaterThanOrEqual(currDate);
      }
    });

    it("should include entity information on findings that have entities", async () => {
      const response = await request(app)
        .get("/api/agent/findings?source=suggestion")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      const withEntity = response.body.items.filter(
        (i: { entityType: string | null }) => i.entityType !== null
      );
      for (const item of withEntity) {
        expect(item.entityType).toBeTruthy();
        expect(item.entityId).toBeTruthy();
      }
    });
  });
});
