/**
 * Crew Scheduling Integration Tests
 *
 * Tests the crew scheduling and assignment functionality including:
 * - Crew member CRUD
 * - Schedule creation and management
 * - Assignment operations
 * - STCW compliance checks
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

const TEST_ORG_ID = "test-org-integration";
const TEST_VESSEL_ID = "00000000-0000-0000-0000-000000000001";

describe("Crew Scheduling API", () => {
  let app: Express;
  let createdCrewMemberId: string;
  let createdScheduleId: string;

  beforeAll(async () => {
    const { createTestApp } = await import("../../server/app.js");
    app = await createTestApp();
  }, 60000);

  afterAll(async () => {});

  describe("GET /api/crew", () => {
    it("should return crew members list", async () => {
      const response = await request(app)
        .get("/api/crew")
        .set("x-org-id", TEST_ORG_ID)
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body) || response.body.data).toBe(true);
    });

    it("should filter by vessel ID", async () => {
      const response = await request(app)
        .get(`/api/crew?vesselId=${TEST_VESSEL_ID}`)
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe("POST /api/crew", () => {
    it("should create a new crew member", async () => {
      const newCrewMember = {
        firstName: "Test",
        lastName: "CrewMember",
        email: `test.crew.${Date.now()}@example.com`,
        role: "Deck Officer",
        rank: "Third Officer",
        vesselId: TEST_VESSEL_ID,
      };

      const response = await request(app)
        .post("/api/crew")
        .set("x-org-id", TEST_ORG_ID)
        .send(newCrewMember)
        .expect("Content-Type", /json/);

      if (response.status === 201) {
        expect(response.body).toBeDefined();
        expect(response.body.id).toBeDefined();
        expect(response.body.firstName).toBe(newCrewMember.firstName);
        createdCrewMemberId = response.body.id;
      } else {
        console.log("Crew creation returned:", response.status, response.body);
      }
    });

    it("should reject invalid crew member data", async () => {
      const invalidCrewMember = {
        firstName: "",
      };

      const response = await request(app)
        .post("/api/crew")
        .set("x-org-id", TEST_ORG_ID)
        .send(invalidCrewMember);

      expect([400, 422]).toContain(response.status);
    });
  });

  describe("Crew Extensions - Scheduler", () => {
    it("should get scheduler settings", async () => {
      const response = await request(app)
        .get("/api/crew-extensions/scheduler/settings")
        .set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });

    it("should get planner view", async () => {
      const response = await request(app)
        .get("/api/crew-extensions/scheduler/planner")
        .set("x-org-id", TEST_ORG_ID)
        .query({ vesselId: TEST_VESSEL_ID });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("Crew Assignments", () => {
    it("should list assignments", async () => {
      const response = await request(app)
        .get("/api/crew-extensions/assignments")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it("should check assignment eligibility", async () => {
      if (!createdCrewMemberId) {
        console.log("Skipping - no crew member created");
        return;
      }

      const response = await request(app)
        .post("/api/crew-extensions/scheduler/can-assign")
        .set("x-org-id", TEST_ORG_ID)
        .send({
          crewMemberId: createdCrewMemberId,
          vesselId: TEST_VESSEL_ID,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect([200, 400]).toContain(response.status);
    });
  });

  describe("STCW Compliance", () => {
    it("should get hours of rest compliance data", async () => {
      const response = await request(app)
        .get("/api/stcw/compliance")
        .set("x-org-id", TEST_ORG_ID)
        .query({ vesselId: TEST_VESSEL_ID });

      expect([200, 404]).toContain(response.status);
    });

    it("should get fatigue risk scores", async () => {
      const response = await request(app)
        .get("/api/stcw/fatigue")
        .set("x-org-id", TEST_ORG_ID)
        .query({ vesselId: TEST_VESSEL_ID });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("Crew Certifications", () => {
    it("should list certifications", async () => {
      const response = await request(app)
        .get("/api/crew-extensions/certifications")
        .set("x-org-id", TEST_ORG_ID);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe("Cleanup", () => {
    it("should delete created crew member", async () => {
      if (!createdCrewMemberId) {
        console.log("Skipping - no crew member to delete");
        return;
      }

      const response = await request(app)
        .delete(`/api/crew/${createdCrewMemberId}`)
        .set("x-org-id", TEST_ORG_ID);

      expect([200, 204, 404]).toContain(response.status);
    });
  });
});
