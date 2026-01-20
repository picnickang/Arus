import { apiRequest } from "../queryClient";

export interface CostTrendData {
  date: string;
  maintenanceCost: number;
  predictedCost?: number;
  savings?: number;
}

export async function fetchCostTrends(): Promise<CostTrendData[]> {
  const url = `/api/analytics/cost-trends`;
  const response = await apiRequest("GET", url);
  return response as CostTrendData[];
}

export interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  type: string;
  date: string;
  cost: number;
  description?: string;
}

export async function fetchMaintenanceRecords(): Promise<MaintenanceRecord[]> {
  const url = `/api/analytics/maintenance-records`;
  const response = await apiRequest("GET", url);
  return response as MaintenanceRecord[];
}

export interface FailurePatternData {
  month: string;
  failures: number;
  prevented: number;
  equipmentType?: string;
}

export async function fetchFailurePatterns(months: number = 6): Promise<FailurePatternData[]> {
  const url = `/api/analytics/failure-patterns?months=${months}`;
  const response = await apiRequest("GET", url);
  return response as FailurePatternData[];
}

export interface CostSavingsSummary {
  totalSavings: number;
  predictiveSavings: number;
  downtimeAvoided: number;
  preventedFailures: number;
  roi: number;
  period: string;
}

export async function fetchCostSavingsSummary(): Promise<CostSavingsSummary> {
  const url = `/api/cost-savings/summary`;
  const response = await apiRequest("GET", url);
  return response as CostSavingsSummary;
}

export interface CostSummaryItem {
  month: string;
  totalCost: number;
  costByType?: Record<string, number>;
}

export async function fetchCostSummary(): Promise<CostSummaryItem[]> {
  const url = `/api/analytics/cost-summary`;
  const response = await apiRequest("GET", url);
  return (response ?? []) as CostSummaryItem[];
}

export interface RoiAnalysisData {
  currentRoi: number;
  projectedRoi: number;
  savingsToDate: number;
  investmentToDate: number;
  monthlyData: Array<{
    month: string;
    roi: number;
    savings: number;
    cost: number;
  }>;
}

export async function fetchRoiAnalysis(months: number = 12): Promise<RoiAnalysisData> {
  const url = `/api/analytics/roi-analysis?months=${months}`;
  const response = await apiRequest("GET", url);
  return response as RoiAnalysisData;
}
