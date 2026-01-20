/**
 * Maritime Compliance Excel Generator
 *
 * Generates inspector-ready Excel reports for maritime regulatory compliance.
 * Supports ISM, Class (ABS/DNV), and Flag State requirements.
 *
 * MODULARIZED: 599 lines → 6 focused modules (~35-130 lines each)
 */

export type {
  ReportingPeriod,
  EquipmentComplianceOptions,
  MaintenanceComplianceOptions,
  RegulatoryFramework,
} from './compliance-excel/types';

export { FRAMEWORK_STANDARDS } from './compliance-excel/types';
export { ComplianceExcelGenerator } from './compliance-excel/index';
