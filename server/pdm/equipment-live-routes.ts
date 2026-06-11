import type { Router } from "express";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import {
  equipment,
  failureHistory as failureHistoryPg,
  IS_POSTGRES,
  vessels,
  workOrders,
} from "@shared/schema-runtime";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { GetRiskQueueUseCase } from "./application/get-risk-queue.use-case";
import { db } from "../db";
import { DatabaseTelemetryStorage } from "../db/telemetry/db-telemetry";
import { authenticatedRequest } from "../middleware/auth";
import { logger } from "../utils/logger";

interface PdmEquipmentLiveRouteDependencies {
  getRiskQueueUseCase: GetRiskQueueUseCase;
}

export function registerPdmEquipmentLiveRoutes(
  router: Router,
  { getRiskQueueUseCase }: PdmEquipmentLiveRouteDependencies
): void {
  const telemetryStorage = new DatabaseTelemetryStorage();

  /**
   * Task #80 — Cross-vessel failure pattern for the Equipment 360° drawer.
   *
   * Returns the N most recent `failure_history` rows for the same
   * equipment **type** across *other* vessels in the same org.
   *
   * Access control:
   *  - The router is mounted at `/api/pdm` which is protected by the
   *    global `requireOrgId` middleware (`server/routes.ts`). The
   *    authoritative org id therefore comes from the authenticated
   *    session (`req.orgId`), NEVER from a client-supplied parameter
   *    or from the equipment row itself.
   *  - The target equipment is then verified to belong to that same
   *    org and treated as not-found otherwise (fail-closed, prevents
   *    cross-tenant existence probes).
   *  - All joined rows (failure_history, equipment) are filtered by
   *    `req.orgId` so no cross-tenant data can leak through the join.
   *  - Per-user vessel ACL: the codebase has no user→vessel mapping
   *    today (see `AuthenticatedRequest` in
   *    `server/middleware/auth.ts` — no vesselIds claim). Once such a
   *    mapping exists it should be enforced here using server-side
   *    identity, NOT a client-supplied query parameter. A follow-up
   *    task tracks adding that mapping. Until then, "fleet failure
   *    pattern" is intentionally scoped to all vessels within the
   *    authenticated org, which is the documented feature behaviour.
   */
  router.get("/equipment/:equipmentId/fleet-failure-pattern", async (req, res) => {
    try {
      const equipmentId = req.params.equipmentId;
      if (!equipmentId) {
        return res.status(400).json({ error: "Equipment ID is required" });
      }
      const limit = Math.min(Math.max(parseInt(req.query["limit"] as string) || 10, 1), 50);
      const offset = Math.max(parseInt(req.query["offset"] as string) || 0, 0);

      const orgId = authenticatedRequest(req).orgId;
      if (!orgId) {
        return res.status(401).json({
          error: "Authenticated organization context is required",
          code: "TENANT_CLAIM_MISSING",
        });
      }

      // Cross-vessel failure pattern is a cloud-Postgres feature
      // (failure_history aggregation). In local/embedded (SQLite)
      // mode the table shape differs and is not populated by the
      // Push-A1 ingest path — return an empty result rather than
      // querying a column-incompatible schema.
      if (!IS_POSTGRES) {
        return res.json({ equipmentId, equipmentType: null, vesselId: null, items: [], total: 0 });
      }

      const [target] = await db
        .select({
          id: equipment.id,
          orgId: equipment.orgId,
          type: equipment.type,
          vesselId: equipment.vesselId,
        })
        .from(equipment)
        .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
        .limit(1);

      if (!target) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      if (!target.type) {
        return res.json({
          equipmentId,
          equipmentType: null,
          vesselId: target.vesselId,
          items: [],
          total: 0,
        });
      }

      // Defense-in-depth vessel ACL: resolve the authenticated
      // identity's accessible vessel ids from the `vessels` table
      // (org-scoped). Today this is equivalent to "all vessels in
      // the user's org" because no per-user vessel claim exists
      // (see `AuthenticatedRequest` in `server/middleware/auth.ts`),
      // but routing the SQL through an explicit `vesselId IN (...)`
      // means the day the auth layer starts narrowing the list
      // (e.g. a `user.vesselIds` claim or a `user_vessel_access`
      // table), this endpoint enforces it without further changes
      // — and a vessel inserted with a foreign orgId can never leak
      // through this path even if equipment.orgId were ever wrong.
      const allowedVesselRows = await db
        .select({ id: vessels.id })
        .from(vessels)
        .where(eq(vessels.orgId, orgId));
      const allowedVesselIds = allowedVesselRows
        .map((v) => v.id)
        .filter((id): id is string => Boolean(id) && id !== target.vesselId);

      if (allowedVesselIds.length === 0) {
        return res.json({
          equipmentId,
          equipmentType: target.type,
          vesselId: target.vesselId,
          items: [],
          total: 0,
          limit,
          offset,
          hasMore: false,
        });
      }

      const conditions = [
        eq(failureHistoryPg.orgId, orgId),
        eq(equipment.orgId, orgId),
        eq(equipment.type, target.type),
        inArray(equipment.vesselId, allowedVesselIds),
      ];
      if (target.vesselId) {
        // Belt-and-braces: own-vessel exclusion is also baked into
        // the allowedVesselIds list above.
        conditions.push(ne(equipment.vesselId, target.vesselId));
      }

      const rows = await db
        .select({
          failureId: failureHistoryPg.id,
          failureTimestamp: failureHistoryPg.failureTimestamp,
          failureMode: failureHistoryPg.failureMode,
          failureSeverity: failureHistoryPg.failureSeverity,
          rootCause: failureHistoryPg.rootCause,
          workOrderId: failureHistoryPg.workOrderId,
          workOrderNumber: workOrders.woNumber,
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          equipmentType: equipment.type,
          vesselId: equipment.vesselId,
          vesselName: vessels.name,
        })
        .from(failureHistoryPg)
        .innerJoin(equipment, eq(failureHistoryPg.equipmentId, equipment.id))
        .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
        .leftJoin(workOrders, eq(failureHistoryPg.workOrderId, workOrders.id))
        .where(and(...conditions))
        .orderBy(desc(failureHistoryPg.failureTimestamp))
        .limit(limit + 1) // peek one extra row to compute hasMore
        .offset(offset);

      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;

      return res.json({
        equipmentId,
        equipmentType: target.type,
        vesselId: target.vesselId,
        items: pageRows.map((r) => ({
          failureId: r.failureId,
          failureTimestamp: r.failureTimestamp,
          failureMode: r.failureMode,
          failureSeverity: r.failureSeverity,
          rootCause: r.rootCause,
          workOrderId: r.workOrderId,
          workOrderNumber: r.workOrderNumber,
          equipmentId: r.equipmentId,
          equipmentName: r.equipmentName,
          vesselId: r.vesselId,
          vesselName: r.vesselName,
        })),
        total: pageRows.length,
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      });
    } catch (error) {
      logger.error("Error fetching fleet failure pattern:", error);
      return res.status(500).json({ error: "Failed to fetch fleet failure pattern" });
    }
  });

  router.get("/equipment/:equipmentId/telemetry", async (req, res) => {
    try {
      const equipmentId = req.params.equipmentId;
      const limit = parseInt(req.query["limit"] as string) || 50;
      const sensorType = req.query["sensorType"] as string;
      const hours = parseInt(req.query["hours"] as string) || 24;

      if (!equipmentId) {
        return res.status(400).json({ error: "Equipment ID is required" });
      }

      let readings;
      if (sensorType) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);
        readings = await telemetryStorage.getTelemetryByEquipmentAndDateRange(
          equipmentId,
          startDate,
          endDate,
          sensorType
        );
      } else {
        readings = await telemetryStorage.getLatestTelemetryReadings(equipmentId, limit);
      }

      const formatted = readings.map((r) => ({
        ts: r.ts,
        sensorType: r.sensorType,
        value: r.value,
        unit: r.unit,
        status: r.status,
      }));

      return res.json(formatted);
    } catch (error) {
      logger.error("Error fetching equipment telemetry:", error);
      return res.status(500).json({ error: "Failed to fetch telemetry data" });
    }
  });

  router.get("/telemetry/trends", async (req, res) => {
    try {
      const equipmentId = req.query["equipmentId"] as string;
      const hours = parseInt(req.query["hours"] as string) || 24;

      const trends = await telemetryStorage.getTelemetryTrends(equipmentId, hours);
      return res.json(trends);
    } catch (error) {
      logger.error("Error fetching telemetry trends:", error);
      return res.status(500).json({ error: "Failed to fetch telemetry trends" });
    }
  });

  router.get("/health", async (_req, res) => {
    return res.json({
      status: "operational",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/alerts", async (req, res) => {
    try {
      const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
      const riskQueue = await getRiskQueueUseCase.execute({ orgId, status: "active" });
      const alerts = riskQueue.map((item) => ({
        id: item.id,
        equipmentId: item.equipmentId,
        equipmentName: item.equipmentName,
        vesselName: item.vesselName,
        severity:
          item.severity === "critical"
            ? "high"
            : item.severity === "high"
              ? "warn"
              : item.severity || "info",
        message: `${item.failureMode} detected on ${item.equipmentName}`,
        at: item.detectedAt,
        acknowledged: item.status === "resolved",
      }));
      return res.json(alerts);
    } catch (error) {
      logger.error("Error fetching PdM alerts:", error);
      return res.json([]);
    }
  });

  router.get("/baseline/:vesselId/:assetId", async (req, res) => {
    try {
      const { vesselId, assetId } = req.params;
      return res.json({ baselines: [], vesselId, assetId });
    } catch (error) {
      logger.error("Error fetching baselines:", error);
      return res.status(500).json({ error: "Failed to fetch baselines" });
    }
  });
}
