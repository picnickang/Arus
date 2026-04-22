/**
 * Compliance PDF Types - Shared types and interfaces
 */

import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";

export interface ComplianceDeps {
  getEquipmentHealth(
    orgId: string,
    filters?: { vesselId?: string; equipmentId?: string }
  ): Promise<EquipmentHealth[]>;
  getWorkOrders(equipmentId?: string, orgId?: string, filters?: any): Promise<WorkOrder[]>;
}

export interface ReportingPeriod {
  startDate: Date;
  endDate: Date;
}

export interface EquipmentComplianceOptions {
  vesselName: string;
  imoNumber: string;
  flag: string;
  reportType: "inspection" | "certification" | "audit";
  inspector: string;
}

export interface MaintenanceComplianceOptions {
  vesselName: string;
  includeWorkOrders: boolean;
  includeHealthMetrics: boolean;
}

export type RegulatoryFramework = "IMO" | "ABS" | "DNV" | "USCG";

export const FRAMEWORK_STANDARDS: Record<RegulatoryFramework, string[]> = {
  IMO: ["ABS-A1-MACHINERY"],
  ABS: ["ABS-A1-MACHINERY"],
  DNV: ["DNV-GL-OS-E101"],
  USCG: ["ABS-A1-MACHINERY", "DNV-GL-OS-E101"],
};

export interface CompliancePDFOptions {
  reportType: "equipment" | "maintenance" | "regulatory" | "fleet";
  vesselName?: string;
  imoNumber?: string;
  flag?: string;
  inspector?: string;
  regulatoryFramework?: RegulatoryFramework;
  includeWorkOrders?: boolean;
  includeHealthMetrics?: boolean;
}

export interface CompliancePDFResult {
  success: boolean;
  pdfData?: Uint8Array;
  filename: string;
  reportType: string;
  generatedAt: Date;
  error?: string;
}
