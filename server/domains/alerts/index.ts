/**
 * Alerts Domain
 * DDD Modular Monolith with Hexagonal Architecture
 *
 * Layers:
 * - domain/: pure types, events, ports
 * - application/: use-case orchestration (service with DI)
 * - infrastructure/: port implementations (repository, event/realtime, escalation)
 * - interfaces/: HTTP routes
 *
 * Peripheral support (alert settings, crew evaluators, the alert runner, and
 * email templates) remains flat pending later remediation phases; it is
 * re-exported here unchanged.
 */

// Hexagonal layers (core: configurations, notifications, suppressions, comments)
export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./interfaces";

// Backward-compatible aliases for the pre-conversion public names.
export {
  alertsAppService as alertsService,
  AlertsApplicationService as AlertsService,
} from "./application";
export {
  alertRepository as alertsRepository,
  AlertRepositoryAdapter as AlertsRepository,
} from "./infrastructure";

// ===== Flat support (pending conversion) =====

export { alertSettingsRepository, AlertSettingsRepository } from "./settings-repository";
export { alertSettingsService, AlertSettingsService } from "./settings-service";
export { registerAlertSettingsRoutes } from "./settings-routes";

export {
  crewAlertEvaluators,
  evaluateCertificateExpiryAlerts,
  evaluateHoRViolationAlerts,
  evaluateMissingSignatureAlerts,
  evaluateManningAlerts,
  evaluateCrewChangeReminders,
  runAllCrewAlertEvaluators,
  type CrewAlertResult,
  type EvaluationContext,
} from "./crew-alert-evaluators";

export { alertRunnerService, runCrewAlerts, runCrewAlertsForAllOrgs } from "./alert-runner";
