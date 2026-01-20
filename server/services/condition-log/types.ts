/**
 * Condition Log Service - Type Definitions
 */

export interface ConditionLogResult {
  success: boolean;
  recordsCreated: number;
  errors: string[];
}

export interface ConditionPeriodData {
  periodStart: Date;
  periodEnd: Date;
  equipmentId: string;
  vibrationRmsAvg: number | null;
  vibrationRmsMax: number | null;
  vibrationRmsMin: number | null;
  vibrationPeakAvg: number | null;
  vibrationPeakMax: number | null;
  tempAvg: number | null;
  tempMax: number | null;
  tempMin: number | null;
  mlAnomalyScoreAvg: number | null;
  mlAnomalyScoreMax: number | null;
  healthIndex: number | null;
  alertsCount: number;
  criticalAlertsCount: number;
  dataPointsCount: number;
  sourceAnalysisIds: string[];
}

export interface VibrationAggregation {
  rmsAvg: number | null;
  rmsMax: number | null;
  rmsMin: number | null;
  peakAvg: number | null;
  peakMax: number | null;
  crestFactor: number | null;
  kurtosis: number | null;
  analysisIds: string[];
}

export interface ConditionAggregation {
  anomalyScoreAvg: number | null;
  anomalyScoreMax: number | null;
  healthIndex: number | null;
  alertsCount: number;
  criticalAlertsCount: number;
  tempAvg: number | null;
  tempMax: number | null;
  tempMin: number | null;
  dataPoints: number;
}

export interface VesselConditionSummary {
  equipmentCount: number;
  avgHealthIndex: number;
  minHealthIndex: number;
  totalAlerts: number;
  criticalAlerts: number;
  equipmentByGrade: Record<string, number>;
}
