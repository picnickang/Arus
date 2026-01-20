import { useQuery } from "@tanstack/react-query";
import { CACHE_TIMES } from "@/lib/queryClient";

interface DashboardSummary {
  metrics: {
    activeVessels?: number;
    totalEquipment?: number;
    activeAlerts?: number;
    openWorkOrders?: number;
    fleetHealth?: number;
    riskAlerts?: number;
    equipmentWithPredictions?: number;
    upcomingMaintenance?: number;
    activeDevices?: number;
    trends?: {
      activeDevices?: { value: number; direction: string };
      fleetHealth?: { value: number; direction: string; percentChange: number };
      openWorkOrders?: { value: number; direction: string };
      riskAlerts?: { value: number; direction: string };
    };
  };
  vessels: Array<{ id: string; name: string; status?: string }>;
  devices: Array<{
    id: string;
    vessel?: string;
    status: string;
    lastHeartbeat?: { ts: string; cpuPct?: number; memPct?: number };
  }>;
  equipmentHealth: Array<{
    id: string;
    name: string;
    vessel?: string;
    healthIndex: number;
    status?: string;
    predictedDueDays?: number;
    healthScore?: number;
    rul?: number | null;
    pFail30d?: number;
    vesselName?: string;
    type?: string;
  }>;
  workOrders: Array<{
    id: string;
    title?: string;
    workOrderNumber?: string;
    equipmentId?: string;
    priority: string | number;
    status: string;
    createdAt: string;
  }>;
  equipment: Array<{ id: string; name: string; vesselId?: string; type?: string }>;
  latestTelemetry?: Array<{
    equipmentId?: string;
    sensorType?: string;
    value?: number;
    unit?: string;
    status?: string;
    ts?: string;
  }>;
  dtcStats?: {
    totalActiveDtcs: number;
    criticalDtcs: number;
    equipmentWithDtcs: number;
    dtcTriggeredWorkOrders: number;
  };
  operatingAlerts?: Array<{
    id: string;
    equipmentId?: string;
    severity: string;
    currentValue: number;
    optimalMin?: number;
    optimalMax?: number;
    thresholdType?: string;
    acknowledged?: boolean;
    createdAt?: string;
  }>;
  insightsSnapshot?: {
    id: string;
    orgId: string;
    scope: string;
    summary: string;
    keyFindings?: string[];
    riskLevel?: string;
    createdAt?: string;
  } | null;
  insightsJobStats?: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalProcessed: number;
    recentInsightsJobs: Array<{ id: string; status: string; createdAt: string }>;
  };
  stcwSummary?: {
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
    vessels: Array<{
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
    }>;
    topIssues: Array<{
      crewId: string;
      crewName: string;
      vesselId: string;
      issueType: string;
      description: string;
      severity: string;
    }>;
  } | null;
  stcwTrends?: {
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
      violationTrend: string;
      fatigueRiskTrend: string;
    };
  } | null;
  timestamp: string;
}

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch("/api/dashboard/summary");
  if (!response.ok) {
    throw new Error("Failed to fetch dashboard summary");
  }
  return response.json();
}

export function useDashboardSummary() {
  const { data, isLoading, error, refetch } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
    queryFn: fetchDashboardSummary,
    staleTime: CACHE_TIMES.MODERATE,
    refetchInterval: 120000,
  });

  return {
    summary: data,
    metrics: data?.metrics,
    vessels: data?.vessels ?? [],
    devices: data?.devices ?? [],
    equipmentHealth: data?.equipmentHealth ?? [],
    workOrders: data?.workOrders ?? [],
    equipment: data?.equipment ?? [],
    latestTelemetry: data?.latestTelemetry ?? [],
    dtcStats: data?.dtcStats,
    operatingAlerts: data?.operatingAlerts ?? [],
    insightsSnapshot: data?.insightsSnapshot,
    insightsJobStats: data?.insightsJobStats,
    stcwSummary: data?.stcwSummary,
    stcwTrends: data?.stcwTrends,
    isLoading,
    error,
    refetch,
    timestamp: data?.timestamp,
  };
}
