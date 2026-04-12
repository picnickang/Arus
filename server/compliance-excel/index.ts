/**
 * Compliance Excel Module - Re-exports
 *
 * MODULARIZED: 599 lines → 6 focused modules (~35-130 lines each)
 */

import type { IStorage } from '../repositories.js';
import type {
  ReportingPeriod,
  EquipmentComplianceOptions,
  MaintenanceComplianceOptions,
  RegulatoryFramework,
} from './types';
import { generateEquipmentComplianceExcel } from './equipment-compliance';
import { generateMaintenanceComplianceExcel } from './maintenance-compliance';
import { generateRegulatoryComplianceExcel } from './regulatory-compliance';
import { generateFleetComplianceOverviewExcel } from './fleet-compliance';

export type {
  ReportingPeriod,
  EquipmentComplianceOptions,
  MaintenanceComplianceOptions,
  RegulatoryFramework,
} from './types';

export { FRAMEWORK_STANDARDS } from './types';

export class ComplianceExcelGenerator {
  constructor(private storage: IStorage) {}

  async generateEquipmentComplianceExcel(
    orgId: string,
    equipmentIds: string[],
    standardCodes: string[],
    reportingPeriod: ReportingPeriod,
    options: EquipmentComplianceOptions
  ): Promise<Buffer> {
    return generateEquipmentComplianceExcel(
      this.storage,
      orgId,
      equipmentIds,
      standardCodes,
      reportingPeriod,
      options
    );
  }

  async generateMaintenanceComplianceExcel(
    orgId: string,
    vesselId: string,
    period: ReportingPeriod,
    options: MaintenanceComplianceOptions
  ): Promise<Buffer> {
    return generateMaintenanceComplianceExcel(this.storage, orgId, vesselId, period, options);
  }

  async generateRegulatoryComplianceExcel(
    orgId: string,
    regulatoryFramework: RegulatoryFramework,
    equipmentIds: string[],
    period: ReportingPeriod
  ): Promise<Buffer> {
    return generateRegulatoryComplianceExcel(
      this.storage,
      orgId,
      regulatoryFramework,
      equipmentIds,
      period
    );
  }

  async generateFleetComplianceOverviewExcel(orgId: string, period: ReportingPeriod): Promise<Buffer> {
    return generateFleetComplianceOverviewExcel(this.storage, orgId, period);
  }
}
