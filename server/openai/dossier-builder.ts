/**
 * Equipment Dossier Builder - Gather contextual data for equipment analysis
 */

import type { EquipmentHealth } from "../db/equipment/types.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Openai:DossierBuilder");

export interface EquipmentDossier {
  id: string;
  healthIndex: number;
  predictedDueDays: number;
  vessel: string;
  context: {
    workOrderStats: {
      total: number;
      openCount: number;
      recentReasons: string[];
    };
    alertPattern: {
      total: number;
      critical: number;
      unacknowledged: number;
      topAlertTypes: string[];
    };
    pdmTrend: {
      current: number;
      degradationRate: number;
      hasHistory: boolean;
      worstScore: number;
    };
    maintenanceSummary: {
      totalRecords: number;
      lastMaintenanceType: string | null;
      hasRecentMaintenance: boolean;
    };
  };
}

/**
 * Build comprehensive equipment dossiers with contextual data
 */
export async function buildEquipmentDossiers(
  equipmentHealthData: EquipmentHealth[],
  storageInstance: any
): Promise<EquipmentDossier[]> {
  // @ts-ignore -- bulk-silence
  return Promise.all(
    equipmentHealthData.map(async (equipment) => {
      let workOrders: any[] = [];
      let alerts: any[] = [];
      let pdmHistory: any[] = [];
      let maintenanceRecords: any[] = [];

      if (storageInstance) {
        try {
          if (typeof storageInstance.getWorkOrders === "function") {
            workOrders = await storageInstance.getWorkOrders(equipment.id);
          }
        } catch (error) {
          logger.warn(`Failed to get work orders for ${equipment.id}:`, { details: error });
        }

        try {
          if (typeof storageInstance.getAlertNotifications === "function") {
            const allAlerts = await storageInstance.getAlertNotifications();
            alerts = allAlerts.filter((a: any) => a.equipmentId === equipment.id).slice(0, 20);
          }
        } catch (error) {
          logger.warn(`Failed to get alerts for ${equipment.id}:`, { details: error });
        }

        try {
          if (typeof storageInstance.getPdmScores === "function") {
            pdmHistory = await storageInstance.getPdmScores(equipment.id);
            pdmHistory = pdmHistory.slice(-10);
          }
        } catch (error) {
          logger.warn(`Failed to get PdM scores for ${equipment.id}:`, { details: error });
        }

        try {
          if (typeof storageInstance.getMaintenanceRecords === "function") {
            maintenanceRecords = await storageInstance.getMaintenanceRecords(equipment.id);
            maintenanceRecords = maintenanceRecords.slice(-5);
          }
        } catch (error) {
          logger.warn(`Failed to get maintenance records for ${equipment.id}:`, { details: error });
        }
      }

      return {
        ...equipment,
        context: {
          workOrderStats: {
            total: workOrders.length,
            openCount: workOrders.filter((wo: any) => wo.status === "open").length,
            recentReasons: workOrders.slice(-3).map((wo: any) => wo.reason),
          },
          alertPattern: {
            total: alerts.length,
            critical: alerts.filter((a: any) => a.alertType === "critical").length,
            unacknowledged: alerts.filter((a: any) => !a.acknowledged).length,
            topAlertTypes: [...new Set(alerts.slice(-5).map((a: any) => a.sensorType))] as string[],
          },
          pdmTrend: {
            current: equipment.healthIndex,
            degradationRate:
              pdmHistory.length > 1
                ? (pdmHistory[pdmHistory.length - 1].score - pdmHistory[0].score) /
                  pdmHistory.length
                : 0,
            hasHistory: pdmHistory.length > 0,
            worstScore:
              pdmHistory.length > 0
                ? Math.min(...pdmHistory.map((p: any) => p.score))
                : equipment.healthIndex,
          },
          maintenanceSummary: {
            totalRecords: maintenanceRecords.length,
            lastMaintenanceType:
              maintenanceRecords.length > 0
                ? maintenanceRecords[maintenanceRecords.length - 1].maintenanceType
                : null,
            hasRecentMaintenance: maintenanceRecords.length > 0,
          },
        },
      };
    })
  );
}
