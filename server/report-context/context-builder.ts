/**
 * Report Context Builder
 *
 * Main class for building comprehensive report contexts.
 */

import type { ReportContext, ContextBuilderOptions } from "./types.js";
import { buildVesselHealthContext } from "./vessel-health-builder.js";
import { buildFleetSummaryContext } from "./fleet-summary-builder.js";
import { buildMaintenanceContext } from "./maintenance-builder.js";
import { buildComplianceContext } from "./compliance-builder.js";
import { buildCustomContext } from "./custom-builder.js";

export class ReportContextBuilder {
  async buildVesselHealthContext(
    vesselId: string,
    orgId: string = "default-org",
    options: ContextBuilderOptions = {}
  ): Promise<ReportContext> {
    return buildVesselHealthContext(vesselId, orgId, options);
  }

  async buildFleetSummaryContext(
    orgId: string = "default-org",
    options: ContextBuilderOptions = {}
  ): Promise<ReportContext> {
    return buildFleetSummaryContext(orgId, options);
  }

  async buildMaintenanceContext(
    vesselId: string | undefined,
    orgId: string = "default-org",
    options: ContextBuilderOptions = {}
  ): Promise<ReportContext> {
    return buildMaintenanceContext(vesselId, orgId, options);
  }

  async buildComplianceContext(
    vesselId: string | undefined,
    orgId: string = "default-org",
    options: ContextBuilderOptions = {}
  ): Promise<ReportContext> {
    return buildComplianceContext(vesselId, orgId, options);
  }

  async buildCustomContext(
    reportType: string,
    params: Record<string, any>,
    orgId: string = "default-org",
    options: ContextBuilderOptions = {}
  ): Promise<ReportContext> {
    return buildCustomContext(reportType, params, orgId, options);
  }
}
