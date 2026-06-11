/**
 * GET /api/maintenance-templates — optional limit/offset safety cap.
 *
 * Pins: (1) the no-param response stays the full BARE ARRAY (the
 * work-order form dropdown and the forms/journeys integration tests rely
 * on the unfiltered list), (2) limit/offset slice at the route layer when
 * supplied, and (3) out-of-range params are rejected.
 *
 * The maintenance service facade is mocked (jest.unstable_mockModule +
 * dynamic import — the unit lane runs under --experimental-vm-modules) to
 * sever the repository/server-db import chain; a fake-user middleware is
 * installed ahead of the routes so requireOrgId passes.
 */

import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import type { Express, NextFunction, Request, Response } from "express";
import request from "supertest";

const TEMPLATES = [
  { id: "t-1", name: "Engine Service A", equipmentType: "engine" },
  { id: "t-2", name: "Engine Service B", equipmentType: "engine" },
  { id: "t-3", name: "Pump Overhaul", equipmentType: "pump" },
];

jest.unstable_mockModule("../../server/domains/maintenance/service", () => ({
  __esModule: true,
  maintenanceService: {
    listTemplates: async () => TEMPLATES,
  },
}));

let app: Express;

beforeAll(async () => {
  const express = (await import("express")).default;
  const { registerMaintenanceRoutes } = await import(
    "../../server/domains/maintenance/interfaces/routes"
  );

  const passthrough = (_req: Request, _res: Response, next: NextFunction) => next();

  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user?: unknown }).user = {
      id: "tester",
      email: "tester@example.com",
      role: "admin",
      isActive: true,
    };
    next();
  });
  registerMaintenanceRoutes(app, {
    writeOperationRateLimit: passthrough,
    criticalOperationRateLimit: passthrough,
    generalApiRateLimit: passthrough,
  });
});

describe("GET /api/maintenance-templates cap", () => {
  it("returns the full bare array when no params are sent (back-compat)", async () => {
    const res = await request(app).get("/api/maintenance-templates");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].id).toBe("t-1");
  });

  it("applies limit when supplied", async () => {
    const res = await request(app).get("/api/maintenance-templates?limit=1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("t-1");
  });

  it("applies offset together with limit", async () => {
    const res = await request(app).get("/api/maintenance-templates?limit=1&offset=1");
    expect(res.status).toBe(200);
    expect(res.body.map((t: { id: string }) => t.id)).toEqual(["t-2"]);
  });

  it("rejects a limit above the 1000 cap", async () => {
    const res = await request(app).get("/api/maintenance-templates?limit=5000");
    expect(res.status).toBe(400);
  });
});
