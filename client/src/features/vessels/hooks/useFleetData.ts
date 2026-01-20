import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import type { TechnicianInsight } from "@/components/TechnicianInsightCard";

interface VesselData { id: string; name: string; imo?: string; status?: string; }
interface EquipmentHealth { id: string; name: string; type: string; vesselId?: string; vesselName?: string; healthScore: number; rul: number | null; pFail30d?: number; status: "healthy" | "warning" | "critical" | "unknown"; }
interface TelemetryReading { equipmentId: string; sensorType: string; value: number; unit: string; timestamp: string; }
interface VesselInsights { vesselId: string; vesselName: string; insights: TechnicianInsight[]; }
interface FleetOverviewResponse { orgId: string; vesselId: string | null; vessels: VesselInsights[]; generatedAt: string; }
type ViewMode = "insights" | "status";

export function useFleetData() {
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("status");
  const [darkMode, setDarkMode] = useState(false);
  const [selectedVesselId, setSelectedVesselId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<VesselData[]>({ queryKey: ["/api/vessels"], refetchInterval: 120000 });
  const { data: allEquipmentHealth = [], isLoading: healthLoading } = useQuery<EquipmentHealth[]>({ queryKey: ["/api/equipment/health"], refetchInterval: 120000 });
  const { data: latestTelemetry = [] } = useQuery<TelemetryReading[]>({ queryKey: ["/api/telemetry/latest", selectedVesselId], refetchInterval: 60000, enabled: viewMode === "status" });
  const { data: insightsData, isLoading: insightsLoading } = useQuery<FleetOverviewResponse>({ queryKey: ["/api/insights/v2/fleet-overview"], enabled: viewMode === "insights" });

  const isLoading = vesselsLoading || healthLoading || (viewMode === "insights" && insightsLoading);

  const equipmentHealth = useMemo(() => selectedVesselId === "all" ? allEquipmentHealth : allEquipmentHealth.filter((eq) => eq.vesselId === selectedVesselId), [allEquipmentHealth, selectedVesselId]);

  const fleetSummary = useMemo(() => {
    const targetEquipment = selectedVesselId === "all" ? allEquipmentHealth : equipmentHealth;
    return { total: targetEquipment.length, healthy: targetEquipment.filter((eq) => eq.status === "healthy").length, warning: targetEquipment.filter((eq) => eq.status === "warning").length, critical: targetEquipment.filter((eq) => eq.status === "critical").length, avgHealth: targetEquipment.length > 0 ? Math.round(targetEquipment.reduce((sum, eq) => sum + (eq.healthScore ?? 0), 0) / targetEquipment.length) : 0 };
  }, [allEquipmentHealth, equipmentHealth, selectedVesselId]);

  const insightsStats = useMemo(() => {
    if (!insightsData?.vessels) {return { total: 0, critical: 0, actionRequired: 0, monitor: 0, normal: 0 };}
    return insightsData.vessels.reduce((acc, vessel) => { vessel.insights.forEach((insight) => { acc.total++; if (insight.statusLevel === "critical") {acc.critical++;} else if (insight.statusLevel === "action_required") {acc.actionRequired++;} else if (insight.statusLevel === "monitor") {acc.monitor++;} else {acc.normal++;} }); return acc; }, { total: 0, critical: 0, actionRequired: 0, monitor: 0, normal: 0 });
  }, [insightsData]);

  const groupedEquipment = useMemo(() => {
    const groups: Record<string, EquipmentHealth[]> = {};
    equipmentHealth.forEach((eq) => { const type = eq.type || "Other"; if (!groups[type]) {groups[type] = [];} groups[type].push(eq); });
    Object.values(groups).forEach((group) => { group.sort((a, b) => { const statusOrder = { critical: 0, warning: 1, healthy: 2, unknown: 3 }; return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3); }); });
    return groups;
  }, [equipmentHealth]);

  const allVessels = useMemo(() => insightsData?.vessels ?? [], [insightsData]);

  const filteredVessels = useMemo(() => {
    if (!insightsData?.vessels) {return [];}
    return insightsData.vessels.map((vessel) => ({ ...vessel, insights: vessel.insights.filter((insight) => !statusFilter || insight.statusLevel === statusFilter) })).filter((vessel) => vessel.insights.length > 0);
  }, [insightsData, statusFilter]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["/api/equipment/health"] }), queryClient.invalidateQueries({ queryKey: ["/api/telemetry/latest"] }), queryClient.invalidateQueries({ queryKey: ["/api/insights/v2/fleet-overview"] })]);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const handleViewDetails = useCallback((equipmentId: string) => { navigate(`/health?equipmentId=${equipmentId}`); }, [navigate]);

  const toggleDarkMode = useCallback(() => { setDarkMode((prev) => !prev); }, []);

  return { vessels, allEquipmentHealth, latestTelemetry, insightsData, viewMode, setViewMode, darkMode, toggleDarkMode, selectedVesselId, setSelectedVesselId, statusFilter, setStatusFilter, isRefreshing, isLoading, insightsLoading, equipmentHealth, fleetSummary, insightsStats, groupedEquipment, allVessels, filteredVessels, handleRefresh, handleViewDetails };
}

export type { VesselData, EquipmentHealth, TelemetryReading, VesselInsights, FleetOverviewResponse, ViewMode };
