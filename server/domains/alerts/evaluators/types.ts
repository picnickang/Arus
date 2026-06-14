/**
 * Crew Alert Evaluators - Types
 * Interface definitions for crew alert evaluation
 */

import type { Crew, CrewCertification, CrewAssignment } from "@shared/schema";

export interface CrewAlertResult {
  triggered: boolean;
  alertType: string;
  alertKey: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  entityId?: string;
  entityType?: "crew" | "vessel" | "certificate";
  metadata?: Record<string, unknown>;
}

/**
 * Port for the cross-domain crew data the evaluators need. Defining it here
 * (rather than importing the crew storage barrel directly) keeps the alerts
 * domain free of crew-storage coupling — the concrete adapter is wired in
 * `server/composition/alert-crew-data.ts` and injected via `EvaluationContext`.
 */
export interface ICrewAlertDataPort {
  getCrew(orgId: string, vesselId?: string): Promise<Crew[]>;
  getCrewCertifications(crewId: string, orgId: string): Promise<CrewCertification[]>;
  getCrewAssignments(orgId: string, filters: { vesselId?: string }): Promise<CrewAssignment[]>;
}

export interface EvaluationContext {
  orgId: string;
  vesselId?: string | undefined;
  now?: Date | undefined;
  /** Injected crew data accessor (see ICrewAlertDataPort). */
  crew: ICrewAlertDataPort;
}
