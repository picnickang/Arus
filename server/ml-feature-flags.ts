/**
 * Feature Flags System for ML Features — consolidated implementation.
 *
 * Replaces the previous ./ml-feature-flags/* modular split. Public surface
 * is preserved; runtime behaviour is a minimal in-memory manager that
 * always treats flags as disabled-by-default unless explicitly initialized.
 */

export interface FeatureFlagConfig {
  key: string;
  enabled: boolean;
  rolloutPercentage?: number;
  description?: string;
}

export interface FeatureFlagEvaluation {
  key: string;
  enabled: boolean;
  reason: string;
}

export interface FeatureFlagContext {
  orgId?: string;
  equipmentId?: string;
  userId?: string;
}

export interface FeatureFlagSummary {
  total: number;
  enabled: number;
  flags: FeatureFlagConfig[];
}

export interface RolloutSchedule {
  key: string;
  startAt: Date;
  endAt: Date;
  startPercentage: number;
  endPercentage: number;
}

export const ML_FEATURE_FLAGS = {
  LSTM_PREDICTION: "lstm_prediction",
  RF_CLASSIFICATION: "rf_classification",
  XGBOOST_CLASSIFICATION: "xgboost_classification",
  ENSEMBLE_PREDICTION: "ensemble_prediction",
  EXPLAINABILITY: "explainability",
  CALIBRATION: "calibration",
} as const;

export function createDefaultFlags(): FeatureFlagConfig[] {
  return Object.values(ML_FEATURE_FLAGS).map((key) => ({
    key,
    enabled: false,
    rolloutPercentage: 0,
  }));
}

export class FeatureFlagManager {
  private flags = new Map<string, FeatureFlagConfig>();

  initialize(configs: FeatureFlagConfig[]): void {
    this.flags.clear();
    for (const c of configs) {this.flags.set(c.key, c);}
  }

  isEnabled(key: string, _ctx?: FeatureFlagContext): boolean {
    return this.flags.get(key)?.enabled ?? false;
  }

  evaluate(key: string, ctx?: FeatureFlagContext): FeatureFlagEvaluation {
    const enabled = this.isEnabled(key, ctx);
    return { key, enabled, reason: enabled ? "flag enabled" : "flag disabled" };
  }

  summary(): FeatureFlagSummary {
    const flags = Array.from(this.flags.values());
    return { total: flags.length, enabled: flags.filter((f) => f.enabled).length, flags };
  }
}

export const featureFlagManager = new FeatureFlagManager();

export class GradualRollout {
  private schedules = new Map<string, RolloutSchedule>();

  schedule(s: RolloutSchedule): void {
    this.schedules.set(s.key, s);
  }

  currentPercentage(key: string, now: Date = new Date()): number {
    const s = this.schedules.get(key);
    if (!s) {return 0;}
    if (now <= s.startAt) {return s.startPercentage;}
    if (now >= s.endAt) {return s.endPercentage;}
    const range = s.endAt.getTime() - s.startAt.getTime();
    const elapsed = now.getTime() - s.startAt.getTime();
    return s.startPercentage + ((s.endPercentage - s.startPercentage) * elapsed) / range;
  }
}

export const gradualRollout = new GradualRollout();

export function isFeatureEnabled(key: string, ctx?: FeatureFlagContext): boolean {
  return featureFlagManager.isEnabled(key, ctx);
}

export async function initializeFeatureFlags(
  configs: FeatureFlagConfig[] = createDefaultFlags()
): Promise<void> {
  featureFlagManager.initialize(configs);
}

export function getFeatureFlags(): FeatureFlagSummary {
  return featureFlagManager.summary();
}
