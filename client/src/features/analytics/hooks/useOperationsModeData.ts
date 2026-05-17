// @ts-nocheck
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchEquipmentHealthTyped,
  fetchAnomalyDetections,
  fetchFailurePredictions,
  fetchTelemetryTrends,
  fetchPdmScores,
} from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { format } from "date-fns";
import type { AnomalyAckStatus } from "@/lib/severity";

interface EquipmentHealthData {
  id: string;
  name?: string;
  healthIndex: number;
  failureRisk?: number;
}
interface TelemetryTrendData {
  baseline?: number;
  average?: number;
  currentValue?: number;
  sensorType?: string;
  equipmentId?: string;
}
interface FailurePredictionData {
  id?: string;
  confidence?: number;
  equipmentId?: string;
  equipmentName?: string;
  predictedDate?: string;
  failureType?: string;
  timestamp?: string;
}
interface PdmScoreData {
  equipmentId: string;
  timestamp: string;
  healthScore?: number;
}
interface AnomalyData {
  id?: string;
  equipmentId: string;
  equipmentName?: string;
  sensorType?: string;
  value?: number;
  unit?: string;
  zscore?: number;
  timestamp: string;
}
interface EquipmentTrend {
  equipmentId: string;
  name: string;
  currentHealth: number;
  trendData: { timestamp: string; health: number }[];
}

const DRIFT_THRESHOLDS: Record<string, number> = {
  rpm: 25,
  engine_rpm: 25,
  fuel_flow: 30,
  fuel_consumption: 30,
  exhaust_temp: 20,
  bearing_temp: 8,
  bearing_temperature: 8,
  vibration: 10,
  vibration_level: 10,
  oil_pressure: 12,
  oil_temperature: 10,
  coolant_temp: 10,
  coolant_temperature: 10,
  power_output: 20,
};

const DEFAULT_DRIFT_THRESHOLD = 15;

function getDriftThreshold(sensorType?: string): number {
  if (!sensorType) {
    return DEFAULT_DRIFT_THRESHOLD;
  }
  const key = sensorType.toLowerCase().replace(/\s+/g, "_");
  return DRIFT_THRESHOLDS[key] ?? DEFAULT_DRIFT_THRESHOLD;
}

export function useOperationsModeData() {
  const { isConnected, latestTelemetry } = useWebSocket();
  const [anomalyAckState, setAnomalyAckState] = useState<Map<string, AnomalyAckStatus>>(new Map());

  const { data: equipmentHealthResponse, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/equipment/health"],
    queryFn: () => fetchEquipmentHealthTyped(),
    refetchInterval: 120000,
    staleTime: 60000,
  });
  const { data: telemetryTrends = [] } = useQuery<TelemetryTrendData[]>({
    queryKey: ["/api/telemetry/trends"],
    queryFn: () => fetchTelemetryTrends(),
    refetchInterval: 120000,
    staleTime: 60000,
  });
  const { data: anomaliesResponse } = useQuery({
    queryKey: ["/api/analytics/anomalies"],
    queryFn: () => fetchAnomalyDetections({ page: 1, limit: 50 }),
    refetchInterval: 120000,
    staleTime: 60000,
  });
  const { data: failurePredictionsResponse } = useQuery({
    queryKey: ["/api/analytics/predictions"],
    queryFn: () => fetchFailurePredictions({ page: 1, limit: 20 }),
    refetchInterval: 120000,
    staleTime: 60000,
  });
  const { data: pdmScores = [] } = useQuery<PdmScoreData[]>({
    queryKey: ["/api/pdm/scores"],
    queryFn: () => fetchPdmScores(),
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const equipmentHealth: EquipmentHealthData[] = equipmentHealthResponse?.results ?? [];
  const anomalies: AnomalyData[] = anomaliesResponse?.results ?? [];
  const failurePredictions: FailurePredictionData[] = failurePredictionsResponse?.results ?? [];

  const equipmentCategories = useMemo(
    () => ({
      criticalEquipment: equipmentHealth.filter((eq) => eq.healthIndex < 30),
      warningEquipment: equipmentHealth.filter((eq) => eq.healthIndex >= 30 && eq.healthIndex < 50),
      healthyEquipment: equipmentHealth.filter((eq) => eq.healthIndex >= 75),
    }),
    [equipmentHealth]
  );

  const metrics = useMemo(() => {
    const driftingSensors = telemetryTrends.filter((trend) => {
      const baseline = trend.baseline || trend.average || 0;
      const current = trend.currentValue || 0;
      if (baseline === 0) {
        return false;
      }
      const deviation = Math.abs((current - baseline) / baseline) * 100;
      const threshold = getDriftThreshold(trend.sensorType);
      return deviation > threshold;
    });
    const highConfidencePredictions = failurePredictions.filter((p) => (p.confidence || 0) >= 0.8);
    const avgPredictionConfidence =
      failurePredictions.length > 0
        ? failurePredictions.reduce((sum, p) => sum + (p.confidence || 0), 0) /
          failurePredictions.length
        : 0;
    return { driftingSensors, highConfidencePredictions, avgPredictionConfidence };
  }, [telemetryTrends, failurePredictions]);

  const equipmentHealthTrends: EquipmentTrend[] = useMemo(
    () =>
      equipmentHealth
        .map((eq) => {
          const eqScores = pdmScores
            .filter((s: (typeof pdmScores)[number]) => s.equipmentId === eq.id)
            .sort(
              (a: (typeof pdmScores)[number], b: (typeof pdmScores)[number]) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            .slice(0, 10);
          return {
            equipmentId: eq.id,
            name: eq.name || eq.id,
            currentHealth: eq.healthIndex,
            trendData: eqScores
              .map((s: (typeof eqScores)[number]) => ({
                timestamp: format(new Date(s.timestamp), "HH:mm"),
                health: s.healthScore ?? eq.healthIndex,
              }))
              .reverse(),
          };
        })
        .filter((eq) => eq.trendData.length > 0),
    [equipmentHealth, pdmScores]
  );

  const getAnomalyId = useCallback(
    (a: AnomalyData) => a.id || `${a.equipmentId}-${a.sensorType || "unknown"}-${a.timestamp}`,
    []
  );

  const unacknowledgedAnomalies = useMemo(
    () =>
      anomalies.filter((a) => {
        const id = getAnomalyId(a);
        const status = anomalyAckState.get(id);
        return !status || status === "unacknowledged";
      }),
    [anomalies, anomalyAckState, getAnomalyId]
  );

  const watchingAnomalies = useMemo(
    () =>
      anomalies.filter((a) => {
        const id = getAnomalyId(a);
        return anomalyAckState.get(id) === "watching";
      }),
    [anomalies, anomalyAckState, getAnomalyId]
  );

  const acknowledgedCount = useMemo(() => {
    let count = 0;
    anomalyAckState.forEach((status) => {
      if (status === "acknowledged") {
        count++;
      }
    });
    return count;
  }, [anomalyAckState]);

  const setAnomalyStatus = useCallback((anomalyId: string, status: AnomalyAckStatus) => {
    setAnomalyAckState((prev) => {
      const next = new Map(prev);
      next.set(anomalyId, status);
      return next;
    });
  }, []);

  const handleAcknowledge = useCallback(
    (anomalyId: string) => {
      setAnomalyStatus(anomalyId, "acknowledged");
    },
    [setAnomalyStatus]
  );

  const handleWatch = useCallback(
    (anomalyId: string) => {
      setAnomalyStatus(anomalyId, "watching");
    },
    [setAnomalyStatus]
  );

  const getAnomalyAckStatus = useCallback(
    (anomalyId: string): AnomalyAckStatus => {
      return anomalyAckState.get(anomalyId) ?? "unacknowledged";
    },
    [anomalyAckState]
  );

  return {
    isConnected,
    latestTelemetry,
    healthLoading,
    equipmentHealth,
    telemetryTrends,
    failurePredictions,
    ...equipmentCategories,
    ...metrics,
    equipmentHealthTrends,
    unacknowledgedAnomalies,
    watchingAnomalies,
    acknowledgedCount,
    anomalyAckState,
    handleAcknowledge,
    handleWatch,
    getAnomalyAckStatus,
    getAnomalyId,
    getDriftThreshold,
  };
}

export { getDriftThreshold, DRIFT_THRESHOLDS, DEFAULT_DRIFT_THRESHOLD };
