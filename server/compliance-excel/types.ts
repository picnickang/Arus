/**
 * Compliance Excel Types - Shared types and interfaces
 */

export interface ReportingPeriod {
  startDate: Date;
  endDate: Date;
}

export interface VesselInfo {
  vesselName: string;
  imoNumber?: string;
  flag?: string;
}

export interface EquipmentComplianceOptions extends VesselInfo {
  imoNumber: string;
  flag: string;
  reportType: 'inspection' | 'certification' | 'audit';
  inspector?: string;
}

export interface MaintenanceComplianceOptions {
  vesselName: string;
  includeWorkOrders: boolean;
  includeHealthMetrics: boolean;
}

export type RegulatoryFramework = 'IMO' | 'ABS' | 'DNV' | 'USCG';

export const FRAMEWORK_STANDARDS: Record<RegulatoryFramework, string[]> = {
  IMO: ['ABS-A1-MACHINERY'],
  ABS: ['ABS-A1-MACHINERY'],
  DNV: ['DNV-GL-OS-E101'],
  USCG: ['ABS-A1-MACHINERY', 'DNV-GL-OS-E101'],
};
