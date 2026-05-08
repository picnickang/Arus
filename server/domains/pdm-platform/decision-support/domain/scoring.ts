import type {
  EquipmentFeatureSnapshot,
  NormalizedOperationalContext,
  PdmHealthStatus,
  PdmProbabilities,
  PerformanceIndicators,
} from "./types";

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latest(features: EquipmentFeatureSnapshot[]): EquipmentFeatureSnapshot | null {
  return features.length > 0 ? features[0] : null;
}

export function computePerformanceIndicators(
  features: EquipmentFeatureSnapshot[],
  context: NormalizedOperationalContext,
  requiredSequenceLength: number
): PerformanceIndicators {
  const current = latest(features);
  const sequenceLength = features.length;
  const dataQualityScore = clamp(
    sequenceLength / Math.max(requiredSequenceLength, 1) +
      (safeNumber(current?.sampleCount, 0) > 0 ? 0.15 : -0.1) -
      (current?.timestamp ? 0 : 0.2)
  );

  const loadFloor = Math.max(context.loadFactor, 0.35);
  const meanVibration = safeNumber(current?.rmsVibration, safeNumber(current?.meanVibration, 0));
  const meanTemp = safeNumber(current?.meanTemp, 0);
  const meanPressure = safeNumber(current?.meanPressure, 0);

  const loadNormalizedVibration = meanVibration > 0 ? round(meanVibration / loadFloor, 3) : null;
  const loadNormalizedTemperature = meanTemp > 0 ? round(meanTemp / loadFloor, 3) : null;

  const vibrationPenalty = clamp(((loadNormalizedVibration ?? 0) - 3.5) / 5);
  const tempPenalty = clamp(((loadNormalizedTemperature ?? 0) - 90) / 80);
  const pressurePenalty = meanPressure > 0 ? clamp((120 - meanPressure) / 120) : 0;
  const fuelPenaltyScore = context.fuelBurnRate
    ? clamp((context.fuelBurnRate / Math.max(context.shaftPower ?? 1, 1) - 0.22) / 0.35)
    : 0;

  const efficiencyLossPercent = round(
    clamp(vibrationPenalty * 0.35 + tempPenalty * 0.35 + pressurePenalty * 0.15 + fuelPenaltyScore * 0.15) *
      100,
    1
  );

  return {
    efficiencyLossPercent,
    loadNormalizedVibration,
    loadNormalizedTemperature,
    fuelPenaltyScore: round(fuelPenaltyScore, 3),
    dataQualityScore: round(dataQualityScore, 3),
    minimumSequenceSatisfied: sequenceLength >= requiredSequenceLength,
    sequenceLength,
    requiredSequenceLength,
  };
}

export function computeDecisionScore(
  features: EquipmentFeatureSnapshot[],
  context: NormalizedOperationalContext,
  indicators: PerformanceIndicators
): number {
  const current = latest(features);
  const historicalTemps = features.map((f) => safeNumber(f.meanTemp)).filter((v) => v > 0);
  const historicalVibration = features
    .map((f) => safeNumber(f.rmsVibration, safeNumber(f.meanVibration)))
    .filter((v) => v > 0);

  const temp = safeNumber(current?.meanTemp);
  const vibration = safeNumber(current?.rmsVibration, safeNumber(current?.meanVibration));
  const kurtosis = safeNumber(current?.kurtosis, 3);
  const peakToPeak = safeNumber(current?.peakToPeak);
  const pressure = safeNumber(current?.meanPressure, 180);

  const tempScore = clamp((temp - 65) / 45);
  const vibrationScore = clamp((vibration - 2) / 6);
  const kurtosisScore = clamp((kurtosis - 3) / 5);
  const peakScore = clamp((peakToPeak - 6) / 16);
  const pressureScore = clamp((140 - pressure) / 140);

  const tempTrend = historicalTemps.length >= 3 ? clamp((historicalTemps[0] - average(historicalTemps.slice(1))) / 20) : 0;
  const vibrationTrend =
    historicalVibration.length >= 3
      ? clamp((historicalVibration[0] - average(historicalVibration.slice(1))) / 3)
      : 0;

  const contextAdjustment = clamp(context.weatherSeverity * 0.12 + (context.loadFactor - 0.6) * 0.18, 0, 0.2);
  const poorDataPenalty = indicators.minimumSequenceSatisfied ? 0 : 0.1;

  return round(
    clamp(
      tempScore * 0.18 +
        vibrationScore * 0.26 +
        kurtosisScore * 0.14 +
        peakScore * 0.1 +
        pressureScore * 0.08 +
        tempTrend * 0.1 +
        vibrationTrend * 0.1 +
        indicators.efficiencyLossPercent / 100 * 0.14 +
        contextAdjustment +
        poorDataPenalty
    ),
    3
  );
}

export function statusFromScore(score: number): PdmHealthStatus {
  if (score >= 0.82) {
    return "critical";
  }
  if (score >= 0.58) {
    return "degrading";
  }
  if (score >= 0.32) {
    return "watch";
  }
  return "optimal";
}

export function probabilitiesFromScore(score: number): PdmProbabilities {
  const critical = clamp((score - 0.65) / 0.35);
  const degrading = clamp(1 - Math.abs(score - 0.62) / 0.35) * 0.75;
  const watch = clamp(1 - Math.abs(score - 0.36) / 0.3) * 0.7;
  const optimal = clamp(1 - score);
  const total = Math.max(critical + degrading + watch + optimal, 0.0001);

  return {
    optimal: round(optimal / total, 3),
    watch: round(watch / total, 3),
    degrading: round(degrading / total, 3),
    critical: round(critical / total, 3),
  };
}

export function predictedRulHours(score: number, indicators: PerformanceIndicators): number {
  const baseline = 2200 * (1 - score) + 36;
  const efficiencyPenalty = 1 - clamp(indicators.efficiencyLossPercent / 160, 0, 0.45);
  return Math.max(6, Math.round(baseline * efficiencyPenalty));
}

export function shouldAlert(previousStatus: PdmHealthStatus | null | undefined, current: PdmHealthStatus): boolean {
  const order: Record<PdmHealthStatus, number> = {
    optimal: 0,
    watch: 1,
    degrading: 2,
    critical: 3,
  };
  if (!previousStatus) {
    return current === "degrading" || current === "critical";
  }
  return order[current] > order[previousStatus] || current === "critical";
}

export function confidenceFromData(score: number, indicators: PerformanceIndicators): number {
  const scoreClarity = Math.abs(score - 0.5) * 0.35;
  return round(clamp(0.45 + indicators.dataQualityScore * 0.4 + scoreClarity, 0.1, 0.98), 3);
}
