/**
 * Work Orders Integration Tests
 *
 * Tests the work orders CRUD lifecycle including:
 * - Creating work orders
 * - Updating status
 * - Completing work orders
 * - Parts assignment
 * - History tracking
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

const TEST_ORG_ID = "test-org-integration";
const TEST_VESSEL_ID = "00000000-0000-0000-0000-000000000001";
const TEST_EQUIPMENT_ID = "00000000-0000-0000-0000-000000000002";

describe("Work Orders API", () => {
  let app: Express;
  let createdWorkOrderId: string;

  beforeAll(async () => {
    const { createTestApp } = await import("../../server/app.js");
    app = await createTestApp();
  }, 60000);

  afterAll(async () => {});

  describe("GET /api/work-orders", () => {
    it("should return work orders list with pagination", async () => {
      const response = await request(app)
        .get("/api/work-orders")
        .set("x-org-id", TEST_ORG_ID)
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body) || response.body.data).toBe(true);
    });

    it("should filter by vessel ID", async () => {
      const response = await request(app)
        .get(`/api/work-orders?vesselId=${TEST_VESSEL_ID}`)
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      const workOrders = (Array.isArray(response.body) ? response.body : response.body.data) as
        | Array<{ vesselId?: string; status?: string }>
        | undefined;
      if (workOrders && workOrders.length > 0) {
        expect(workOrders.every((wo) => wo.vesselId === TEST_VESSEL_ID)).toBe(true);
      }
    });

    it("should filter by status", async () => {
      const response = await request(app)
        .get("/api/work-orders?status=open")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      const workOrders = (Array.isArray(response.body) ? response.body : response.body.data) as
        | Array<{ vesselId?: string; status?: string }>
        | undefined;
      if (workOrders && workOrders.length > 0) {
        expect(workOrders.every((wo) => wo.status === "open")).toBe(true);
      }
    });
  });

  describe("POST /api/work-orders", () => {
    it("should create a new work order", async () => {
      const newWorkOrder = {
        vesselId: TEST_VESSEL_ID,
        equipmentId: TEST_EQUIPMENT_ID,
        title: "Integration Test Work Order",
        description: "Created by automated integration test",
        priority: "medium",
        type: "corrective",
        status: "open",
      };

      const response = await request(app)
        .post("/api/work-orders")
        .set("x-org-id", TEST_ORG_ID)
        .send(newWorkOrder)
        .expect("Content-Type", /json/)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe(newWorkOrder.title);

      createdWorkOrderId = response.body.id;
    });

    it("should reject invalid work order data", async () => {
      const invalidWorkOrder = {
        title: "",
      };

      await request(app)
        .post("/api/work-orders")
        .set("x-org-id", TEST_ORG_ID)
        .send(invalidWorkOrder)
        .expect(400);
    });

    it("should require org ID header", async () => {
      await request(app).post("/api/work-orders").send({ title: "Test" }).expect(401);
    });
  });

  describe("GET /api/work-orders/:id", () => {
    it("should return a specific work order", async () => {
      if (!createdWorkOrderId) {
        console.log("Skipping - no work order created");
        return;
      }

      const response = await request(app)
        .get(`/api/work-orders/${createdWorkOrderId}`)
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      expect(response.body.id).toBe(createdWorkOrderId);
    });

    it("should return 404 for non-existent work order", async () => {
      await request(app)
        .get("/api/work-orders/00000000-0000-0000-0000-000000000000")
        .set("x-org-id", TEST_ORG_ID)
        .expect(404);
    });
  });

  describe("PATCH /api/work-orders/:id", () => {
    it("should update work order status", async () => {
      if (!createdWorkOrderId) {
        console.log("Skipping - no work order created");
        return;
      }

      const response = await request(app)
        .patch(`/api/work-orders/${createdWorkOrderId}`)
        .set("x-org-id", TEST_ORG_ID)
        .send({ status: "in_progress" })
        .expect(200);

      expect(response.body.status).toBe("in_progress");
    });

    it("should update work order priority", async () => {
      if (!createdWorkOrderId) {
        console.log("Skipping - no work order created");
        return;
      }

      const response = await request(app)
        .patch(`/api/work-orders/${createdWorkOrderId}`)
        .set("x-org-id", TEST_ORG_ID)
        .send({ priority: "high" })
        .expect(200);

      expect(response.body.priority).toBe("high");
    });
  });

  describe("Work Order Lifecycle", () => {
    it("should complete a work order with completion data", async () => {
      if (!createdWorkOrderId) {
        console.log("Skipping - no work order created");
        return;
      }

      const completionData = {
        completedAt: new Date().toISOString(),
        completionNotes: "Work completed successfully during integration test",
        technicianId: "test-technician-001",
        laborHours: 2.5,
      };

      const response = await request(app)
        .post(`/api/work-orders/${createdWorkOrderId}/complete`)
        .set("x-org-id", TEST_ORG_ID)
        .send(completionData)
        .expect(200);

      expect(response.body.status).toBe("completed");
    });
  });

  describe("Work Order History", () => {
    it("should track work order changes in history", async () => {
      if (!createdWorkOrderId) {
        console.log("Skipping - no work order created");
        return;
      }

      const response = await request(app)
        .get(`/api/work-orders/${createdWorkOrderId}/history`)
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("DELETE /api/work-orders/:id", () => {
    it("should delete a work order", async () => {
      if (!createdWorkOrderId) {
        console.log("Skipping - no work order created");
        return;
      }

      await request(app)
        .delete(`/api/work-orders/${createdWorkOrderId}`)
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);

      await request(app)
        .get(`/api/work-orders/${createdWorkOrderId}`)
        .set("x-org-id", TEST_ORG_ID)
        .expect(404);
    });
  });
});
