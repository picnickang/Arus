/**
 * Analytics - Types
 */

export interface CostSummary {
  equipmentId: string;
  totalCost: number;
  costByType: Record<string, number>;
}
export interface CostTrend {
  month: string;
  totalCost: number;
  costByType: Record<string, number>;
}
export interface PerformanceOverview {
  equipmentId: string;
  equipmentName: string;
  averageScore: number;
  reliability: number;
  availability: number;
  efficiency: number;
}
export interface PerformanceTrendPoint {
  month: string;
  performanceScore: number;
  availability: number;
  efficiency: number;
}
