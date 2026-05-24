/**
 * DTC Integration Service Class
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("DtcIntegration:Service");
import type { DtcWithDefinition, DtcSummary, DtcFinancialImpact, DtcDashboardStats } from "./types";
import { createWorkOrderFromDtc } from "./work-order-handler";
import {
  calculateDtcHealthImpact,
  getDtcSummaryForReports,
  calculateDtcFinancialImpact,
} from "./health-impact";
import {
  shouldTriggerAlert,
  createDtcAlert,
  correlateDtcWithTelemetry,
  getDtcDashboardStats,
} from "./alert-handler";

export class DtcIntegrationService {
  async createWorkOrderFromDtc(
    dtc: DtcWithDefinition,
    orgId: string
  ): Promise<Awaited<ReturnType<typeof createWorkOrderFromDtc>>> {
    return createWorkOrderFromDtc(dtc, orgId);
  }

  calculateDtcHealthImpact(activeDtcs: DtcWithDefinition[]): number {
    return calculateDtcHealthImpact(activeDtcs);
  }

  async getDtcSummaryForReports(equipmentId: string, orgId: string): Promise<DtcSummary> {
    return getDtcSummaryForReports(equipmentId, orgId);
  }

  async calculateDtcFinancialImpact(vesselId: string, orgId: string): Promise<DtcFinancialImpact> {
    return calculateDtcFinancialImpact(vesselId, orgId);
  }

  shouldTriggerAlert(dtc: DtcWithDefinition): boolean {
    return shouldTriggerAlert(dtc);
  }

  async createDtcAlert(
    dtc: DtcWithDefinition,
    orgId: string
  ): Promise<Awaited<ReturnType<typeof createDtcAlert>>> {
    return createDtcAlert(dtc, orgId);
  }

  async correlateDtcWithTelemetry(
    dtc: DtcWithDefinition,
    orgId: string,
    timeWindowMinutes: number = 60
  ): Promise<Awaited<ReturnType<typeof correlateDtcWithTelemetry>>> {
    return correlateDtcWithTelemetry(dtc, orgId, timeWindowMinutes);
  }

  async getDtcDashboardStats(orgId: string): Promise<DtcDashboardStats> {
    return getDtcDashboardStats(orgId);
  }
}

let dtcServiceInstance: DtcIntegrationService | null = null;

export function initDtcIntegrationService(): DtcIntegrationService {
  if (!dtcServiceInstance) {
    dtcServiceInstance = new DtcIntegrationService();
    logger.info("[DTC Integration] Service initialized");
  }
  return dtcServiceInstance;
}

export function getDtcIntegrationService(): DtcIntegrationService {
  if (!dtcServiceInstance) {
    throw new Error("[DTC Integration] Service not initialized");
  }
  return dtcServiceInstance;
}
