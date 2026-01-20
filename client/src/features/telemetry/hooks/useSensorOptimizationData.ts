import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export interface Equipment { id: string; name: string; type: string; manufacturer?: string; model?: string; vesselId?: string; vesselName?: string; }
export interface Vessel { id: string; name: string; }
interface ThresholdValues { warnLo?: number; warnHi?: number; critLo?: number; critHi?: number; }
interface ImprovementMetrics { falsePositiveReduction?: number; sensitivityImprovement?: number; }
interface OptimizationMetadata { confidence?: number; sampleSize?: number; }
export interface ThresholdOptimization { id: number; equipmentId: string; sensorType: string; equipmentType: string; optimizationTimestamp: string; currentThresholds: ThresholdValues; optimizedThresholds: ThresholdValues; improvementMetrics: ImprovementMetrics; optimizationMethod: string; status: string; metadata: OptimizationMetadata; }
export interface SensorRecommendation { sensorType: string; parameters: { gain?: number; offset?: number; emaAlpha?: number; hysteresis?: number; warnLo?: number; warnHi?: number; critLo?: number; critHi?: number; }; reasoning: string; confidence: "high" | "medium" | "low"; sources: string[]; }

export function useSensorOptimizationData() {
  const [selectedEquipment, setSelectedEquipment] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("statistical");
  const [sortField, setSortField] = useState<string>("equipment");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: equipment = [], isLoading: equipmentLoading } = useQuery<Equipment[]>({ queryKey: ["/api/equipment"], staleTime: 30000 });
  const { data: vessels = [] } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"], staleTime: 30000 });
  const { data: statisticalRecs = [], isLoading: statsLoading, refetch: refetchStats } = useQuery<ThresholdOptimization[]>({ queryKey: ["/api/sensor-optimization/recommendations"], enabled: activeTab === "statistical" });
  const { data: aiRecommendations, isLoading: aiLoading, error: aiError, refetch: refetchAI } = useQuery<{ recommendations: SensorRecommendation[] }>({ queryKey: [`/api/sensor-tuning/recommendations/${selectedEquipment}`], enabled: activeTab === "ai" && !!selectedEquipment, retry: false });

  const analyzeMutation = useCustomMutation({ mutationFn: async (equipmentId: string) => { return apiRequest("POST", `/api/sensor-optimization/analyze/${equipmentId}`, { daysOfHistory: 30 }); }, invalidateKeys: [["/api/sensor-optimization/recommendations"]], successMessage: "Sensor threshold recommendations generated successfully.", errorMessage: (error: unknown) => error instanceof Error ? error.message : "Failed to analyze sensor data", onSuccess: () => { refetchStats(); } });
  const applyOptimizationMutation = useCustomMutation({ mutationFn: async (optimizationId: number) => { return apiRequest("POST", `/api/sensor-optimization/apply/${optimizationId}`, undefined); }, invalidateKeys: [["/api/sensor-optimization/recommendations"], ["/api/sensor-configs"]], successMessage: "Threshold optimization has been applied.", errorMessage: (error: unknown) => error instanceof Error ? error.message : "Could not apply optimization", onSuccess: () => { refetchStats(); } });
  const rejectOptimizationMutation = useCustomMutation({ mutationFn: async ({ id, reason }: { id: number; reason: string }) => { return apiRequest("POST", `/api/sensor-optimization/reject/${id}`, { reason }); }, invalidateKeys: [["/api/sensor-optimization/recommendations"]], successMessage: "Optimization has been rejected.", onSuccess: () => { refetchStats(); } });
  const applyAIRecommendationMutation = useCustomMutation({ mutationFn: async ({ equipmentId, sensorType, parameters }: { equipmentId: string; sensorType: string; parameters: SensorRecommendation["parameters"] }) => { return apiRequest("POST", `/api/sensor-tuning/apply/${equipmentId}/${sensorType}`, { parameters }); }, invalidateKeys: [["/api/sensor-configs"]], successMessage: "AI-recommended parameters have been applied to the sensor.", errorMessage: (error: unknown) => error instanceof Error ? error.message : "Could not apply AI recommendations" });

  const getConfidenceBadgeVariant = useCallback((confidence: string): "default" | "secondary" | "outline" => { const variants: Record<string, "default" | "secondary" | "outline"> = { high: "default", medium: "secondary", low: "outline" }; return variants[confidence] || "outline"; }, []);
  const getStatusBadge = useCallback((status: string | null | undefined): { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof AlertTriangle; label: string } => { if (!status) {return { variant: "outline", icon: AlertTriangle, label: "Unknown" };} const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof AlertTriangle }> = { pending_review: { variant: "secondary", icon: AlertTriangle }, applied: { variant: "default", icon: CheckCircle2 }, rejected: { variant: "destructive", icon: XCircle } }; const config = variants[status] || { variant: "outline", icon: AlertTriangle }; return { ...config, label: status.replace("_", " ") }; }, []);
  const getVesselName = useCallback((equipmentId: string): string => { const eq = equipment.find((e) => e.id === equipmentId); if (!eq) {return "Unknown";} if (eq.vesselName) {return eq.vesselName;} if (eq.vesselId) { const vessel = vessels.find((v) => v.id === eq.vesselId); return vessel?.name || "Unknown"; } return "Unassigned"; }, [equipment, vessels]);
  const formatSensorName = useCallback((sensorType: string): string => { if (!sensorType) {return "Unknown Sensor";} const formatted = sensorType.replaceAll('_', " ").replace(/([A-Z])/g, " $1").split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ").trim(); return formatted || sensorType; }, []);
  const handleSort = useCallback((field: string) => { if (sortField === field) { setSortDirection(sortDirection === "asc" ? "desc" : "asc"); } else { setSortField(field); setSortDirection("asc"); } }, [sortField, sortDirection]);

  const sortedRecs = useMemo(() => [...statisticalRecs].sort((a, b) => {
    let aValue: string | number, bValue: string | number;
    switch (sortField) { case "equipment": aValue = equipment.find((e) => e.id === a.equipmentId)?.name || a.equipmentId; bValue = equipment.find((e) => e.id === b.equipmentId)?.name || b.equipmentId; break; case "vessel": aValue = getVesselName(a.equipmentId); bValue = getVesselName(b.equipmentId); break; case "sensor": aValue = a.sensorType; bValue = b.sensorType; break; case "confidence": aValue = a.metadata?.confidence || 0; bValue = b.metadata?.confidence || 0; break; case "status": aValue = a.status || ""; bValue = b.status || ""; break; default: return 0; }
    if (aValue < bValue) {return sortDirection === "asc" ? -1 : 1;} if (aValue > bValue) {return sortDirection === "asc" ? 1 : -1;} return 0;
  }), [statisticalRecs, sortField, sortDirection, equipment, getVesselName]);

  return {
    selectedEquipment, setSelectedEquipment, activeTab, setActiveTab, sortField, sortDirection,
    equipment, equipmentLoading, statisticalRecs, statsLoading, aiRecommendations, aiLoading, aiError, sortedRecs,
    analyzeMutation, applyOptimizationMutation, rejectOptimizationMutation, applyAIRecommendationMutation,
    refetchAI, handleSort, getConfidenceBadgeVariant, getStatusBadge, getVesselName, formatSensorName,
  };
}
