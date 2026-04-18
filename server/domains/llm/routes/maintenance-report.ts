/**
 * Maintenance Report Routes
 * 
 * Maintenance report generation endpoint.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling } from "../../../lib/route-utils";
import { dbMaintenanceStorage, dbEquipmentStorage, workOrderService } from "../../../repositories";

export function registerMaintenanceReportRoutes(
  app: Express,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit } = rateLimiters;

  app.post("/api/report/maintenance", generalApiRateLimit,
    withErrorHandling("generate maintenance report", async (req, res) => {
      const { vesselId, equipmentId } = req.body;

      const [maintenanceSchedules, maintenanceRecords, workOrders, equipmentHealth] =
        await Promise.all([
          dbMaintenanceStorage.getMaintenanceSchedules(),
          dbMaintenanceStorage.getMaintenanceRecords(),
          workOrderService.getWorkOrdersWithDetails(),
          dbEquipmentStorage.getEquipmentHealth(),
        ]);

      const filteredSchedules = equipmentId
        ? maintenanceSchedules.filter((ms) => ms.equipmentId === equipmentId)
        : vesselId
          ? maintenanceSchedules.filter((ms) => {
              const equipment = equipmentHealth.find((eh) => eh.id === ms.equipmentId);
              return equipment?.vessel === vesselId;
            })
          : maintenanceSchedules;

      const filteredRecords = equipmentId
        ? maintenanceRecords.filter((mr) => mr.equipmentId === equipmentId)
        : maintenanceRecords;

      const now = new Date();
      const overdueSchedules = filteredSchedules.filter(
        (s) => new Date(s.nextScheduledDate) < now && s.status !== "completed"
      );
      const upcomingSchedules = filteredSchedules.filter((s) => {
        const schedDate = new Date(s.nextScheduledDate);
        return schedDate > now && schedDate < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      });

      res.json({
        metadata: {
          title: "Maintenance Report",
          generatedAt: new Date().toISOString(),
          reportType: "maintenance",
          equipmentFilter: equipmentId || vesselId || "all",
        },
        sections: {
          summary: {
            totalSchedules: filteredSchedules.length,
            overdueCount: overdueSchedules.length,
            upcomingCount: upcomingSchedules.length,
            completedThisMonth: filteredRecords.filter(
              (r) => new Date(r.completedDate) > new Date(now.getFullYear(), now.getMonth(), 1)
            ).length,
          },
          schedules: filteredSchedules,
          records: filteredRecords.slice(0, 50),
          overdue: overdueSchedules,
          upcoming: upcomingSchedules,
        },
      });
    })
  );
}
