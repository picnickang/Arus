/**
 * Report Generators - Index
 */

export { FleetHealthGenerator } from './fleet-health-generator.js';
export { MaintenanceDueGenerator } from './maintenance-due-generator.js';
export { InventoryStatusGenerator } from './inventory-status-generator.js';
export { CrewComplianceGenerator } from './crew-compliance-generator.js';
export { CostSummaryGenerator } from './cost-summary-generator.js';

import type { ReportGeneratorRegistry, IReportGenerator } from '../domain/ports.js';
import type { ReportType } from '../domain/types.js';
import { FleetHealthGenerator } from './fleet-health-generator.js';
import { MaintenanceDueGenerator } from './maintenance-due-generator.js';
import { InventoryStatusGenerator } from './inventory-status-generator.js';
import { CrewComplianceGenerator } from './crew-compliance-generator.js';
import { CostSummaryGenerator } from './cost-summary-generator.js';

export class DefaultReportGeneratorRegistry implements ReportGeneratorRegistry {
  private generators: Map<ReportType, IReportGenerator> = new Map();

  constructor() {
    this.register(new FleetHealthGenerator());
    this.register(new MaintenanceDueGenerator());
    this.register(new InventoryStatusGenerator());
    this.register(new CrewComplianceGenerator());
    this.register(new CostSummaryGenerator());
  }

  get(reportType: ReportType): IReportGenerator | undefined {
    return this.generators.get(reportType);
  }

  register(generator: IReportGenerator): void {
    this.generators.set(generator.reportType, generator);
  }

  getAll(): IReportGenerator[] {
    return Array.from(this.generators.values());
  }
}
