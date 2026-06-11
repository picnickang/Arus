import type { Router } from "express";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { logger } from "../utils/logger";
import type { GetDashboardUseCase } from "./application/get-dashboard.use-case";
import type { GetScheduleUseCase } from "./application/get-schedule.use-case";
import {
  dashboardFiltersSchema,
  filterRiskQueue,
  formatCsvRow,
  scheduleFiltersSchema,
} from "./routes-shared";

interface PdmExportRouteDependencies {
  getDashboardUseCase: GetDashboardUseCase;
  getScheduleUseCase: GetScheduleUseCase;
}

export function registerPdmExportRoutes(
  router: Router,
  { getDashboardUseCase, getScheduleUseCase }: PdmExportRouteDependencies
): void {
  router.get("/export/schedule", async (req, res) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const format = (req.query["format"] as string) || "csv";
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
            task.scheduledDate ? new Date(task.scheduledDate).toISOString().split("T")[0] : "",
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
      }
      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", "attachment; filename=pdm-schedule-export.json");
        return res.json(allTasks);
      }
      return res.status(400).json({ error: "Invalid format. Supported: csv, json" });
    } catch (error) {
      logger.error("Error exporting schedule:", error);
      return res.status(500).json({ error: "Failed to export schedule" });
    }
  });

  router.get("/export/risk-queue", async (req, res) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const format = (req.query["format"] as string) || "csv";
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
      }
      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", "attachment; filename=risk-queue-export.json");
        return res.json(allItems);
      }
      return res.status(400).json({ error: "Invalid format. Supported: csv, json" });
    } catch (error) {
      logger.error("Error exporting risk queue:", error);
      return res.status(500).json({ error: "Failed to export risk queue" });
    }
  });

  router.get("/export/kpis", async (req, res) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const format = (req.query["format"] as string) || "json";

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
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=kpis-export.json");
      return res.json(kpis);
    } catch (error) {
      logger.error("Error exporting KPIs:", error);
      return res.status(500).json({ error: "Failed to export KPIs" });
    }
  });
}
