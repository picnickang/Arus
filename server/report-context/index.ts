/**
 * Report Context Building
 * 
 * Comprehensive context building for AI-powered reports.
 */

export * from "./types.js";
export * from "./data-fetchers.js";
export * from "./knowledge-citations.js";
export { buildVesselHealthContext } from "./vessel-health-builder.js";
export { buildFleetSummaryContext } from "./fleet-summary-builder.js";
export { buildMaintenanceContext } from "./maintenance-builder.js";
export { buildComplianceContext } from "./compliance-builder.js";
export { buildCustomContext } from "./custom-builder.js";
export { ReportContextBuilder } from "./context-builder.js";

import { ReportContextBuilder } from "./context-builder.js";
export const reportContextBuilder = new ReportContextBuilder();
