/**
 * PdM Dashboard Routes (mounted at /api/pdm)
 *
 * Core PdM domain routes: dashboard, risk queue, asset detail,
 * bearing/pump analysis, schedule, telemetry detail, and exports.
 */
import { Router } from "express";
import { z } from "zod";
import { logger } from "../utils/logger";
import { pdmPostgresRepository } from "./adapters/pdm-postgres.repository";
import { createGetDashboardUseCase } from "./application/get-dashboard.use-case";
import { createGetRiskQueueUseCase } from "./application/get-risk-queue.use-case";
import { createGetAssetDetailUseCase } from "./application/get-asset-detail.use-case";
import { createAcknowledgeRiskUseCase } from "./application/acknowledge-risk.use-case";
import { createCreateWorkOrderFromRiskUseCase } from "./application/create-work-order.use-case";
import { createGetScheduleUseCase } from "./application/get-schedule.use-case";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import type { RiskQueueItem } from "./domain/types";
import {
  pdmDashboardResponseSchema,
  pdmFilterOptionsResponseSchema,
  pdmRiskQueueResponseSchema,
} from "./domain/response-schemas";
import { validateResponse } from "../lib/api-helpers";
import { DatabaseTelemetryStorage } from "../db/telemetry/db-telemetry";
import { db } from "../db";
import { equipment, vessels, workOrders } from "@shared/schema-runtime";
import { IS_POSTGRES } from "@shared/schema-runtime";
import { failureHistory as failureHistoryPg } from "@shared/schema/ml-analytics-core";
import { and, desc, eq, ne, inArray } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const getDashboardUseCase = createGetDashboardUseCase(pdmPostgresRepository);
const getRiskQueueUseCase = createGetRiskQueueUseCase(pdmPostgresRepository);
const getAssetDetailUseCase = createGetAssetDetailUseCase(pdmPostgresRepository);
const acknowledgeRiskUseCase = createAcknowledgeRiskUseCase(pdmPostgresRepository);
const createWorkOrderFromRiskUseCase = createCreateWorkOrderFromRiskUseCase(pdmPostgresRepository);
const getScheduleUseCase = createGetScheduleUseCase(pdmPostgresRepository);
const telemetryStorage = new DatabaseTelemetryStorage();

const riskStatusSchema = z.enum(["new", "active", "resolved"]);

const dashboardFiltersSchema = z.object({
  vesselId: z.string().optional(),
  equipmentType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

function filterRiskQueue(
  items: RiskQueueItem[],
  filters: z.infer<typeof dashboardFiltersSchema>
): RiskQueueItem[] {
  return items.filter((item) => {
    if (filters.vesselId && item.vesselId !== filters.vesselId) {
      return false;
    }
    if (filters.equipmentType && item.equipmentType !== filters.equipmentType) {
      return false;
    }
    if (filters.dateFrom) {
      const detectedDate = new Date(item.detectedAt);
      if (detectedDate < new Date(filters.dateFrom)) {
        return false;
      }
    }
    if (filters.dateTo) {
      const detectedDate = new Date(item.detectedAt);
      if (detectedDate > new Date(filters.dateTo)) {
        return false;
      }
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName = item.equipmentName.toLowerCase().includes(searchLower);
      const matchesVessel = item.vesselName.toLowerCase().includes(searchLower);
      const matchesFailureMode = item.failureMode.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesVessel && !matchesFailureMode) {
        return false;
      }
    }
    return true;
  });
}

function formatCsvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => {
      if (v === null || v === undefined) {
        return "";
      }
      const str = String(v);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(",");
}

router.get("/dashboard", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const filters = dashboardFiltersSchema.parse(req.query);

    const dashboardData = await getDashboardUseCase.execute({ orgId });

    if (
      filters.vesselId ||
      filters.equipmentType ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.search
    ) {
      dashboardData.riskQueue.new = filterRiskQueue(dashboardData.riskQueue.new, filters);
      dashboardData.riskQueue.active = filterRiskQueue(dashboardData.riskQueue.active, filters);
      dashboardData.riskQueue.resolved = filterRiskQueue(dashboardData.riskQueue.resolved, filters);
    }

    return res.json(validateResponse(pdmDashboardResponseSchema, dashboardData, "GET /api/pdm/dashboard"));
  } catch (error) {
    logger.error("Error fetching PdM dashboard data:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

router.get("/filter-options", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const [vessels, equipmentTypes] = await Promise.all([
      pdmPostgresRepository.getVessels(orgId),
      pdmPostgresRepository.getEquipmentTypes(orgId),
    ]);

    return res.json(
      validateResponse(
        pdmFilterOptionsResponseSchema,
        { vessels, equipmentTypes },
        "GET /api/pdm/filter-options"
      )
    );
  } catch (error) {
    logger.error("Error fetching filter options:", error);
    return res.status(500).json({ error: "Failed to fetch filter options" });
  }
});

router.get("/risk-queue/:status", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const statusResult = riskStatusSchema.safeParse(req.params.status);
    if (!statusResult.success) {
      return res.status(400).json({ error: "Invalid status. Must be new, active, or resolved." });
    }
    const items = await getRiskQueueUseCase.execute({ orgId, status: statusResult.data });
    return res.json(
      validateResponse(pdmRiskQueueResponseSchema, items, "GET /api/pdm/risk-queue/:status")
    );
  } catch (error) {
    logger.error("Error fetching risk queue:", error);
    return res.status(500).json({ error: "Failed to fetch risk queue" });
  }
});

router.get("/asset/:equipmentId", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const equipmentId = req.params.equipmentId;
    if (!equipmentId) {
      return res.status(400).json({ error: "Equipment ID is required" });
    }
    const assetDetail = await getAssetDetailUseCase.execute({ orgId, equipmentId });
    if (!assetDetail) {
      return res.status(404).json({ error: "Asset not found" });
    }
    return res.json(assetDetail);
  } catch (error) {
    logger.error("Error fetching asset detail:", error);
    return res.status(500).json({ error: "Failed to fetch asset detail" });
  }
});

router.post("/risk/:itemId/acknowledge", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = (req.headers["x-user-id"] as string) || "system";
    const itemId = req.params.itemId;
    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required" });
    }
    await acknowledgeRiskUseCase.execute({ orgId, itemId, userId });
    return res.json({ success: true });
  } catch (error) {
    logger.error("Error acknowledging risk item:", error);
    return res.status(500).json({ error: "Failed to acknowledge risk item" });
  }
});

router.post("/risk/:itemId/create-work-order", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = (req.headers["x-user-id"] as string) || "system";
    const itemId = req.params.itemId;
    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required" });
    }
    const result = await createWorkOrderFromRiskUseCase.execute({ orgId, itemId, userId });
    return res.json({ success: true, workOrderId: result.workOrderId });
  } catch (error) {
    logger.error("Error creating work order from risk:", error);
    return res.status(500).json({ error: "Failed to create work order" });
  }
});

const scheduleFiltersSchema = z.object({
  vesselIds: z.string().optional(),
  equipmentTypes: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxTasksPerVesselPerDay: z.coerce.number().min(1).max(10).optional(),
  autoPopulate: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

router.get("/schedule", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const filters = scheduleFiltersSchema.parse(req.query);

    const result = await getScheduleUseCase.execute({
      orgId,
      ...(filters.vesselIds && { vesselIds: filters.vesselIds.split(",") }),
      ...(filters.equipmentTypes && { equipmentTypes: filters.equipmentTypes.split(",") }),
      ...(filters.startDate && { startDate: new Date(filters.startDate) }),
      ...(filters.endDate && { endDate: new Date(filters.endDate) }),
      ...(filters.maxTasksPerVesselPerDay !== undefined && { maxTasksPerVesselPerDay: filters.maxTasksPerVesselPerDay }),
      autoPopulate: filters.autoPopulate,
    });

    return res.json(result.data);
  } catch (error) {
    logger.error("Error fetching PdM schedule:", error);
    return res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

router.get("/export/schedule", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const format = (req.query['format'] as string) || "csv";
    const filters = scheduleFiltersSchema.parse(req.query);

    const result = await getScheduleUseCase.execute({
      orgId,
      ...(filters.vesselIds && { vesselIds: filters.vesselIds.split(",") }),
      ...(filters.equipmentTypes && { equipmentTypes: filters.equipmentTypes.split(",") }),
      ...(filters.startDate && { startDate: new Date(filters.startDate) }),
      ...(filters.endDate && { endDate: new Date(filters.endDate) }),
    });

    const allTasks = [...result.data.scheduledTasks, ...result.data.blockedTasks];

    if (format === "csv") {
      const headers = [
        "Task ID",
        "Alert ID",
        "Vessel",
        "Equipment",
        "Type",
        "Failure Mode",
        "Severity",
        "RUL P10",
        "RUL P50",
        "RUL P90",
        "Confidence %",
        "Earliest Start",
        "Preferred Date",
        "Latest Finish",
        "Scheduled Date",
        "Status",
        "Block Reason",
        "Block Details",
        "Est. Downtime (hrs)",
        "Est. Cost",
        "Recommended Actions",
        "Work Order ID",
      ];
      const rows = allTasks.map((task) =>
        formatCsvRow([
          task.id,
          task.alertId,
          task.vesselName,
          task.equipmentName,
          task.equipmentType,
          task.failureMode,
          task.severity,
          task.rulP10Days,
          task.rulP50Days,
          task.rulP90Days,
          task.confidence,
          task.schedulingWindow.earliestStart.toISOString().split("T")[0],
          task.schedulingWindow.preferredDate.toISOString().split("T")[0],
          task.schedulingWindow.latestFinish.toISOString().split("T")[0],
          task.scheduledDate
            ? new Date(task.scheduledDate).toISOString().split("T")[0]
            : "",
          task.status,
          task.blockReason || "",
          task.blockDetails || "",
          task.estimatedDowntimeHours,
          task.estimatedCost,
          task.recommendedActions.join("; "),
          task.workOrderId || "",
        ])
      );

      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=pdm-schedule-export.csv");
      return res.send(csv);
    } else if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=pdm-schedule-export.json");
      return res.json(allTasks);
    } else {
      return res.status(400).json({ error: "Invalid format. Supported: csv, json" });
    }
  } catch (error) {
    logger.error("Error exporting schedule:", error);
    return res.status(500).json({ error: "Failed to export schedule" });
  }
});

router.get("/export/risk-queue", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const format = (req.query['format'] as string) || "csv";
    const filters = dashboardFiltersSchema.parse(req.query);

    const dashboardData = await getDashboardUseCase.execute({ orgId });
    let allItems = [
      ...dashboardData.riskQueue.new,
      ...dashboardData.riskQueue.active,
      ...dashboardData.riskQueue.resolved,
    ];

    if (
      filters.vesselId ||
      filters.equipmentType ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.search
    ) {
      allItems = filterRiskQueue(allItems, filters);
    }

    if (format === "csv") {
      const headers = [
        "ID",
        "Vessel",
        "Equipment",
        "Type",
        "Failure Mode",
        "Severity",
        "RUL (Days)",
        "Confidence %",
        "Status",
        "Detected At",
        "Recommended Action",
      ];
      const rows = allItems.map((item) =>
        formatCsvRow([
          item.id,
          item.vesselName,
          item.equipmentName,
          item.equipmentType,
          item.failureMode,
          item.severity,
          item.rulEstimateDays,
          item.confidence,
          item.status,
          new Date(item.detectedAt).toISOString(),
          item.recommendedAction,
        ])
      );

      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=risk-queue-export.csv");
      return res.send(csv);
    } else if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=risk-queue-export.json");
      return res.json(allItems);
    } else {
      return res.status(400).json({ error: "Invalid format. Supported: csv, json" });
    }
  } catch (error) {
    logger.error("Error exporting risk queue:", error);
    return res.status(500).json({ error: "Failed to export risk queue" });
  }
});

router.get("/export/kpis", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const format = (req.query['format'] as string) || "json";

    const dashboardData = await getDashboardUseCase.execute({ orgId });
    const kpis = dashboardData.kpis;

    if (format === "csv") {
      const headers = ["Metric", "Value", "Period/Change"];
      const rows = [
        formatCsvRow([
          "Fleet Health Score",
          kpis.fleetHealthScore,
          `${kpis.fleetHealthChange > 0 ? "+" : ""}${kpis.fleetHealthChange}% ${kpis.fleetHealthPeriod}`,
        ]),
        formatCsvRow([
          "Active Alerts",
          kpis.activeAlertsTotal,
          `${kpis.criticalAlertsCount} critical`,
        ]),
        formatCsvRow([
          "Assets at Risk",
          kpis.assetsAtRisk,
          `${kpis.assetsRulUnder14Days} under 14 days`,
        ]),
        formatCsvRow([
          "Avoided Downtime (hrs)",
          kpis.avoidedDowntimeHours,
          kpis.avoidedDowntimePeriod,
        ]),
        formatCsvRow([
          "Maintenance Forecast",
          `$${kpis.maintenanceForecastCost.toLocaleString()}`,
          kpis.maintenanceForecastPeriod,
        ]),
      ];

      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=kpis-export.csv");
      return res.send(csv);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=kpis-export.json");
      return res.json(kpis);
    }
  } catch (error) {
    logger.error("Error exporting KPIs:", error);
    return res.status(500).json({ error: "Failed to export KPIs" });
  }
});

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
    const limit = Math.min(Math.max(parseInt(req.query['limit'] as string) || 10, 1), 50);
    const offset = Math.max(parseInt(req.query['offset'] as string) || 0, 0);

    const orgId = (req as AuthenticatedRequest).orgId;
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
    const limit = parseInt(req.query['limit'] as string) || 50;
    const sensorType = req.query['sensorType'] as string;
    const hours = parseInt(req.query['hours'] as string) || 24;

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
    const equipmentId = req.query['equipmentId'] as string;
    const hours = parseInt(req.query['hours'] as string) || 24;

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
    const orgId = (req as AuthenticatedRequest).orgId || DEFAULT_ORG_ID;
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

router.post("/analyze/bearing", async (req, res) => {
  try {
    const { series, vesselName, assetId, sampleRate } = req.body;
    if (!series || !Array.isArray(series) || series.length < 10) {
      return res.status(400).json({ error: "At least 10 data points required for analysis" });
    }
    const mean = series.reduce((a: number, b: number) => a + b, 0) / series.length;
    const variance =
      series.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / series.length;
    const std = Math.sqrt(variance);
    const rms = Math.sqrt(series.reduce((a: number, b: number) => a + b * b, 0) / series.length);
    const peak = Math.max(...series.map(Math.abs));
    const crestFactor = peak / rms;
    const kurtosis =
      series.reduce((a: number, b: number) => a + ((b - mean) / (std || 1)) ** 4, 0) /
      series.length;

    const scores: Record<string, number> = {
      rms: (rms - 2.5) / 1.0,
      crest_factor: (crestFactor - 3.0) / 0.5,
      kurtosis: (kurtosis - 3.0) / 1.0,
    };
    const worstZ = Math.max(...Object.values(scores).map(Math.abs));
    const severity = worstZ > 3 ? "high" : worstZ > 2 ? "warn" : "info";

    return res.json({
      analysis: {
        severity,
        worstZ,
        scores,
        features: { rms, crest_factor: crestFactor, kurtosis, peak, mean, std },
        explanation: {
          vesselName,
          assetId,
          sampleRate,
          dataPoints: series.length,
          method: "statistical_z_score",
        },
      },
    });
  } catch (error) {
    logger.error("Error analyzing bearing data:", error);
    return res.status(500).json({ error: "Failed to analyze bearing data" });
  }
});

router.post("/analyze/pump", async (req, res) => {
  try {
    const { flow, pressure, current, vesselName, assetId } = req.body;
    const scores: Record<string, number> = {};
    const features: Record<string, number> = {};

    const analyze = (name: string, values: number[], nominal: number) => {
      if (!values || values.length === 0) {
        return;
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const deviation = Math.abs(mean - nominal) / nominal;
      scores[name] = deviation * 10;
      features[name] = mean;
    };

    if (Array.isArray(flow)) {
      analyze("flow", flow, 100);
    }
    if (Array.isArray(pressure)) {
      analyze("pressure", pressure, 4.0);
    }
    if (Array.isArray(current)) {
      analyze("current", current, 15.0);
    }

    const worstZ =
      Object.values(scores).length > 0 ? Math.max(...Object.values(scores).map(Math.abs)) : 0;
    const severity = worstZ > 3 ? "high" : worstZ > 2 ? "warn" : "info";

    return res.json({
      analysis: {
        severity,
        worstZ,
        scores,
        features,
        explanation: { vesselName, assetId, method: "pump_process_deviation" },
      },
    });
  } catch (error) {
    logger.error("Error analyzing pump data:", error);
    return res.status(500).json({ error: "Failed to analyze pump data" });
  }
});

export { router as pdmRouter };
