import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchEquipmentHealthTyped,
  fetchAnomalyDetections,
  fetchFailurePredictions,
  fetchModelPerformanceSummary,
  fetchCostTrends,
  fetchWorkOrders,
} from "@/lib/api";
import { getMissionOverviewAlerts } from "@/lib/analytics-priority";
import { formatDate, formatCurrency } from "@/lib/formatters";
import type { PDFSection } from "@/lib/exportUtils";

interface AnomalyRecord {
  severity?: string;
}
interface PredictionRecord {
  confidence?: number;
}
interface EquipmentRecord {
  healthIndex?: number;
  trend?: number;
}

export function useMissionOverviewData() {
  const {
    data: equipmentHealthResponse,
    isLoading: equipmentHealthLoading,
    error: equipmentHealthError,
  } = useQuery({
    queryKey: ["/api/equipment/health"],
    queryFn: () => fetchEquipmentHealthTyped(),
    refetchInterval: 120000,
    staleTime: 60000,
  });
  const { data: anomaliesResponse } = useQuery({
    queryKey: ["/api/analytics/anomalies"],
    queryFn: () => fetchAnomalyDetections({ page: 1, limit: 100 }),
    refetchInterval: 120000,
    staleTime: 60000,
  });
  const { data: costTrends = [] } = useQuery({
    queryKey: ["/api/analytics/cost-trends"],
    queryFn: () => fetchCostTrends(),
    refetchInterval: 300000,
    staleTime: 120000,
  });
  const { data: workOrders = [] } = useQuery({
    queryKey: ["/api/work-orders"],
    queryFn: () => fetchWorkOrders(),
    refetchInterval: 120000,
    staleTime: 60000,
  });
  const { data: modelPerformanceResponse } = useQuery({
    queryKey: ["/api/analytics/model-performance/summary"],
    queryFn: () => fetchModelPerformanceSummary(),
    refetchInterval: 300000,
    staleTime: 120000,
  });
  const { data: failurePredictionsResponse } = useQuery({
    queryKey: ["/api/analytics/predictions"],
    queryFn: () => fetchFailurePredictions({ page: 1, limit: 100 }),
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const equipmentHealth: EquipmentRecord[] = (equipmentHealthResponse?.results ??
    []) as EquipmentRecord[];
  const anomalies: AnomalyRecord[] = (anomaliesResponse?.results ?? []) as AnomalyRecord[];
  const modelPerformance = modelPerformanceResponse?.result;
  const failurePredictions: PredictionRecord[] = (failurePredictionsResponse?.results ??
    []) as PredictionRecord[];

  const alerts = useMemo(
    () =>
      getMissionOverviewAlerts({
        equipmentHealth,
        anomalies,
        costTrends,
        workOrders,
      } as object as Parameters<typeof getMissionOverviewAlerts>[0]),
    [equipmentHealth, anomalies, costTrends, workOrders]
  );
  const topAlerts = useMemo(() => alerts.slice(0, 8), [alerts]);

  const metrics = useMemo(() => {
    const anomalySeverityCounts = {
      critical: anomalies.filter((a) => a.severity === "critical").length,
      high: anomalies.filter((a) => a.severity === "high").length,
      medium: anomalies.filter((a) => a.severity === "medium").length,
      low: anomalies.filter((a) => a.severity === "low").length,
    };
    const avgConfidence =
      modelPerformance?.currentAccuracy ||
      modelPerformance?.averageAccuracy ||
      (failurePredictions.length > 0
        ? failurePredictions.reduce((sum, p) => sum + (p.confidence || 0), 0) /
          failurePredictions.length
        : 0);
    const highConfidencePredictions = failurePredictions.filter(
      (p) => (p.confidence || 0) >= 0.8
    ).length;
    const lowConfidencePredictions = failurePredictions.filter(
      (p) => (p.confidence || 0) < 0.6
    ).length;
    const recentCosts = costTrends.slice(-2);
    const historicalAvg =
      costTrends.length > 2
        ? costTrends
            .slice(0, -2)
            .reduce(
              (sum: number, t: (typeof costTrends)[number]) => sum + (t.maintenanceCost || 0),
              0
            ) /
          (costTrends.length - 2)
        : 0;
    const recentAvg =
      recentCosts.length > 0
        ? recentCosts.reduce(
            (sum: number, t: (typeof recentCosts)[number]) => sum + (t.maintenanceCost || 0),
            0
          ) / recentCosts.length
        : 0;
    const costSpike = historicalAvg > 0 ? ((recentAvg - historicalAvg) / historicalAvg) * 100 : 0;
    const hasCostSpike = costSpike > 20;
    const degradingEquipment = equipmentHealth.filter((eq) => {
      const health = eq.healthIndex || 0;
      const trend = eq.trend || 0;
      return health < 70 && trend < 0;
    });
    const criticalHealth = equipmentHealth.filter((eq) => (eq.healthIndex || 0) < 30).length;
    const criticalCount = alerts.filter((a) => a.severity === "critical").length;
    const warningCount = alerts.filter((a) => a.severity === "warning").length;
    const totalFinancialImpact = alerts.reduce((sum, a) => sum + (a.financialImpact || 0), 0);
    return {
      anomalySeverityCounts,
      avgConfidence,
      highConfidencePredictions,
      lowConfidencePredictions,
      costSpike,
      hasCostSpike,
      degradingEquipment,
      criticalHealth,
      criticalCount,
      warningCount,
      totalFinancialImpact,
    };
  }, [anomalies, modelPerformance, failurePredictions, costTrends, equipmentHealth, alerts]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "default";
      default:
        return "secondary";
    }
  };

  const exportPDFSections: PDFSection[] = useMemo(
    () => [
      {
        title: "Mission Overview Summary",
        content: [
          { key: "Generated", value: formatDate(new Date()) },
          { key: "Critical Alerts", value: metrics.criticalCount.toString() },
          { key: "Warning Alerts", value: metrics.warningCount.toString() },
          {
            key: "Potential Financial Impact",
            value: formatCurrency(metrics.totalFinancialImpact),
          },
        ],
      },
      {
        title: "Anomaly Intelligence",
        content: [
          { key: "Critical Anomalies", value: metrics.anomalySeverityCounts.critical.toString() },
          { key: "High Anomalies", value: metrics.anomalySeverityCounts.high.toString() },
          { key: "Medium Anomalies", value: metrics.anomalySeverityCounts.medium.toString() },
          { key: "Low Anomalies", value: metrics.anomalySeverityCounts.low.toString() },
        ],
      },
      {
        title: "Prediction Metrics",
        content: [
          { key: "Model Accuracy", value: `${(metrics.avgConfidence * 100).toFixed(1)}%` },
          {
            key: "High Confidence Predictions",
            value: metrics.highConfidencePredictions.toString(),
          },
          { key: "Low Confidence Predictions", value: metrics.lowConfidencePredictions.toString() },
        ],
      },
      {
        title: "Fleet Health",
        content: [
          { key: "Critical Health Equipment", value: metrics.criticalHealth.toString() },
          { key: "Degrading Equipment", value: metrics.degradingEquipment.length.toString() },
          {
            key: "Cost Spike Detected",
            value: metrics.hasCostSpike ? `Yes (${metrics.costSpike.toFixed(1)}%)` : "No",
          },
        ],
      },
    ],
    [metrics]
  );

  const exportAlertsData = useMemo(
    () =>
      topAlerts.map((alert) => ({
        severity: alert.severity,
        type: alert.type,
        message: alert.title,
        financialImpact: alert.financialImpact ? formatCurrency(alert.financialImpact) : "N/A",
        timestamp: formatDate(alert.timestamp),
      })),
    [topAlerts]
  );

  return {
    equipmentHealth,
    equipmentHealthLoading,
    equipmentHealthError,
    topAlerts,
    ...metrics,
    getSeverityColor,
    exportPDFSections,
    exportAlertsData,
  };
}
