/**
 * Compliance Report Routes
 *
 * Maintenance and alert compliance report endpoints.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { withErrorHandling } from "../../../lib/route-utils";
import { dbMaintenanceStorage } from "../../../repositories";
import { dbAlertStorage } from "../../../repositories";

export function registerComplianceReportRoutes(
  app: Express,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit } = rateLimiters;

  app.post(
    "/api/report/compliance/maintenance",
    generalApiRateLimit,
    withErrorHandling(
      "generate maintenance compliance report",
      async (req: AuthenticatedRequest, res) => {
        const { period = "QTD", equipmentId, standard = "ISM" } = req.body;

        const periodCalculators: Record<string, () => Date> = {
          QTD: () => {
            const quarter = Math.floor(new Date().getMonth() / 3);
            return new Date(new Date().getFullYear(), quarter * 3, 1);
          },
          YTD: () => new Date(new Date().getFullYear(), 0, 1),
          MTD: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        };
        const startDate = (
          periodCalculators[period] ?? (() => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
        )();

        const equipmentFilter = equipmentId !== "all" ? equipmentId : undefined;

        const orgId = req.orgId!;
        const [maintenanceSchedules, alerts] = await Promise.all([
          dbMaintenanceStorage.getMaintenanceSchedules(equipmentFilter, orgId),
          dbAlertStorage.getAlertNotifications(false, orgId),
        ]);

        const overdue = maintenanceSchedules.filter(
          (s) => s.status === "scheduled" && new Date(s.nextScheduledDate) < new Date()
        ).length;
        const totalSchedules = maintenanceSchedules.length;
        const complianceRate =
          totalSchedules > 0 ? Math.round(((totalSchedules - overdue) / totalSchedules) * 100) : 0;

        const response = {
          metadata: {
            title: "Maintenance Compliance Report",
            generatedAt: new Date().toISOString(),
            reportType: "maintenance-compliance",
            period,
            standard,
          },
          sections: {
            summary: {
              totalMaintenanceSchedules: totalSchedules,
              overdueCount: overdue,
              complianceRate: `${complianceRate}%`,
              standard,
              reportingPeriod: period,
            },
            schedules: maintenanceSchedules.slice(0, 20),
            overdue: maintenanceSchedules
              .filter((s) => s.status === "scheduled" && new Date(s.nextScheduledDate) < new Date())
              .slice(0, 10),
            upcoming: maintenanceSchedules
              .filter(
                (s) => s.status === "scheduled" && new Date(s.nextScheduledDate) >= new Date()
              )
              .slice(0, 10),
          },
        };

        res.json(response);
      }
    )
  );

  app.post(
    "/api/report/compliance/alerts",
    generalApiRateLimit,
    withErrorHandling(
      "generate alert response compliance report",
      async (req: AuthenticatedRequest, res) => {
        const { slaHours = 24, lookbackHours = 168, standard = "SOLAS" } = req.body;

        const lookbackDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
        const orgId = req.orgId!;

        const alertNotifications = await dbAlertStorage.getAlertNotifications(undefined, orgId);

        const recentAlerts = alertNotifications.filter(
          (alert) => new Date(alert.createdAt) >= lookbackDate
        );

        const acknowledgedWithinSLA = recentAlerts.filter((alert) => {
          if (!alert.acknowledged || !alert.acknowledgedAt) {
            return false;
          }
          const responseTime =
            new Date(alert.acknowledgedAt).getTime() - new Date(alert.createdAt).getTime();
          return responseTime <= slaHours * 60 * 60 * 1000;
        }).length;

        const criticalAlerts = recentAlerts.filter((a) => a.severity === "critical").length;
        const acknowledgedAlerts = recentAlerts.filter((a) => a.acknowledged).length;
        const responseRate =
          recentAlerts.length > 0
            ? Math.round((acknowledgedAlerts / recentAlerts.length) * 100)
            : 0;
        const slaComplianceRate =
          recentAlerts.length > 0
            ? Math.round((acknowledgedWithinSLA / recentAlerts.length) * 100)
            : 0;

        const response = {
          metadata: {
            title: "Alert Response Compliance Report",
            generatedAt: new Date().toISOString(),
            reportType: "alert-compliance",
            standard,
          },
          sections: {
            summary: {
              totalAlerts: recentAlerts.length,
              acknowledgedAlerts,
              criticalAlerts,
              responseRate: `${responseRate}%`,
              slaComplianceRate: `${slaComplianceRate}%`,
              slaTarget: `${slaHours} hours`,
              standard,
              lookbackPeriod: `${lookbackHours} hours`,
            },
            recentAlerts: recentAlerts.slice(0, 20),
            critical: recentAlerts.filter((a) => a.severity === "critical").slice(0, 10),
            slaViolations: recentAlerts
              .filter((alert) => {
                if (!alert.acknowledged || !alert.acknowledgedAt) {
                  return true;
                }
                const responseTime =
                  new Date(alert.acknowledgedAt).getTime() - new Date(alert.createdAt).getTime();
                return responseTime > slaHours * 60 * 60 * 1000;
              })
              .slice(0, 10),
          },
        };

        res.json(response);
      }
    )
  );
}
