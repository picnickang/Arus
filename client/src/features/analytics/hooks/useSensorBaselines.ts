/**
 * Sensor baseline + live-telemetry hooks for the PdM equipment detail
 * view (extracted from usePdmEquipmentDetailData).
 *
 * - useSensorBaselines: each sensor's expected operating envelope
 *   (median ± 2σ over a trailing window) from
 *   GET /api/telemetry/baseline/:equipmentId — rendered by
 *   MultiSensorChart as a band behind the live series.
 * - useLiveTelemetryInvalidation: refetches the history query when the
 *   batch writer pushes committed readings for this equipment over the
 *   throttled "telemetry_batch" WebSocket channel, so charts tick within
 *   ~250ms of a flush instead of waiting for the 60s poll.
 */

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useWebSocket } from "@/hooks/useWebSocket";

/** Shape mirrors the server response in server/domains/telemetry/routes.ts. */
export interface SensorBaselineStat {
  sensorType: string;
  p50: number;
  avg: number;
  stddev: number;
  min: number;
  max: number;
  sampleCount: number;
  bandLow: number;
  bandHigh: number;
}

/**
 * Runtime guard for the GET /api/telemetry/baseline wire response. Mirrors
 * SensorBaselineStat; the server emits every field as a JS number via Number(),
 * so a strict numeric schema does not reject valid payloads.
 */
const sensorBaselineResponseSchema = z.object({
  baselines: z.array(
    z.object({
      sensorType: z.string(),
      p50: z.number(),
      avg: z.number(),
      stddev: z.number(),
      min: z.number(),
      max: z.number(),
      sampleCount: z.number(),
      bandLow: z.number(),
      bandHigh: z.number(),
    })
  ),
});

export type SensorBaselineBands = Record<
  string,
  { p50: number; bandLow: number; bandHigh: number }
>;

export function useSensorBaselines(equipmentId: string): SensorBaselineBands {
  const { currentOrgId } = useOrganization();

  const { data: baselineResponse } = useQuery<{ baselines: SensorBaselineStat[] }>({
    queryKey: ["/api/telemetry/baseline", equipmentId, currentOrgId],
    queryFn: async () => {
      try {
        // apiRequest attaches the in-memory session token — a raw fetch()
        // here would be unauthenticated and 401 silently.
        const raw = await apiRequest<unknown>(
          "GET",
          `/api/telemetry/baseline/${equipmentId}?days=30`
        );
        const parsed = sensorBaselineResponseSchema.safeParse(raw);
        return parsed.success ? parsed.data : { baselines: [] };
      } catch {
        return { baselines: [] };
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  return useMemo(() => {
    const bySensor: SensorBaselineBands = {};
    for (const b of baselineResponse?.baselines ?? []) {
      bySensor[b.sensorType] = { p50: b.p50, bandLow: b.bandLow, bandHigh: b.bandHigh };
    }
    return bySensor;
  }, [baselineResponse]);
}

export function useLiveTelemetryInvalidation(equipmentId: string): void {
  const { lastMessage } = useWebSocket();
  useEffect(() => {
    if (!lastMessage || !equipmentId) {
      return;
    }
    if (lastMessage.type !== "telemetry" && lastMessage.type !== "telemetry_batch") {
      return;
    }
    const entries = Array.isArray(lastMessage.data) ? lastMessage.data : [lastMessage.data];
    const concernsThisEquipment = entries.some(
      (entry) => Boolean(entry) && (entry as { equipmentId?: string }).equipmentId === equipmentId
    );
    if (concernsThisEquipment) {
      void queryClient.invalidateQueries({
        queryKey: ["/api/telemetry/history-multi", equipmentId],
      });
    }
  }, [lastMessage, equipmentId]);
}
