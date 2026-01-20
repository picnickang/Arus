import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

interface VesselSummary {
  vesselId: string;
  vesselName: string;
  totalCrew: number;
  compliantCrew: number;
  complianceRate: number;
  violationCount: number;
  warningCount: number;
  highFatigueCount: number;
  criticalFatigueCount: number;
  avgRestPer24h: number;
  avgRestPer7d: number;
}

interface TopIssue {
  crewId: string;
  crewName: string;
  vesselId: string;
  issueType: "violation" | "high_fatigue" | "critical_fatigue";
  description: string;
  severity: "warning" | "critical";
}

interface FleetSummary {
  orgId: string;
  lookbackDays: number;
  calculatedAt: string;
  fleet: {
    totalVessels: number;
    totalCrew: number;
    compliantCrew: number;
    overallComplianceRate: number;
    totalViolations: number;
    totalWarnings: number;
    highFatigueCount: number;
    criticalFatigueCount: number;
    avgRestPer24h: number;
    avgRestPer7d: number;
  };
  vessels: VesselSummary[];
  topIssues: TopIssue[];
}

interface TrendData {
  orgId: string;
  lookbackDays: number;
  calculatedAt: string;
  trends: Array<{
    date: string;
    complianceRate: number;
    violationCount: number;
    warningCount: number;
    highFatigueRate: number;
    avgRest24h: number;
  }>;
  summary: {
    complianceRateChange: number;
    violationTrend: "increasing" | "stable" | "decreasing";
    fatigueRiskTrend: "increasing" | "stable" | "decreasing";
  };
}

export interface UseSTCWComplianceDataProps {
  lookbackDays?: number;
  prefetchedSummary?: FleetSummary | null;
  prefetchedTrends?: TrendData | null;
}

export interface UseSTCWComplianceDataReturn {
  summary: FleetSummary | undefined;
  trends: TrendData | undefined;
  isLoadingSummary: boolean;
  isLoadingTrends: boolean;
  summaryError: Error | null;
  expandedVessel: string | null;
  setExpandedVessel: (vesselId: string | null) => void;
  toggleVesselExpansion: (vesselId: string) => void;
  hasIssues: boolean;
  sortedVessels: VesselSummary[];
  formattedChartData: Array<{
    date: string;
    complianceRate: number;
    highFatigueRate: number;
    violationCount: number;
    warningCount: number;
    avgRest24h: number;
  }>;
}

export function useSTCWComplianceData({ lookbackDays = 30, prefetchedSummary, prefetchedTrends }: UseSTCWComplianceDataProps = {}): UseSTCWComplianceDataReturn {
  const [expandedVessel, setExpandedVessel] = useState<string | null>(null);

  const { data: summary, isLoading: isLoadingSummary, error: summaryError } = useQuery<FleetSummary>({
    queryKey: ["/api/dashboard/stcw-summary", { days: lookbackDays }],
    staleTime: 300000,
    refetchInterval: 300000,
    initialData: prefetchedSummary ?? undefined,
  });

  const { data: trends, isLoading: isLoadingTrends } = useQuery<TrendData>({
    queryKey: ["/api/dashboard/stcw-trends", { days: lookbackDays }],
    staleTime: 300000,
    refetchInterval: 300000,
    initialData: prefetchedTrends ?? undefined,
  });

  const toggleVesselExpansion = useCallback((vesselId: string) => {
    setExpandedVessel((prev) => (prev === vesselId ? null : vesselId));
  }, []);

  const hasIssues = useMemo(() => {
    if (!summary) {return false;}
    return summary.fleet.totalViolations > 0 || summary.fleet.criticalFatigueCount > 0;
  }, [summary]);

  const sortedVessels = useMemo(() => {
    if (!summary?.vessels) {return [];}
    return [...summary.vessels].sort((a, b) => a.complianceRate - b.complianceRate);
  }, [summary?.vessels]);

  const formattedChartData = useMemo(() => {
    if (!trends?.trends) {return [];}
    return trends.trends.map((t) => ({
      ...t,
      date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  }, [trends?.trends]);

  return {
    summary,
    trends,
    isLoadingSummary,
    isLoadingTrends,
    summaryError,
    expandedVessel,
    setExpandedVessel,
    toggleVesselExpansion,
    hasIssues,
    sortedVessels,
    formattedChartData,
  };
}

export type { VesselSummary, TopIssue, FleetSummary, TrendData };
