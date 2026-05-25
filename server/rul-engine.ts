/**
 * Legacy RUL engine shim.
 *
 * The original implementation was migrated into the ml-pipeline domain.
 * The consumer routes still reference this module; we keep a minimal class
 * here that returns null/empty results so callers can degrade gracefully.
 */

export interface RulPrediction {
  equipmentId: string;
  rulHours: number;
  confidence: number;
  predictedAt: Date;
}

export interface DegradationSnapshot {
  degradationMetric?: number | undefined;
  vibrationLevel?: number | undefined;
  [k: string]: unknown;
}

export class RulEngine {
  // db parameter intentionally unused — kept to match the old constructor shape
  constructor(_db: unknown) {}

  async calculateRul(_equipmentId: string, _orgId: string): Promise<RulPrediction | null> {
    return null;
  }

  async calculateBatchRul(
    _equipmentIds: string[],
    _orgId: string
  ): Promise<Map<string, RulPrediction>> {
    return new Map<string, RulPrediction>();
  }

  async recordDegradation(
    _orgId: string,
    _equipmentId: string,
    _componentType: string,
    _snapshot: DegradationSnapshot
  ): Promise<void> {
    // no-op
  }
}
