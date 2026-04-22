/**
 * Fleet Health Report Generator
 * Generates fleet-wide equipment health summary
 */

import { vesselService, dbEquipmentStorage, dbMaintenanceStorage } from "../../../repositories";
import type { IFleetHealthGenerator } from "../domain/ports.js";
import type {
  FleetHealthData,
  VesselHealthSummary,
  EquipmentAlert,
  MaintenanceItem,
} from "../domain/types.js";
import { logger } from "../../../utils/logger.js";

const LOG_CTX = "FleetHealthGenerator";

export class FleetHealthGenerator implements IFleetHealthGenerator {
  readonly reportType = "fleet_health" as const;

  async generate(orgId: string, vesselIds: string[] | null): Promise<FleetHealthData> {
    logger.info(LOG_CTX, `Generating fleet health report for org ${orgId}`);

    const vessels = await this.getVesselHealthSummaries(orgId, vesselIds);
    const criticalEquipment = await this.getCriticalEquipment(orgId, vesselIds);
    const upcomingMaintenance = await this.getUpcomingMaintenance(orgId, vesselIds);
    const overallScore = this.calculateOverallScore(vessels);

    return {
      vessels,
      overallScore,
      criticalEquipment,
      upcomingMaintenance,
    };
  }

  private async getVesselHealthSummaries(
    orgId: string,
    vesselIds: string[] | null
  ): Promise<VesselHealthSummary[]> {
    try {
      const allVessels = await vesselService.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      const summaries: VesselHealthSummary[] = [];

      for (const vessel of filteredVessels) {
        const equipment = await dbEquipmentStorage.getEquipmentByVessel(vessel.id, orgId);

        let criticalCount = 0;
        let warningCount = 0;
        let healthSum = 0;

        for (const eq of equipment) {
          const health = (eq as any).healthScore || 100;
          healthSum += health;

          if (health < 30) {
            criticalCount++;
          } else if (health < 60) {
            warningCount++;
          }
        }

        summaries.push({
          vesselId: vessel.id,
          vesselName: vessel.name,
          healthScore: equipment.length > 0 ? Math.round(healthSum / equipment.length) : 100,
          equipmentCount: equipment.length,
          criticalCount,
          warningCount,
          lastUpdated: new Date(),
        });
      }

      return summaries;
    } catch (error) {
      logger.error(LOG_CTX, "Failed to get vessel health summaries", String(error));
      return [];
    }
  }

  private async getCriticalEquipment(
    orgId: string,
    vesselIds: string[] | null
  ): Promise<EquipmentAlert[]> {
    try {
      const alerts: EquipmentAlert[] = [];
      const allVessels = await vesselService.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      for (const vessel of filteredVessels) {
        const equipment = await dbEquipmentStorage.getEquipmentByVessel(vessel.id, orgId);

        for (const eq of equipment) {
          const health = (eq as any).healthScore || 100;

          if (health < 60) {
            alerts.push({
              equipmentId: eq.id,
              equipmentName: eq.name,
              vesselName: vessel.name,
              severity: health < 30 ? "critical" : "warning",
              issue:
                health < 30
                  ? "Critical health score - immediate attention required"
                  : "Low health score - maintenance recommended",
              predictedFailure: null,
            });
          }
        }
      }

      return alerts.sort((a, b) => (a.severity === "critical" ? -1 : 1));
    } catch (error) {
      logger.error(LOG_CTX, "Failed to get critical equipment", String(error));
      return [];
    }
  }

  private async getUpcomingMaintenance(
    orgId: string,
    vesselIds: string[] | null
  ): Promise<MaintenanceItem[]> {
    try {
      const items: MaintenanceItem[] = [];
      const allVessels = await vesselService.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      for (const vessel of filteredVessels) {
        const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, orgId, {
          status: "pending",
        } as any);

        for (const task of schedules) {
          const dueDate = (task as any).dueDate ? new Date((task as any).dueDate) : null;

          if (dueDate && dueDate <= thirtyDaysFromNow) {
            items.push({
              id: task.id,
              equipmentName: (task as any).equipmentName || "Unknown",
              vesselName: vessel.name,
              taskName: (task as any).title || (task as any).name || "Maintenance Task",
              dueDate,
              priority: (task as any).priority || "normal",
            });
          }
        }
      }

      return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    } catch (error) {
      logger.error(LOG_CTX, "Failed to get upcoming maintenance", String(error));
      return [];
    }
  }

  private calculateOverallScore(vessels: VesselHealthSummary[]): number {
    if (vessels.length === 0) {
      return 100;
    }
    const totalScore = vessels.reduce((sum, v) => sum + v.healthScore, 0);
    return Math.round(totalScore / vessels.length);
  }
}
