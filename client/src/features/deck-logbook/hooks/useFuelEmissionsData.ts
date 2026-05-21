import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FuelEmissionsLog } from "@shared/schema";

interface FuelSummary {
  totalFuelMt: number;
  totalCo2Mt: number;
  avgCii: number;
  ciiRating: string;
  distanceNm: number;
  runningHours: number;
}
interface FMCCStatus {
  ok: boolean;
  fmcc: {
    enabled: boolean;
    ready: boolean;
    restApiConfigured: boolean;
    modbusConfigured: boolean;
    connectionStatus: string;
  };
  capabilities: string[];
}

export function useFuelEmissionsData() {
  const { toast } = useToast();
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("7d");
  const [activeTab, setActiveTab] = useState("overview");

  const dateParams = useMemo(() => {
    const end = endOfDay(new Date());
    let start: Date;
    switch (dateRange) {
      case "24h":
        start = subDays(end, 1);
        break;
      case "7d":
        start = subDays(end, 7);
        break;
      case "30d":
        start = subDays(end, 30);
        break;
      case "90d":
        start = subDays(end, 90);
        break;
      default:
        start = subDays(end, 7);
    }
    return { start: startOfDay(start), end };
  }, [dateRange]);

  const { data: vessels = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/vessels"],
  });
  const {
    data: logs = [],
    isLoading: logsLoading,
    refetch: _refetchLogs,
  } = useQuery<FuelEmissionsLog[]>({
    queryKey: [
      "/api/logbook/fuel-emissions",
      {
        vesselId: selectedVessel || undefined,
        startDate: dateParams.start.toISOString(),
        endDate: dateParams.end.toISOString(),
      },
    ],
    enabled: true,
  });
  const { data: summary, isLoading: summaryLoading } = useQuery<FuelSummary>({
    queryKey: [
      "/api/logbook/fuel-emissions/summary",
      {
        vesselId: selectedVessel,
        startDate: dateParams.start.toISOString(),
        endDate: dateParams.end.toISOString(),
      },
    ],
    enabled: !!selectedVessel,
  });
  const { data: fmccStatus } = useQuery<FMCCStatus>({
    queryKey: ["/api/integrations/fmcc/status"],
    staleTime: 60000,
    refetchInterval: 300000,
  });

  const autoFillMutation = useMutation({
    mutationFn: async (vesselId: string) =>
      apiRequest("/api/logbook/fuel-emissions/autofill", {
        method: "POST",
        body: JSON.stringify({
          vesselId,
          startDate: dateParams.start.toISOString(),
          endDate: dateParams.end.toISOString(),
          periodType: "hourly",
        }),
      }) as Promise<{ recordsCreated?: number; recordsSkipped?: number }>,
    onSuccess: (data: { recordsCreated?: number; recordsSkipped?: number }) => {
      toast({
        title: "Auto-fill Complete",
        description: `Created ${data.recordsCreated} fuel/emissions records`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/logbook/fuel-emissions"] });
    },
    onError: (error) => {
      toast({
        title: "Auto-fill Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const totals = useMemo(() => {
    const ls = logs as Array<FuelEmissionsLog & Record<string, number | string | null | undefined>>;
    const totalFuel = ls.reduce((sum, log) => sum + (log.totalFuelMt || 0), 0);
    const totalCo2 = ls.reduce((sum, log) => sum + (log.co2EmissionsMt || 0), 0);
    const totalDistance = ls.reduce((sum, log) => sum + (log.distanceNm || 0), 0);
    const avgEfficiency = totalDistance > 0 ? totalFuel / totalDistance : 0;
    const latestCiiRating = ls.length > 0 ? ls[0].ciiRating || "N/A" : "N/A";
    const totalFo = ls.reduce((sum, l) => sum + (l.foConsumptionMt || 0), 0);
    const totalDo = ls.reduce((sum, l) => sum + (l.doConsumptionMt || 0), 0);
    const totalSox = ls.reduce((sum, l) => sum + (l.soxEmissionsKg || 0), 0);
    const totalNox = ls.reduce((sum, l) => sum + (l.noxEmissionsKg || 0), 0);
    return {
      totalFuel,
      totalCo2,
      totalDistance,
      avgEfficiency,
      latestCiiRating,
      totalFo,
      totalDo,
      totalSox,
      totalNox,
    };
  }, [logs]);

  const handleAutoFill = useCallback(
    (vesselId: string) => {
      autoFillMutation.mutate(vesselId);
    },
    [autoFillMutation]
  );

  return {
    vessels,
    logs,
    logsLoading,
    summary,
    summaryLoading,
    fmccStatus,
    selectedVessel,
    setSelectedVessel,
    dateRange,
    setDateRange,
    activeTab,
    setActiveTab,
    ...totals,
    autoFillMutation,
    handleAutoFill,
  };
}

export type { FuelSummary, FMCCStatus };
