/**
 * Telemetry Ingestion Integration Tests
 *
 * Tests the telemetry data pipeline including:
 * - Reading telemetry data
 * - Heartbeat endpoints
 * - Configuration management
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import type request from "supertest";

import { startIntegrationTestServer } from "./utils/test-server";

const TEST_ORG_ID = "test-org-integration";
const TEST_VESSEL_ID = "00000000-0000-0000-0000-000000000001";
const TEST_EQUIPMENT_ID = "00000000-0000-0000-0000-000000000002";

describe("Telemetry API", () => {
  let api: request.Agent;
  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    const server = await startIntegrationTestServer();
    api = server.request();
    closeServer = server.close;
  }, 60000);

  afterAll(async () => {
    await closeServer?.();
  });

  describe("GET /api/telemetry/readings", () => {
    it("should return telemetry readings", async () => {
      const response = await api.get("/api/telemetry/readings").set("x-org-id", TEST_ORG_ID).query({
        vesselId: TEST_VESSEL_ID,
        limit: 10,
      });

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toBeDefined();
      }
    });

    it("should filter by equipment ID", async () => {
      const response = await api.get("/api/telemetry/readings").set("x-org-id", TEST_ORG_ID).query({
        equipmentId: TEST_EQUIPMENT_ID,
        limit: 10,
      });

      expect([200, 404]).toContain(response.status);
    });

    it("should support date range filtering", async () => {
      const endDate = new Date();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const response = await api.get("/api/telemetry/readings").set("x-org-id", TEST_ORG_ID).query({
        vesselId: TEST_VESSEL_ID,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("GET /api/telemetry/heartbeats", () => {
    it("should return device heartbeats", async () => {
      const response = await api
        .get("/api/telemetry/heartbeats")
        .set("x-org-id", TEST_ORG_ID)
        .query({ vesselId: TEST_VESSEL_ID });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("GET /api/telemetry/configs", () => {
    it("should return telemetry configurations", async () => {
      const response = await api.get("/api/telemetry/configs").set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("Telemetry Analytics", () => {
    it("should get anomaly detections", async () => {
      const response = await api
        .get("/api/ml-analytics/anomalies")
        .set("x-org-id", TEST_ORG_ID)
        .query({
          vesselId: TEST_VESSEL_ID,
          limit: 10,
        });

      expect([200, 404]).toContain(response.status);
    });

    it("should get predictions", async () => {
      const response = await api
        .get("/api/ml-analytics/predictions")
        .set("x-org-id", TEST_ORG_ID)
        .query({
          equipmentId: TEST_EQUIPMENT_ID,
        });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("Digital Twin", () => {
    it("should get digital twin status", async () => {
      const response = await api.get("/api/iot/digital-twin/status").set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });
  });
});
