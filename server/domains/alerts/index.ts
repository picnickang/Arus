/**
 * Alerts Domain
 * Public exports for alerts domain
 */
export { alertsRepository, AlertsRepository } from "./repository";
export { alertsService, AlertsService } from "./service";
export { registerAlertsRoutes } from "./routes";

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

export {
  alertRunnerService,
  runCrewAlerts,
  runCrewAlertsForAllOrgs,
} from "./alert-runner";
