/**
 * Crew Alert Evaluators - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type {
  CrewAlertResult,
  EvaluationContext,
  ICrewAlertDataPort,
} from "./evaluators/index.js";
export {
  evaluateCertificateExpiryAlerts,
  evaluateHoRViolationAlerts,
  evaluateMissingSignatureAlerts,
  evaluateManningAlerts,
  evaluateCrewChangeReminders,
  runAllCrewAlertEvaluators,
  crewAlertEvaluators,
} from "./evaluators/index.js";
