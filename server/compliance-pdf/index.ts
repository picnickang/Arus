/**
 * Compliance PDF Module - Re-exports
 *
 * MODULARIZED: 595 lines → 6 focused modules (~50-130 lines each)
 */

import type { IStorage } from '../repositories.js';
import type {
  ReportingPeriod,
  EquipmentComplianceOptions,
  MaintenanceComplianceOptions,
  RegulatoryFramework,
} from './types';
import { generateEquipmentCompliancePDF } from './equipment-compliance';
import { generateMaintenanceCompliancePDF } from './maintenance-compliance';
import { generateRegulatoryCompliancePDF } from './regulatory-compliance';
import { generateFleetComplianceOverviewPDF } from './fleet-compliance';

export type {
  ReportingPeriod,
  EquipmentComplianceOptions,
  MaintenanceComplianceOptions,
  RegulatoryFramework,
  CompliancePDFOptions,
  CompliancePDFResult,
} from './types';

export { FRAMEWORK_STANDARDS } from './types';

export class CompliancePDFGenerator {
  constructor(private storage: IStorage) {}

  async generateEquipmentCompliancePDF(
    orgId: string,
    equipmentIds: string[],
    standardCodes: string[],
    reportingPeriod: ReportingPeriod,
    options: EquipmentComplianceOptions
  ): Promise<Uint8Array> {
    return generateEquipmentCompliancePDF(
      this.storage,
      orgId,
      equipmentIds,
      standardCodes,
      reportingPeriod,
      options
    );
  }

  async generateMaintenanceCompliancePDF(
    orgId: string,
    vesselId: string,
    period: ReportingPeriod,
    options: MaintenanceComplianceOptions
  ): Promise<Uint8Array> {
    return generateMaintenanceCompliancePDF(this.storage, orgId, vesselId, period, options);
  }

  async generateRegulatoryCompliancePDF(
    orgId: string,
    regulatoryFramework: RegulatoryFramework,
    equipmentIds: string[],
    period: ReportingPeriod
  ): Promise<Uint8Array> {
    return generateRegulatoryCompliancePDF(
      this.storage,
      orgId,
      regulatoryFramework,
      equipmentIds,
      period
    );
  }

  async generateFleetComplianceOverviewPDF(orgId: string, period: ReportingPeriod): Promise<Uint8Array> {
    return generateFleetComplianceOverviewPDF(this.storage, orgId, period);
  }
}
