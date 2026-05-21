/**
 * Maintenance Report Routes
 *
 * Maintenance report generation endpoint.
 */

import { Express, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";
import { withErrorHandling } from "../../../lib/route-utils";
import { dbMaintenanceStorage, dbEquipmentStorage, workOrderService } from "../../../repositories";
import { AuthenticatedRequest } from "../../../middleware/auth";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const maintenanceReportBodySchema = z.object({
  vesselId: z.string().optional(),
  equipmentId: z.string().optional(),
});

export function registerMaintenanceReportRoutes(
  app: Express,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit } = rateLimiters;

  app.post(
    "/api/report/maintenance",
    generalApiRateLimit,
    withErrorHandling("generate maintenance report", async (req: AuthenticatedRequest, res: Response) => {
      const { vesselId, equipmentId } = maintenanceReportBodySchema.parse(req.body);
      const orgId = req.orgId ?? DEFAULT_ORG_ID;

      const [maintenanceSchedules, maintenanceRecords, workOrders, equipmentHealth] =
        await Promise.all([
          dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId),
          dbMaintenanceStorage.getMaintenanceRecords(undefined, orgId),
          workOrderService.getWorkOrdersWithDetails(),
          dbEquipmentStorage.getEquipmentHealth(orgId),
        ]);

      const filteredSchedules = equipmentId
        ? maintenanceSchedules.filter((ms) => ms.equipmentId === equipmentId)
        : vesselId
          ? maintenanceSchedules.filter((ms) => {
              const equipment = equipmentHealth.find((eh) => eh.id === ms.equipmentId);
              return equipment?.vesselId === vesselId;
            })
          : maintenanceSchedules;

      const filteredRecords = equipmentId
        ? maintenanceRecords.filter((mr) => mr.equipmentId === equipmentId)
        : maintenanceRecords;

      const now = new Date();
      const overdueSchedules = filteredSchedules.filter(
        (s) => s.scheduledDate != null && new Date(s.scheduledDate) < now && s.status !== "completed"
      );
      const upcomingSchedules = filteredSchedules.filter((s) => {
        if (s.scheduledDate == null) {
          return false;
        }
        const schedDate = new Date(s.scheduledDate);
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
              (r) => r.createdAt != null && new Date(r.createdAt) > new Date(now.getFullYear(), now.getMonth(), 1)
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
