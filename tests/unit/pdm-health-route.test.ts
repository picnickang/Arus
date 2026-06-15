/**
 * GET /api/pdm/health/:equipmentId — contract coverage.
 *
 * This endpoint was swagger-documented and client-consumed but never
 * implemented (the PdM equipment page crashed on the HTML 404 fallback).
 * Assert the response matches the client's PdmHealthData contract for the
 * three regimes: ML score present, no ML data (graceful fallback), and
 * unknown equipment (404).
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import express from "express";
import request from "supertest";

const getEquipmentHealthMock = jest.fn(async (): Promise<unknown[]> => []);
const getPdmScoresMock = jest.fn(async (): Promise<unknown[]> => []);

let app: express.Express;

beforeAll(async () => {
  jest.unstable_mockModule("../../server/repositories", () => ({
    __esModule: true,
    dbEquipmentStorage: { getEquipmentHealth: getEquipmentHealthMock },
    dbDevicesStorage: { getPdmScores: getPdmScoresMock },
  }));

  const { pdmHealthRouter } = await import("../../server/domains/pdm-platform/health/routes");
  app = express();
  // Mirror production wiring: requireOrgId populates req.orgId before the router.
  app.use(
    "/api/pdm/health",
    (req, _res, next) => {
      (req as express.Request & { orgId?: string }).orgId = "org-test";
      next();
    },
    pdmHealthRouter
  );
});

beforeEach(() => {
  getEquipmentHealthMock.mockReset();
  getEquipmentHealthMock.mockResolvedValue([]);
  getPdmScoresMock.mockReset();
  getPdmScoresMock.mockResolvedValue([]);
});

describe("GET /api/pdm/health/:equipmentId", () => {
  it("returns the full PdmHealthData contract when an ML score exists", async () => {
    const due = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    getEquipmentHealthMock.mockResolvedValue([
      {
        id: "eq-1",
        name: "Engine",
        type: "engine",
        vesselId: null,
        status: "warning",
        healthIndex: 62,
      },
    ]);
    getPdmScoresMock.mockResolvedValue([
      { equipmentId: "eq-1", predictedDueDate: due, pFail30d: 0.2, healthIdx: 60, ts: new Date() },
    ]);

    const res = await request(app).get("/api/pdm/health/eq-1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      equipmentId: "eq-1",
      // healthScore prefers the PdM model's healthIdx (60) over the equipment
      // record's coarse healthIndex (62); status is derived from it (60 -> warning).
      healthScore: 60,
      status: "warning",
      pFail30d: 0.2,
      confidence: "high",
    });
    expect(res.body.rul).toBeGreaterThanOrEqual(39);
    expect(res.body.rul).toBeLessThanOrEqual(41);
    expect(res.body.rulUncertainty).toBe(Math.round(res.body.rul * 0.2));
    expect(typeof res.body.lastUpdated).toBe("string");
  });

  it("degrades gracefully when no ML data exists (page must still render)", async () => {
    getEquipmentHealthMock.mockResolvedValue([
      {
        id: "eq-1",
        name: "Engine",
        type: "engine",
        vesselId: null,
        status: "healthy",
        healthIndex: 100,
      },
    ]);

    const res = await request(app).get("/api/pdm/health/eq-1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      equipmentId: "eq-1",
      healthScore: 100,
      rul: null,
      rulUncertainty: null,
      pFail30d: 0,
      confidence: "low",
      aiSummary: null,
    });
  });

  it("404s for equipment outside the org (or unknown)", async () => {
    const res = await request(app).get("/api/pdm/health/eq-unknown");
    expect(res.status).toBe(404);
  });
});
