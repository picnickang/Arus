import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEquipmentHealthTyped, fetchPdmScores, fetchWorkOrders, fetchMaintenanceRecords, fetchFailurePatterns, fetchCostSavingsSummary } from "@/lib/api";
import { differenceInHours } from "date-fns";
import type { EquipmentHealth } from "@shared/schema";

interface WorkOrderData { id: string; status: string; priority: number; createdAt?: string; completedAt?: string; }
interface PdmScoreData { equipmentId: string; equipmentName?: string; failureRisk: number; healthScore?: number; timestamp: string; }
interface FailurePatternData { month: string; totalFailures: number; preventedFailures?: number; }
interface SchedulingSuggestion { equipmentId: string; equipmentName: string; failureRisk: number; recommendedWindow: string; priority: string; }

export function useMaintenanceModeData() {
  const { data: pdmScores = [], isLoading: pdmLoading } = useQuery<PdmScoreData[]>({ queryKey: ["/api/pdm/scores"], queryFn: () => fetchPdmScores(), refetchInterval: 120000, staleTime: 60000 });
  const { data: workOrders = [], isLoading: workOrdersLoading } = useQuery<WorkOrderData[]>({ queryKey: ["/api/work-orders"], queryFn: () => fetchWorkOrders(), refetchInterval: 120000, staleTime: 60000 });
  const { data: maintenanceRecords = [] } = useQuery({ queryKey: ["/api/analytics/maintenance-records"], queryFn: () => fetchMaintenanceRecords(), refetchInterval: 300000, staleTime: 120000 });
  const { data: failurePatternsData } = useQuery({ queryKey: ["/api/analytics/failure-patterns"], queryFn: () => fetchFailurePatterns(6), refetchInterval: 300000, staleTime: 120000 });
  const { data: costSavings } = useQuery({ queryKey: ["/api/cost-savings/summary"], queryFn: () => fetchCostSavingsSummary(), refetchInterval: 300000, staleTime: 120000 });
  const { data: equipmentHealthResponse } = useQuery({ queryKey: ["/api/equipment/health"], queryFn: () => fetchEquipmentHealthTyped(), refetchInterval: 120000, staleTime: 60000 });
  const isLoading = pdmLoading || workOrdersLoading;

  const equipmentHealth: EquipmentHealth[] = equipmentHealthResponse?.results ?? [];

  const metrics = useMemo(() => {
    const openOrders = workOrders.filter((wo) => wo.status !== "completed").length;
    const overdueOrders = workOrders.filter((wo) => { if (wo.status === "completed" || !wo.createdAt) {return false;} const ageMs = Date.now() - new Date(wo.createdAt).getTime(); const ageHours = ageMs / (1000 * 60 * 60); return (wo.priority === 1 && ageHours > 24) || (wo.priority === 2 && ageHours > 72) || (wo.priority === 3 && ageHours > 168); }).length;
    const highRiskEquipment = pdmScores.filter((score) => score.failureRisk > 70).length;
    const completedOrders = workOrders.filter((wo) => wo.status === "completed");
    const ordersWithTimestamps = completedOrders.filter((wo) => wo.createdAt && wo.completedAt);
    const avgCompletionTimeHours = ordersWithTimestamps.length > 0 ? ordersWithTimestamps.reduce((sum, wo) => sum + differenceInHours(new Date(wo.completedAt), new Date(wo.createdAt)), 0) / ordersWithTimestamps.length : 0;
    const completionRate = workOrders.length > 0 ? (completedOrders.length / workOrders.length) * 100 : 0;
    const preventiveSavings = costSavings?.preventiveSavings || 0;
    const reactiveCost = costSavings?.totalDowntimePrevented || 0;
    const highReactiveCostEquipment = equipmentHealth.filter((eq) => (eq.healthIndex || 100) < 60);
    return { openOrders, overdueOrders, highRiskEquipment, completedOrders, avgCompletionTimeHours, completionRate, preventiveSavings, reactiveCost, highReactiveCostEquipment };
  }, [workOrders, pdmScores, costSavings, equipmentHealth]);

  const failurePatterns: FailurePatternData[] = failurePatternsData?.failurePatterns ?? [];
  const failureChartData = useMemo(() => failurePatterns.map((pattern) => ({ month: pattern.month, failures: pattern.totalFailures, prevented: pattern.preventedFailures || 0 })), [failurePatterns]);

  const failureMetrics = useMemo(() => {
    const totalFailures = failurePatterns.reduce((sum, p) => sum + (p.totalFailures ?? 0), 0);
    const totalPrevented = failurePatterns.reduce((sum, p) => sum + (p.preventedFailures ?? 0), 0);
    const preventionRate = totalFailures > 0 ? (totalPrevented / (totalFailures + totalPrevented)) * 100 : 0;
    return { totalFailures, totalPrevented, preventionRate };
  }, [failurePatterns]);

  const schedulingSuggestions: SchedulingSuggestion[] = useMemo(() => pdmScores.filter((score) => score.failureRisk >= 50 && score.failureRisk < 90).map((score) => { const riskLevel = score.failureRisk; const daysUntilCritical = riskLevel >= 70 ? 7 : riskLevel >= 60 ? 14 : 30; return { equipmentId: score.equipmentId, equipmentName: score.equipmentName || score.equipmentId, failureRisk: score.failureRisk, recommendedWindow: `${daysUntilCritical} days`, priority: riskLevel >= 70 ? "High" : riskLevel >= 60 ? "Medium" : "Low" }; }).sort((a, b) => b.failureRisk - a.failureRisk), [pdmScores]);

  const overdueWorkOrders = useMemo(() => workOrders.filter((wo) => { if (wo.status === "completed" || !wo.createdAt) {return false;} const ageMs = Date.now() - new Date(wo.createdAt).getTime(); const ageHours = ageMs / (1000 * 60 * 60); return (wo.priority === 1 && ageHours > 24) || (wo.priority === 2 && ageHours > 72) || (wo.priority === 3 && ageHours > 168); }).slice(0, 5), [workOrders]);

  const highRiskPdmScores = useMemo(() => pdmScores.filter((score) => score.failureRisk > 70).slice(0, 10), [pdmScores]);

  return { pdmScores, workOrders, maintenanceRecords, equipmentHealth, ...metrics, ...failureMetrics, failureChartData, schedulingSuggestions, overdueWorkOrders, highRiskPdmScores, isLoading };
}
