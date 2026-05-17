import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCostTrends,
  fetchCostSummary,
  fetchCostSavingsSummary,
  fetchRoiAnalysis,
  fetchInsightsJobStats,
  fetchWorkOrders,
} from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";
import type { PDFSection } from "@/lib/exportUtils";

/**
 * FIXES APPLIED:
 * - Added explicit generics to useQuery calls that were missing them.
 *   Without `useQuery<T>`, TanStack Query v5 infers `data` as
 *   `never[] | TQueryFnData` because `initialData` defaults to `undefined`
 *   but the query function's return type isn't propagated through.
 * - Added explicit types for costSavingsSummary, roiAnalysis, insightJobsStats
 *   response shapes (these were using untyped `useQuery({})`).
 * - Reformatted from single-line style for readability.
 */

interface CostTrendData {
  month: string;
  totalCost: number;
  costByType?: { labor?: number; parts?: number; downtime?: number };
}

interface CostSummaryData {
  costByType?: { preventive?: number; reactive?: number };
}

interface WorkOrderData {
  id: string;
  status: string;
  estimatedDowntimeHours?: number;
  actualDowntimeHours?: number;
  laborCost?: number;
  laborHours?: number;
  assignedCrewId?: string;
  completedAt?: string;
}

interface CostBreakdownItem {
  name: string;
  value: number;
}

interface CostSavingsSummary {
  totalSavings: number;
  savingsByType?: { predictive?: number; preventive?: number };
  disputedCount?: number;
  voidedCount?: number;
  disputedAmount?: number;
  voidedAmount?: number;
  confidenceRange?: { low: number; high: number; avgConfidence: number };
}

interface RoiAnalysis {
  systemRoi?: number;
  roiByType?: { predictive?: number; preventive?: number };
}

interface InsightsJobStats {
  completed?: number;
  failed?: number;
  pending?: number;
}

export function useFinanceModeData() {
  const { data: costTrends = [], isLoading: costTrendsLoading } = useQuery<CostTrendData[]>({
    queryKey: ["/api/analytics/cost-trends"],
    queryFn: () => fetchCostTrends(),
    refetchInterval: 300000,
    staleTime: 120000,
  });

  const { data: costSummary = [], isLoading: costSummaryLoading } = useQuery<CostSummaryData[]>({
    queryKey: ["/api/analytics/cost-summary"],
    queryFn: () => fetchCostSummary(),
    refetchInterval: 300000,
    staleTime: 120000,
  });

  const { data: costSavingsSummary } = useQuery<CostSavingsSummary | undefined>({
    queryKey: ["/api/cost-savings/summary"],
    queryFn: () => fetchCostSavingsSummary(),
    refetchInterval: 300000,
    staleTime: 120000,
  });

  const { data: roiAnalysis } = useQuery<RoiAnalysis | undefined>({
    queryKey: ["/api/analytics/roi-analysis"],
    queryFn: () => fetchRoiAnalysis(12),
    refetchInterval: 300000,
    staleTime: 120000,
  });

  const { data: insightJobsStats } = useQuery<InsightsJobStats | undefined>({
    queryKey: ["/api/insights/jobs/stats"],
    queryFn: () => fetchInsightsJobStats(),
    refetchInterval: 300000,
    staleTime: 120000,
  });

  const { data: workOrders = [] } = useQuery<WorkOrderData[]>({
    queryKey: ["/api/work-orders"],
    queryFn: () => fetchWorkOrders() as Promise<WorkOrderData[]>,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const isLoading = costTrendsLoading || costSummaryLoading;

  const metrics = useMemo(() => {
    const latestMonth = costTrends[costTrends.length - 1];
    const previousMonth = costTrends[costTrends.length - 2];
    const monthlyChange =
      latestMonth && previousMonth
        ? ((latestMonth.totalCost - previousMonth.totalCost) / previousMonth.totalCost) * 100
        : 0;
    const totalSavings = costSavingsSummary?.totalSavings || 0;
    const predictiveSavings = costSavingsSummary?.savingsByType?.predictive || 0;
    const preventiveSavings = costSavingsSummary?.savingsByType?.preventive || 0;
    const disputedCount = costSavingsSummary?.disputedCount || 0;
    const voidedCount = costSavingsSummary?.voidedCount || 0;
    const disputedAmount = costSavingsSummary?.disputedAmount || 0;
    const voidedAmount = costSavingsSummary?.voidedAmount || 0;
    const confidenceRange = costSavingsSummary?.confidenceRange || {
      low: totalSavings * 0.5,
      high: totalSavings * 1.5,
      avgConfidence: 0.5,
    };
    const completedInsights = insightJobsStats?.completed || 0;
    const avgCostPerInsight = 0.15;
    const estimatedLLMCost = completedInsights * avgCostPerInsight;

    const openWorkOrders = workOrders.filter((wo: WorkOrderData) => wo.status !== "completed");
    const estimatedFutureDowntime = openWorkOrders.reduce(
      (sum: number, wo: WorkOrderData) => sum + (wo.estimatedDowntimeHours ?? 0),
      0
    );
    const downtimeCostPerHour = 500;
    const projectedDowntimeCost = estimatedFutureDowntime * downtimeCostPerHour;

    const completedWorkOrders = workOrders.filter((wo: WorkOrderData) => wo.status === "completed");
    const actualDowntimeHours = completedWorkOrders.reduce(
      (sum: number, wo: WorkOrderData) => sum + (wo.actualDowntimeHours ?? 0),
      0
    );
    const actualDowntimeCost = actualDowntimeHours * downtimeCostPerHour;

    const preventiveCost = costSummary.reduce(
      (sum: number, s: CostSummaryData) => sum + (s.costByType?.preventive ?? 0),
      0
    );
    const reactiveCost = costSummary.reduce(
      (sum: number, s: CostSummaryData) => sum + (s.costByType?.reactive ?? 0),
      0
    );
    const preventiveRatio =
      preventiveCost + reactiveCost > 0
        ? (preventiveCost / (preventiveCost + reactiveCost)) * 100
        : 0;

    const totalLaborCost = completedWorkOrders.reduce(
      (sum: number, wo: WorkOrderData) => sum + (wo.laborCost ?? 0),
      0
    );
    const totalLaborHours = completedWorkOrders.reduce(
      (sum: number, wo: WorkOrderData) => sum + (wo.laborHours ?? 0),
      0
    );
    const avgLaborCostPerHour = totalLaborHours > 0 ? totalLaborCost / totalLaborHours : 0;
    const workOrdersWithLabor = completedWorkOrders.filter(
      (wo: WorkOrderData) => (wo.laborCost ?? 0) > 0
    ).length;
    const pendingLaborHours = openWorkOrders.reduce(
      (sum: number, wo: WorkOrderData) => sum + (wo.laborHours ?? 0),
      0
    );
    const estimatedPendingLaborCost =
      pendingLaborHours * (avgLaborCostPerHour > 0 ? avgLaborCostPerHour : 75);

    return {
      latestMonth,
      monthlyChange,
      totalSavings,
      predictiveSavings,
      preventiveSavings,
      completedInsights,
      avgCostPerInsight,
      estimatedLLMCost,
      openWorkOrders,
      estimatedFutureDowntime,
      projectedDowntimeCost,
      actualDowntimeHours,
      actualDowntimeCost,
      preventiveCost,
      reactiveCost,
      preventiveRatio,
      totalLaborCost,
      totalLaborHours,
      avgLaborCostPerHour,
      workOrdersWithLabor,
      pendingLaborHours,
      estimatedPendingLaborCost,
      disputedCount,
      voidedCount,
      disputedAmount,
      voidedAmount,
      confidenceRange,
    };
  }, [costTrends, costSavingsSummary, insightJobsStats, workOrders, costSummary]);

  const costBreakdownData = useMemo(
    () =>
      costSummary.reduce((acc: CostBreakdownItem[], summary: CostSummaryData) => {
        Object.entries(summary.costByType ?? {}).forEach(([type, amount]) => {
          const existing = acc.find((item) => item.name === type);
          if (existing) {
            existing.value += amount;
          } else {
            acc.push({ name: type, value: amount });
          }
        });
        return acc;
      }, []),
    [costSummary]
  );

  const roiTrendData = useMemo(
    () =>
      costTrends.slice(-6).map((trend: CostTrendData) => {
        const monthCost = trend.totalCost || 0;
        const monthSavings = metrics.totalSavings / costTrends.length || 0;
        const monthRoi = monthCost > 0 ? (monthSavings / monthCost) * 100 : 0;
        return { month: trend.month, roi: monthRoi, savings: monthSavings, cost: monthCost };
      }),
    [costTrends, metrics.totalSavings]
  );

  const costTrendsData = useMemo(
    () =>
      costTrends.map((trend: CostTrendData) => ({
        month: trend.month,
        totalCost: trend.totalCost,
        labor: trend.costByType?.labor || 0,
        parts: trend.costByType?.parts || 0,
        downtime: trend.costByType?.downtime || 0,
      })),
    [costTrends]
  );

  const exportPDFSections: PDFSection[] = useMemo(
    () => [
      {
        title: "Financial Summary",
        content: [
          { key: "Total Savings", value: formatCurrency(metrics.totalSavings) },
          {
            key: "Monthly Spend",
            value: metrics.latestMonth ? formatCurrency(metrics.latestMonth.totalCost) : "N/A",
          },
          {
            key: "Monthly Change",
            value: `${metrics.monthlyChange >= 0 ? "+" : ""}${metrics.monthlyChange.toFixed(1)}%`,
          },
          { key: "Predictive Savings", value: formatCurrency(metrics.predictiveSavings) },
          { key: "Preventive Savings", value: formatCurrency(metrics.preventiveSavings) },
        ],
      },
      {
        title: "Cost Analysis",
        content: [
          { key: "Preventive Cost", value: formatCurrency(metrics.preventiveCost) },
          { key: "Reactive Cost", value: formatCurrency(metrics.reactiveCost) },
          { key: "Preventive Ratio", value: `${metrics.preventiveRatio.toFixed(1)}%` },
          { key: "Estimated LLM Cost", value: formatCurrency(metrics.estimatedLLMCost) },
        ],
      },
      {
        title: "Labor Cost Analysis",
        content: [
          { key: "Total Labor Cost", value: formatCurrency(metrics.totalLaborCost) },
          { key: "Total Labor Hours", value: metrics.totalLaborHours.toFixed(1) },
          { key: "Avg Cost/Hour", value: formatCurrency(metrics.avgLaborCostPerHour) },
          { key: "Work Orders with Labor", value: String(metrics.workOrdersWithLabor) },
          { key: "Pending Labor Hours", value: metrics.pendingLaborHours.toFixed(1) },
          {
            key: "Est. Pending Labor Cost",
            value: formatCurrency(metrics.estimatedPendingLaborCost),
          },
        ],
      },
      {
        title: "Downtime Analysis",
        content: [
          { key: "Actual Downtime Hours", value: metrics.actualDowntimeHours.toFixed(1) },
          { key: "Actual Downtime Cost", value: formatCurrency(metrics.actualDowntimeCost) },
          { key: "Projected Downtime Hours", value: metrics.estimatedFutureDowntime.toFixed(1) },
          { key: "Projected Downtime Cost", value: formatCurrency(metrics.projectedDowntimeCost) },
        ],
      },
      {
        title: "ROI Analysis",
        content: [
          {
            key: "System ROI",
            value: roiAnalysis?.systemRoi ? `${roiAnalysis.systemRoi.toFixed(1)}%` : "N/A",
          },
          {
            key: "Predictive ROI",
            value: roiAnalysis?.roiByType?.predictive
              ? `${roiAnalysis.roiByType.predictive.toFixed(1)}%`
              : "N/A",
          },
          {
            key: "Preventive ROI",
            value: roiAnalysis?.roiByType?.preventive
              ? `${roiAnalysis.roiByType.preventive.toFixed(1)}%`
              : "N/A",
          },
        ],
      },
    ],
    [metrics, roiAnalysis]
  );

  const exportCostTrendsData = useMemo(
    () =>
      costTrendsData.map((trend: { month: string; totalCost: number; labor: number; parts: number; downtime: number }) => ({
        month: trend.month,
        totalCost: formatCurrency(trend.totalCost),
        labor: formatCurrency(trend.labor),
        parts: formatCurrency(trend.parts),
        downtime: formatCurrency(trend.downtime),
      })),
    [costTrendsData]
  );

  const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

  return {
    ...metrics,
    roiAnalysis,
    costBreakdownData,
    roiTrendData,
    costTrendsData,
    exportPDFSections,
    exportCostTrendsData,
    COLORS,
    isLoading,
  };
}
