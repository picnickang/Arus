/**
 * Condition Monitoring - Types
 * Interface definitions for condition assessment
 */

export interface OilConditionAssessment {
  overallScore: number;
  viscosityScore: number;
  contaminationScore: number;
  wearMetalsScore: number;
  additiveScore: number;
  oxidationScore: number;
  condition: "normal" | "marginal" | "critical";
  primaryConcerns: string[];
  recommendations: string[];
  changeRecommended: boolean;
  estimatedRemainingLife: number;
}

export interface WearAssessment {
  overallScore: number;
  wearSeverity: "normal" | "moderate" | "high" | "severe";
  dominantWearMode: "adhesive" | "abrasive" | "fatigue" | "corrosive" | "normal";
  affectedComponents: string[];
  wearTrend: "improving" | "stable" | "degrading";
  recommendations: string[];
  inspectionRequired: boolean;
  estimatedComponentLife: number;
}

export interface ConditionTrend {
  equipmentId: string;
  timespan: "last_30_days" | "last_90_days" | "last_year";
  oilConditionTrend: "improving" | "stable" | "degrading";
  wearTrend: "improving" | "stable" | "degrading";
  overallTrend: "improving" | "stable" | "degrading";
  trendConfidence: number;
  keyIndicators: Array<{
    parameter: string;
    value: number;
    trend: "improving" | "stable" | "degrading";
    significance: "low" | "medium" | "high";
  }>;
}
