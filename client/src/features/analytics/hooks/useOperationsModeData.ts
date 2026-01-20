import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEquipmentHealthTyped, fetchAnomalyDetections, fetchFailurePredictions, fetchTelemetryTrends, fetchPdmScores } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { format } from "date-fns";

interface EquipmentHealthData { id: string; name?: string; healthIndex: number; }
interface TelemetryTrendData { baseline?: number; average?: number; currentValue?: number; }
interface FailurePredictionData { confidence?: number; }
interface PdmScoreData { equipmentId: string; timestamp: string; healthScore?: number; }
interface AnomalyData { id?: string; equipmentId: string; timestamp: string; }
interface EquipmentTrend { equipmentId: string; name: string; currentHealth: number; trendData: { timestamp: string; health: number; }[]; }

export function useOperationsModeData() {
  const { isConnected, latestTelemetry } = useWebSocket();
  const [acknowledgedAnomalies, setAcknowledgedAnomalies] = useState<Set<string>>(new Set());

  const { data: equipmentHealthResponse, isLoading: healthLoading } = useQuery({ queryKey: ["/api/equipment/health"], queryFn: () => fetchEquipmentHealthTyped(), refetchInterval: 120000, staleTime: 60000 });
  const { data: telemetryTrends = [] } = useQuery<TelemetryTrendData[]>({ queryKey: ["/api/telemetry/trends"], queryFn: () => fetchTelemetryTrends(), refetchInterval: 120000, staleTime: 60000 });
  const { data: anomaliesResponse } = useQuery({ queryKey: ["/api/analytics/anomalies"], queryFn: () => fetchAnomalyDetections({ page: 1, limit: 50 }), refetchInterval: 120000, staleTime: 60000 });
  const { data: failurePredictionsResponse } = useQuery({ queryKey: ["/api/analytics/predictions"], queryFn: () => fetchFailurePredictions({ page: 1, limit: 20 }), refetchInterval: 120000, staleTime: 60000 });
  const { data: pdmScores = [] } = useQuery<PdmScoreData[]>({ queryKey: ["/api/pdm/scores"], queryFn: () => fetchPdmScores(), refetchInterval: 120000, staleTime: 60000 });

  const equipmentHealth: EquipmentHealthData[] = equipmentHealthResponse?.results ?? [];
  const anomalies: AnomalyData[] = anomaliesResponse?.results ?? [];
  const failurePredictions: FailurePredictionData[] = failurePredictionsResponse?.results ?? [];

  const equipmentCategories = useMemo(() => ({ criticalEquipment: equipmentHealth.filter((eq) => eq.healthIndex < 30), warningEquipment: equipmentHealth.filter((eq) => eq.healthIndex >= 30 && eq.healthIndex < 50), healthyEquipment: equipmentHealth.filter((eq) => eq.healthIndex >= 75) }), [equipmentHealth]);

  const metrics = useMemo(() => {
    const driftingSensors = telemetryTrends.filter((trend) => { const baseline = trend.baseline || trend.average || 0; const current = trend.currentValue || 0; if (baseline === 0) {return false;} const deviation = Math.abs((current - baseline) / baseline) * 100; return deviation > 15; });
    const highConfidencePredictions = failurePredictions.filter((p) => (p.confidence || 0) >= 0.8);
    const avgPredictionConfidence = failurePredictions.length > 0 ? failurePredictions.reduce((sum, p) => sum + (p.confidence || 0), 0) / failurePredictions.length : 0;
    return { driftingSensors, highConfidencePredictions, avgPredictionConfidence };
  }, [telemetryTrends, failurePredictions]);

  const equipmentHealthTrends: EquipmentTrend[] = useMemo(() => equipmentHealth.map((eq) => { const eqScores = pdmScores.filter((s) => s.equipmentId === eq.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10); return { equipmentId: eq.id, name: eq.name || eq.id, currentHealth: eq.healthIndex, trendData: eqScores.map((s) => ({ timestamp: format(new Date(s.timestamp), "HH:mm"), health: s.healthScore ?? eq.healthIndex })).reverse() }; }).filter((eq) => eq.trendData.length > 0), [equipmentHealth, pdmScores]);

  const unacknowledgedAnomalies = useMemo(() => anomalies.filter((a) => !acknowledgedAnomalies.has(a.id || `${a.equipmentId}-${a.timestamp}`)), [anomalies, acknowledgedAnomalies]);

  const handleAcknowledge = useCallback((anomalyId: string) => { setAcknowledgedAnomalies((prev) => new Set(prev).add(anomalyId)); }, []);

  const getStatusColor = (status: string) => { switch (status) { case "normal": return "bg-green-500"; case "warning": return "bg-yellow-500"; case "critical": return "bg-red-500"; default: return "bg-gray-500"; } };

  return { isConnected, latestTelemetry, healthLoading, equipmentHealth, telemetryTrends, failurePredictions, ...equipmentCategories, ...metrics, equipmentHealthTrends, unacknowledgedAnomalies, acknowledgedAnomalies, handleAcknowledge, getStatusColor };
}
