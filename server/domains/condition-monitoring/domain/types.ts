/**
 * Condition Monitoring Domain - Types
 *
 * Entity/command types alias the canonical schema types; the storage layer
 * already returns these shapes (behaviour-preserving — see the alerts/
 * notifications reference and the remediation plan §3).
 */

import type {
  OilAnalysis,
  InsertOilAnalysis,
  WearParticleAnalysis,
  InsertWearParticleAnalysis,
  ConditionMonitoring,
  InsertConditionMonitoring,
  OilChangeRecord,
  InsertOilChangeRecord,
} from "@shared/schema";

export type {
  OilAnalysis,
  InsertOilAnalysis,
  WearParticleAnalysis,
  InsertWearParticleAnalysis,
  ConditionMonitoring,
  InsertConditionMonitoring,
  OilChangeRecord,
  InsertOilChangeRecord,
};

/** Input for the derived condition-assessment generation use case. */
export interface GenerateAssessmentInput {
  oilAnalysisId: string;
  wearAnalysisId?: string | undefined;
  vibrationScore?: number | undefined;
}
