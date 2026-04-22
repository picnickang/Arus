/**
 * Crew Alert Evaluators - Main Entry Point
 * Re-exports all evaluator functions
 */

export type { CrewAlertResult, EvaluationContext } from "./types.js";
export {
  getSeverityFromMinSeverity,
  getCertificationsNearExpiry,
  getUnsignedLogbooks,
} from "./helpers.js";
export { evaluateCertificateExpiryAlerts } from "./certificate-alerts.js";
export { evaluateHoRViolationAlerts } from "./hor-alerts.js";
export { evaluateMissingSignatureAlerts } from "./signature-alerts.js";
export {
  evaluateManningComplianceAlerts,
  evaluateManningComplianceAlerts as evaluateManningAlerts,
} from "./manning-alerts.js";
export { evaluateCrewChangeReminders, evaluateCrewChangeAlerts } from "./crew-change-alerts.js";

import type { CrewAlertResult, EvaluationContext } from "./types.js";
import { evaluateCertificateExpiryAlerts } from "./certificate-alerts.js";
import { evaluateHoRViolationAlerts } from "./hor-alerts.js";
import { evaluateMissingSignatureAlerts } from "./signature-alerts.js";
import { evaluateManningComplianceAlerts } from "./manning-alerts.js";
import { evaluateCrewChangeReminders } from "./crew-change-alerts.js";

export async function runAllCrewAlertEvaluators(
  ctx: EvaluationContext
): Promise<CrewAlertResult[]> {
  const [certAlerts, horAlerts, signatureAlerts, manningAlerts, crewChangeAlerts] =
    await Promise.all([
      evaluateCertificateExpiryAlerts(ctx),
      evaluateHoRViolationAlerts(ctx),
      evaluateMissingSignatureAlerts(ctx),
      evaluateManningComplianceAlerts(ctx),
      evaluateCrewChangeReminders(ctx),
    ]);
  return [...certAlerts, ...horAlerts, ...signatureAlerts, ...manningAlerts, ...crewChangeAlerts];
}

export const crewAlertEvaluators = {
  evaluateCertificateExpiryAlerts,
  evaluateHoRViolationAlerts,
  evaluateMissingSignatureAlerts,
  evaluateManningAlerts: evaluateManningComplianceAlerts,
  evaluateCrewChangeReminders,
  runAllCrewAlertEvaluators,
};
