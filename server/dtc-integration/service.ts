/**
 * DTC Integration Service Class
 */

import type { IStorage } from "../storage";
import type { DtcWithDefinition, DtcSummary, DtcFinancialImpact, DtcDashboardStats } from "./types";
import { createWorkOrderFromDtc } from "./work-order-handler";
import { calculateDtcHealthImpact, getDtcSummaryForReports, calculateDtcFinancialImpact } from "./health-impact";
import { shouldTriggerAlert, createDtcAlert, correlateDtcWithTelemetry, getDtcDashboardStats } from "./alert-handler";

export class DtcIntegrationService {
  constructor(private storage: IStorage) {}

  async createWorkOrderFromDtc(dtc: DtcWithDefinition, orgId: string): Promise<any | null> {
    return createWorkOrderFromDtc(this.storage, dtc, orgId);
  }

  calculateDtcHealthImpact(activeDtcs: DtcWithDefinition[]): number {
    return calculateDtcHealthImpact(activeDtcs);
  }

  async getDtcSummaryForReports(equipmentId: string, orgId: string): Promise<DtcSummary> {
    return getDtcSummaryForReports(this.storage, equipmentId, orgId);
  }

  async calculateDtcFinancialImpact(vesselId: string, orgId: string): Promise<DtcFinancialImpact> {
    return calculateDtcFinancialImpact(this.storage, vesselId, orgId);
  }

  shouldTriggerAlert(dtc: DtcWithDefinition): boolean {
    return shouldTriggerAlert(dtc);
  }

  async createDtcAlert(dtc: DtcWithDefinition, orgId: string): Promise<any | null> {
    return createDtcAlert(this.storage, dtc, orgId);
  }

  async correlateDtcWithTelemetry(dtc: DtcWithDefinition, orgId: string, timeWindowMinutes: number = 60): Promise<any[]> {
    return correlateDtcWithTelemetry(this.storage, dtc, orgId, timeWindowMinutes);
  }

  async getDtcDashboardStats(orgId: string): Promise<DtcDashboardStats> {
    return getDtcDashboardStats(this.storage, orgId);
  }
}

let dtcServiceInstance: DtcIntegrationService | null = null;

export function initDtcIntegrationService(storage: IStorage): DtcIntegrationService {
  if (!dtcServiceInstance) {
    dtcServiceInstance = new DtcIntegrationService(storage);
    console.log("[DTC Integration] Service initialized");
  }
  return dtcServiceInstance;
}

export function getDtcIntegrationService(): DtcIntegrationService {
  if (!dtcServiceInstance) { throw new Error("[DTC Integration] Service not initialized"); }
  return dtcServiceInstance;
}
