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

interface DossierWorkOrder {
  status?: string;
  reason?: string;
}
interface DossierAlert {
  equipmentId?: string;
  alertType?: string;
  acknowledged?: boolean;
  sensorType?: string;
}
interface DossierPdmScore {
  score: number;
}
interface DossierMaintenanceRecord {
  maintenanceType?: string | null;
}

export interface DossierStorage {
  getWorkOrders?: (equipmentId: string) => Promise<unknown[]>;
  getAlertNotifications?: () => Promise<unknown[]>;
  getPdmScores?: (equipmentId: string) => Promise<unknown[]>;
  getMaintenanceRecords?: (equipmentId: string) => Promise<unknown[]>;
}

const asWorkOrder = (v: unknown): DossierWorkOrder =>
  typeof v === "object" && v !== null ? (v as DossierWorkOrder) : {};
const asAlert = (v: unknown): DossierAlert =>
  typeof v === "object" && v !== null ? (v as DossierAlert) : {};
const asPdm = (v: unknown): DossierPdmScore => {
  if (typeof v === "object" && v !== null && "score" in v) {
    const s = (v as { score: unknown }).score;
    if (typeof s === "number") return { score: s };
  }
  return { score: 0 };
};
const asMaintenance = (v: unknown): DossierMaintenanceRecord =>
  typeof v === "object" && v !== null ? (v as DossierMaintenanceRecord) : {};

/**
 * Build comprehensive equipment dossiers with contextual data
 */
export async function buildEquipmentDossiers(
  equipmentHealthData: EquipmentHealth[],
  storageInstance: DossierStorage | null | undefined
): Promise<EquipmentDossier[]> {
  return Promise.all(
    equipmentHealthData.map(async (equipment) => {
      let workOrders: DossierWorkOrder[] = [];
      let alerts: DossierAlert[] = [];
      let pdmHistory: DossierPdmScore[] = [];
      let maintenanceRecords: DossierMaintenanceRecord[] = [];

      if (storageInstance) {
        try {
          if (typeof storageInstance.getWorkOrders === "function") {
            const raw = await storageInstance.getWorkOrders(equipment.id);
            workOrders = raw.map(asWorkOrder);
          }
        } catch (error) {
          logger.warn(`Failed to get work orders for ${equipment.id}:`, { details: error });
        }

        try {
          if (typeof storageInstance.getAlertNotifications === "function") {
            const allAlerts = (await storageInstance.getAlertNotifications()).map(asAlert);
            alerts = allAlerts.filter((a) => a.equipmentId === equipment.id).slice(0, 20);
          }
        } catch (error) {
          logger.warn(`Failed to get alerts for ${equipment.id}:`, { details: error });
        }

        try {
          if (typeof storageInstance.getPdmScores === "function") {
            const raw = await storageInstance.getPdmScores(equipment.id);
            pdmHistory = raw.map(asPdm).slice(-10);
          }
        } catch (error) {
          logger.warn(`Failed to get PdM scores for ${equipment.id}:`, { details: error });
        }

        try {
          if (typeof storageInstance.getMaintenanceRecords === "function") {
            const raw = await storageInstance.getMaintenanceRecords(equipment.id);
            maintenanceRecords = raw.map(asMaintenance).slice(-5);
          }
        } catch (error) {
          logger.warn(`Failed to get maintenance records for ${equipment.id}:`, { details: error });
        }
      }

      const lastPdm = pdmHistory[pdmHistory.length - 1];
      const firstPdm = pdmHistory[0];
      const lastMaintenance = maintenanceRecords[maintenanceRecords.length - 1];

      return {
        ...equipment,
        context: {
          workOrderStats: {
            total: workOrders.length,
            openCount: workOrders.filter((wo) => wo.status === "open").length,
            recentReasons: workOrders
              .slice(-3)
              .map((wo) => (typeof wo.reason === "string" ? wo.reason : ""))
              .filter((r) => r.length > 0),
          },
          alertPattern: {
            total: alerts.length,
            critical: alerts.filter((a) => a.alertType === "critical").length,
            unacknowledged: alerts.filter((a) => !a.acknowledged).length,
            topAlertTypes: [
              ...new Set(
                alerts
                  .slice(-5)
                  .map((a) => a.sensorType)
                  .filter((s): s is string => typeof s === "string")
              ),
            ],
          },
          pdmTrend: {
            current: equipment.healthIndex,
            degradationRate:
              pdmHistory.length > 1 && lastPdm && firstPdm
                ? (lastPdm.score - firstPdm.score) / pdmHistory.length
                : 0,
            hasHistory: pdmHistory.length > 0,
            worstScore:
              pdmHistory.length > 0
                ? Math.min(...pdmHistory.map((p) => p.score))
                : equipment.healthIndex,
          },
          maintenanceSummary: {
            totalRecords: maintenanceRecords.length,
            lastMaintenanceType: lastMaintenance?.maintenanceType ?? null,
            hasRecentMaintenance: maintenanceRecords.length > 0,
          },
        },
      } as EquipmentDossier;
    })
  );
}
