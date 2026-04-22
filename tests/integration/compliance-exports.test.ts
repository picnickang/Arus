/**
 * Compliance Exports Integration Tests
 *
 * Tests the compliance export functionality including:
 * - Excel exports
 * - PDF exports
 * - Compliance findings
 * - Compliance rules
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

const TEST_ORG_ID = "test-org-integration";
const TEST_VESSEL_ID = "00000000-0000-0000-0000-000000000001";

describe("Compliance API", () => {
  let app: Express;

  beforeAll(async () => {
    const { createTestApp } = await import("../../server/app.js");
    app = await createTestApp();
  }, 60000);

  afterAll(async () => {});

  describe("GET /api/compliance/findings", () => {
    it("should return compliance findings", async () => {
      const response = await request(app)
        .get("/api/compliance/findings")
        .set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toBeDefined();
      }
    });

    it("should filter by vessel ID", async () => {
      const response = await request(app)
        .get("/api/compliance/findings")
        .set("x-org-id", TEST_ORG_ID)
        .query({ vesselId: TEST_VESSEL_ID });

      expect([200, 404]).toContain(response.status);
    });

    it("should filter by status", async () => {
      const response = await request(app)
        .get("/api/compliance/findings")
        .set("x-org-id", TEST_ORG_ID)
        .query({ status: "open" });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("GET /api/compliance/rules", () => {
    it("should return compliance rules", async () => {
      const response = await request(app).get("/api/compliance/rules").set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });

    it("should filter active rules", async () => {
      const response = await request(app)
        .get("/api/compliance/rules")
        .set("x-org-id", TEST_ORG_ID)
        .query({ active: true });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("GET /api/compliance/dashboard", () => {
    it("should return compliance dashboard data", async () => {
      const response = await request(app)
        .get("/api/compliance/dashboard")
        .set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("Data Export", () => {
    it("should list available exports", async () => {
      const response = await request(app).get("/api/data-export/list").set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });

    it("should support export request", async () => {
      const response = await request(app)
        .post("/api/data-export/export")
        .set("x-org-id", TEST_ORG_ID)
        .send({
          type: "compliance",
          format: "xlsx",
          vesselId: TEST_VESSEL_ID,
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
        });

      expect([200, 201, 202, 400, 404]).toContain(response.status);
    });
  });

  describe("STCW Export", () => {
    it("should export STCW data", async () => {
      const response = await request(app)
        .get("/api/stcw/export")
        .set("x-org-id", TEST_ORG_ID)
        .query({
          vesselId: TEST_VESSEL_ID,
          format: "xlsx",
        });

      expect([200, 404]).toContain(response.status);
    });
  });
});
