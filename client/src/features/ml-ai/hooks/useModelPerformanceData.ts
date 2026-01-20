import { useQuery } from "@tanstack/react-query";
import { getAccuracyDescription } from "@/lib/ml-terminology";

export interface ModelPerformanceSummary { modelId: string; modelType: string | null; avgAccuracy: number | null; avgPrecision: number | null; avgRecall: number | null; avgF1Score: number | null; totalValidations: number; lastValidation: Date | null; }
export interface ModelPerformanceValidation { validation: { id: number; modelId: string; equipmentId: string; predictionType: string; predictionTimestamp: Date; predictedOutcome: Record<string, unknown>; actualOutcome: Record<string, unknown>; validatedAt: Date | null; accuracyScore: number | null; timeToFailureError: number | null; classificationLabel: string | null; }; modelName: string | null; equipmentName: string | null; }
export interface EquipmentTypeAccuracy { equipmentType: string; equipmentCount: number; totalPredictions: number; validatedPredictions: number; validationRate: number; avgAccuracy: number | null; minAccuracy: number | null; maxAccuracy: number | null; }
export interface FeatureImportanceTrend { featureName: string; avgImportance: number; count: number; trend: "increasing" | "decreasing" | "stable"; trendValue: number; }
export interface ModelDrift { modelId: string; modelName: string; modelType: string; baselineAccuracy: number; recentAccuracy: number; drift: number; driftPercent: number; severity: "none" | "minor" | "moderate" | "severe"; baselineValidations: number; recentValidations: number; isDegrading: boolean; }

interface SummaryApiResponse { result?: { summaryByModel: ModelPerformanceSummary[]; overallStats: { totalModels: number; totalValidations: number; avgAccuracyAcrossModels: number } }; metadata?: unknown }
interface ValidationApiResponse { results?: ModelPerformanceValidation[]; metadata?: unknown }

export function useModelPerformanceData() {
  const { data: summaryResponse, isLoading: summaryLoading } = useQuery<SummaryApiResponse>({ queryKey: ["/api/analytics/model-performance/summary"] });
  const { data: validationsResponse, isLoading: validationsLoading } = useQuery<ValidationApiResponse>({ queryKey: ["/api/analytics/model-performance"] });
  const { data: equipmentTypeAccuracy, isLoading: equipmentTypeLoading } = useQuery<EquipmentTypeAccuracy[]>({ queryKey: ["/api/analytics/model-performance/by-equipment-type"], refetchInterval: 60000 });
  const { data: featureTrends, isLoading: featureTrendsLoading } = useQuery<FeatureImportanceTrend[]>({ queryKey: ["/api/analytics/feature-importance/trends"], refetchInterval: 300000 });
  const { data: modelDrift, isLoading: modelDriftLoading } = useQuery<{ results: ModelDrift[]; metadata?: unknown }>({ queryKey: ["/api/analytics/model-drift"], refetchInterval: 300000, select: (data) => data });

  const summary = summaryResponse?.result?.summaryByModel ?? [];
  const overallStats = summaryResponse?.result?.overallStats;
  const validations = validationsResponse?.results ?? [];
  const modelDriftData = Array.isArray(modelDrift) ? modelDrift : (modelDrift?.results ?? []);

  const overallMetrics = { totalModels: overallStats?.totalModels ?? 0, totalValidations: overallStats?.totalValidations ?? 0, avgAccuracy: overallStats?.avgAccuracyAcrossModels ?? 0, totalPredictions: 0, totalValidated: 0 };
  const overallAvgAccuracy = overallMetrics.avgAccuracy * 100;
  const validationRate = 0;

  const getAccuracyBadgeData = (accuracy: number | null) => {
    if (accuracy === null) {return { isPending: true, label: "Pending", className: "", percent: 0 };}
    const desc = getAccuracyDescription(accuracy);
    return { isPending: false, label: desc.label, className: desc.color, percent: accuracy * 100, description: desc.description };
  };

  const criticalDrift = modelDriftData.filter((m) => m.severity === "severe" || m.severity === "moderate");
  const lowAccuracyModels = summary.filter((m) => m.avgAccuracy !== null && m.avgAccuracy < 0.7);
  const hasIssues = criticalDrift.length > 0 || lowAccuracyModels.length > 0;

  return {
    summary, summaryLoading, validations, validationsLoading,
    equipmentTypeAccuracy, equipmentTypeLoading, featureTrends, featureTrendsLoading,
    modelDriftData, modelDriftLoading,
    overallMetrics, overallAvgAccuracy, validationRate,
    getAccuracyBadgeData, criticalDrift, lowAccuracyModels, hasIssues,
  };
}
