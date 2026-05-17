/**
 * useTelemetryStreams Hook
 *
 * Fetches and merges telemetry trends with anomalies for unified display.
 * Supports vessel/equipment filtering and time range selection.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchTelemetryTrends } from "@/lib/api/equipment";
import { fetchAnomalyDetections } from "@/lib/api";

export interface TelemetryStreamData {
  equipmentId: string;
  sensorType: string;
  currentValue: number;
  unit: string;
  status: "normal" | "warning" | "critical";
  hasAnomaly: boolean;
  anomalyZScore?: number;
  anomalyTimestamp?: string;
  data: Array<{ timestamp: string; value: number }>;
  lastUpdate: string;
}

export interface UseTelemetryStreamsOptions {
  vesselId?: string;
  equipmentId?: string;
  hours?: number;
  refreshInterval?: number;
  enabled?: boolean;
}

export function useTelemetryStreams(options: UseTelemetryStreamsOptions = {}) {
  const { vesselId, equipmentId, hours = 1, refreshInterval = 5000, enabled = true } = options;

  const trendsQuery = useQuery({
    queryKey: ["/api/telemetry/trends", vesselId, equipmentId, hours],
    queryFn: () => fetchTelemetryTrends(vesselId, equipmentId, hours),
    refetchInterval: enabled ? refreshInterval : false,
    staleTime: 0,
    enabled,
  });

  const anomaliesQuery = useQuery({
    queryKey: ["/api/analytics/anomalies", vesselId, equipmentId],
    queryFn: () =>
      fetchAnomalyDetections({
        page: 1,
        limit: 100,
        ...(vesselId && { vesselId }),
        ...(equipmentId && { equipmentId }),
      }),
    refetchInterval: enabled ? refreshInterval : false,
    staleTime: 0,
    enabled,
  });

  const streams: TelemetryStreamData[] = [];
  const trends = trendsQuery.data ?? [];
  const anomalies = anomaliesQuery.data?.results ?? [];

  for (const trend of trends as any[]) {
    const matchingAnomalies = (anomalies as any[]).filter(
      (a: any) => a.equipmentId === trend.equipmentId && a.sensorType === trend.sensorType
    );
    const latestAnomaly = matchingAnomalies[0];

    streams.push({
      equipmentId: trend.equipmentId,
      sensorType: trend.sensorType,
      currentValue: trend.currentValue ?? trend.average ?? 0,
      unit: trend.unit ?? "",
      status: trend.status ?? "normal",
      hasAnomaly: matchingAnomalies.length > 0,
      anomalyZScore: latestAnomaly?.zscore,
      anomalyTimestamp: latestAnomaly?.timestamp,
      data: trend.data ?? [],
      lastUpdate: trend.lastTimestamp ?? new Date().toISOString(),
    });
  }

  const sortedStreams = [...streams].sort((a, b) => {
    if (a.hasAnomaly && !b.hasAnomaly) {
      return -1;
    }
    if (!a.hasAnomaly && b.hasAnomaly) {
      return 1;
    }
    if (a.status === "critical" && b.status !== "critical") {
      return -1;
    }
    if (a.status !== "critical" && b.status === "critical") {
      return 1;
    }
    return 0;
  });

  return {
    streams: sortedStreams,
    isLoading: trendsQuery.isLoading || anomaliesQuery.isLoading,
    isError: trendsQuery.isError || anomaliesQuery.isError,
    error: trendsQuery.error || anomaliesQuery.error,
    refetch: () => {
      trendsQuery.refetch();
      anomaliesQuery.refetch();
    },
  };
}
