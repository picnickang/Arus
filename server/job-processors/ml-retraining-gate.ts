export interface TrainerMetrics {
  mae?: number;
  productionMae?: number;
  psi?: number;
  artifactPath?: string;
  modelId?: string;
}

export interface PromotionGateDecision {
  promote: boolean;
  improvementPct?: number | undefined;
  skipped?: string | undefined;
}

const MIN_MAE_IMPROVEMENT_PCT = 5;
const MAX_PSI_FOR_PROMOTION = 0.25;

/** Push A1 — pure gate predicate, exported so tests can drive the same
 *  logic the weekly job runs without importing DB-bearing orchestration. */
export function evaluatePromotionGate(metrics: TrainerMetrics): PromotionGateDecision {
  const improvementPct =
    metrics.mae != null && metrics.productionMae != null && metrics.productionMae > 0
      ? ((metrics.productionMae - metrics.mae) / metrics.productionMae) * 100
      : undefined;
  if (!metrics.modelId) {
    return { promote: false, improvementPct, skipped: "trainer did not register a candidate model" };
  }
  const maeOk = improvementPct != null && improvementPct >= MIN_MAE_IMPROVEMENT_PCT;
  if (!maeOk) {
    return {
      promote: false,
      improvementPct,
      skipped: `MAE improvement ${improvementPct?.toFixed(2)}% < ${MIN_MAE_IMPROVEMENT_PCT}%`,
    };
  }
  const psiOk = metrics.psi == null || metrics.psi < MAX_PSI_FOR_PROMOTION;
  if (!psiOk) {
    return {
      promote: false,
      improvementPct,
      skipped: `PSI ${metrics.psi?.toFixed(3)} >= ${MAX_PSI_FOR_PROMOTION}`,
    };
  }
  return { promote: true, improvementPct };
}

export function parseTrainerMetrics(stdout: string): TrainerMetrics {
  const metrics: TrainerMetrics = {};
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {continue;}
    try {
      const json = JSON.parse(trimmed);
      if (json.stage === "metrics" || json.stage === "complete") {
        if (typeof json.mae === "number") {metrics.mae = json.mae;}
        if (typeof json.productionMae === "number") {metrics.productionMae = json.productionMae;}
        if (typeof json.psi === "number") {metrics.psi = json.psi;}
        if (typeof json.artifactPath === "string") {metrics.artifactPath = json.artifactPath;}
        if (typeof json.modelId === "string") {metrics.modelId = json.modelId;}
      }
    } catch {
      // Ignore non-metrics JSON fragments and noisy trainer output.
    }
  }
  return metrics;
}
