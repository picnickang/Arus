/**
 * DTC Integration Module - Public API
 */

export * from "./types";
export { createWorkOrderFromDtc, hasRelatedOpenWorkOrder } from "./work-order-handler";
export { calculateDtcHealthImpact, getDtcSummaryForReports, calculateDtcFinancialImpact } from "./health-impact";
export { shouldTriggerAlert, createDtcAlert, correlateDtcWithTelemetry, getDtcDashboardStats } from "./alert-handler";
export { DtcIntegrationService, initDtcIntegrationService, getDtcIntegrationService } from "./service";
