// @ts-nocheck
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VesselTrackLog } from "@shared/schema";

interface TrackStats {
  totalDistanceNm: number;
  avgSpeedKn: number;
  maxSpeedKn: number;
  trackPointCount: number;
  startPosition: { lat: number; lon: number } | null;
  endPosition: { lat: number; lon: number } | null;
}
interface Position {
  latitude: number;
  longitude: number;
  timestamp: Date;
  sog?: number;
  cog?: number;
}

export function useVesselTrackData() {
  const { toast } = useToast();
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("24h");
  const [activeTab, setActiveTab] = useState("overview");

  const dateParams = useMemo(() => {
    const end = endOfDay(new Date());
    let start: Date;
    switch (dateRange) {
      case "1h":
        start = new Date(end.getTime() - 60 * 60 * 1000);
        break;
      case "6h":
        start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
        break;
      case "24h":
        start = subDays(end, 1);
        break;
      case "7d":
        start = subDays(end, 7);
        break;
      default:
        start = subDays(end, 1);
    }
    return { start: startOfDay(start), end };
  }, [dateRange]);

  const { data: vessels = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/vessels"],
  });
  const {
    data: tracks = [],
    isLoading: tracksLoading,
    refetch: _refetchTracks,
  } = useQuery<VesselTrackLog[]>({
    queryKey: [
      "/api/logbook/track",
      {
        vesselId: selectedVessel,
        startDate: dateParams.start.toISOString(),
        endDate: dateParams.end.toISOString(),
      },
    ],
    enabled: !!selectedVessel,
  });
  const { data: stats, isLoading: statsLoading } = useQuery<TrackStats>({
    queryKey: [
      "/api/logbook/track/stats",
      {
        vesselId: selectedVessel,
        startDate: dateParams.start.toISOString(),
        endDate: dateParams.end.toISOString(),
      },
    ],
    enabled: !!selectedVessel,
  });
  const { data: lastPosition } = useQuery<Position>({
    queryKey: ["/api/logbook/track/last-position", { vesselId: selectedVessel }],
    enabled: !!selectedVessel,
    refetchInterval: 30000,
  });

  const processTelemetryMutation = useMutation({
    mutationFn: async (vesselId: string) =>
      apiRequest("/api/logbook/track/process-telemetry", {
        method: "POST",
        body: JSON.stringify({
          vesselId,
          startDate: dateParams.start.toISOString(),
          endDate: dateParams.end.toISOString(),
        }),
      }),
    onSuccess: (data: { recordsCreated?: number; recordsSkipped?: number }) => {
      toast({
        title: "Track Processing Complete",
        description: `Created ${data.recordsCreated} track points, skipped ${data.recordsSkipped}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/logbook/track"] });
    },
    onError: (error) => {
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const navStatusDistribution = useMemo(
    () =>
      tracks.reduce(
        (acc, t) => {
          const status = t.navStatus || "unknown";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    [tracks]
  );
  const selectedVesselName = useMemo(
    () => vessels.find((v) => v.id === selectedVessel)?.name || "Select a vessel",
    [vessels, selectedVessel]
  );

  const handleProcessTelemetry = useCallback(
    (vesselId: string) => {
      processTelemetryMutation.mutate(vesselId);
    },
    [processTelemetryMutation]
  );
  const exportGpx = useCallback(() => {
    if (!selectedVessel) {
      return;
    }
    const vesselName = vessels.find((v) => v.id === selectedVessel)?.name || "vessel";
    const url = `/api/logbook/track/export/gpx?vesselId=${selectedVessel}&vesselName=${encodeURIComponent(vesselName)}&startDate=${dateParams.start.toISOString()}&endDate=${dateParams.end.toISOString()}`;
    globalThis.open(url, "_blank");
  }, [selectedVessel, vessels, dateParams]);

  return {
    vessels,
    tracks,
    tracksLoading,
    stats,
    statsLoading,
    lastPosition,
    selectedVessel,
    setSelectedVessel,
    dateRange,
    setDateRange,
    activeTab,
    setActiveTab,
    selectedVesselName,
    navStatusDistribution,
    processTelemetryMutation,
    handleProcessTelemetry,
    exportGpx,
  };
}

export function formatCoordinate(value: number, type: "lat" | "lon"): string {
  const direction = type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  const absValue = Math.abs(value);
  const degrees = Math.floor(absValue);
  const minutes = ((absValue - degrees) * 60).toFixed(3);
  return `${degrees}° ${minutes}' ${direction}`;
}

export type { TrackStats, Position };
