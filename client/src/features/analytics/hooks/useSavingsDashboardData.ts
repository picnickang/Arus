import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export interface SavingsSummary {
  totalSavings: number;
  totalDowntimePrevented: number;
  savingsByType: { labor: number; parts: number; downtime: number };
  savingsCount: number;
  avgSavingsPerIncident: number;
  topSavings: Array<{
    workOrderId: string;
    equipmentName: string;
    savings: number;
    downtimePrevented: number;
  }>;
}

export interface SavingsTrend {
  month: string;
  totalSavings: number;
  laborSavings: number;
  partsSavings: number;
  downtimeSavings: number;
  downtimePrevented: number;
  savingsCount: number;
}

const SAVINGS_COLORS = {
  labor: "#3b82f6",
  parts: "#10b981",
  downtime: "#f59e0b",
  total: "#8b5cf6",
} as const;

export interface EquipmentFinancials {
  totalFleetValue: number;
  totalBookValue: number;
  totalCapitalRecovered: number;
  activeEquipmentCount: number;
  decommissionedCount: number;
  assetROI: number;
  totalMaintenanceSavings: number;
}

const savingsDashboardKeys = {
  summary: ["/api/cost-savings/summary"] as const,
  trend: ["/api/cost-savings/trend"] as const,
  equipmentFinancials: ["/api/cost-savings/equipment-financials"] as const,
};

export function useSavingsDashboardData() {
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery<SavingsSummary>({
    queryKey: savingsDashboardKeys.summary,
    refetchInterval: 60000,
  });

  const {
    data: trend,
    isLoading: trendLoading,
    error: trendError,
  } = useQuery<SavingsTrend[]>({
    queryKey: savingsDashboardKeys.trend,
    refetchInterval: 60000,
  });

  const {
    data: equipmentFinancials,
    isLoading: financialsLoading,
    error: financialsError,
  } = useQuery<EquipmentFinancials>({
    queryKey: savingsDashboardKeys.equipmentFinancials,
    refetchInterval: 60000,
  });

  const pieData = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      { name: "Labor Savings", value: summary.savingsByType.labor, color: SAVINGS_COLORS.labor },
      { name: "Parts Savings", value: summary.savingsByType.parts, color: SAVINGS_COLORS.parts },
      {
        name: "Downtime Savings",
        value: summary.savingsByType.downtime,
        color: SAVINGS_COLORS.downtime,
      },
    ].filter((item) => item.value > 0);
  }, [summary]);

  const isLoading = summaryLoading || trendLoading || financialsLoading;
  const hasError = summaryError || trendError || financialsError;

  return {
    summary,
    trend: trend ?? [],
    pieData,
    equipmentFinancials,
    isLoading,
    hasError,
    colors: SAVINGS_COLORS,
  };
}
