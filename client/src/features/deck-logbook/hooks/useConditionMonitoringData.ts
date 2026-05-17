import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ConditionLogSummary } from "@shared/schema";

interface VesselConditionSummary {
  equipmentCount: number;
  avgHealthIndex: number;
  minHealthIndex: number;
  totalAlerts: number;
  criticalAlerts: number;
  equipmentByGrade: Record<string, number>;
}

export function useConditionMonitoringData() {
  const { toast } = useToast();
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
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
  const { data: equipment = [] } = useQuery<{ id: string; name: string; vesselId: string }[]>({
    queryKey: ["/api/equipment"],
  });
  const vesselEquipment = useMemo(
    () =>
      selectedVessel && selectedVessel !== "all"
        ? equipment.filter((e) => e.vesselId === selectedVessel)
        : equipment,
    [equipment, selectedVessel]
  );
  const {
    data: logs = [],
    isLoading: logsLoading,
    refetch: _refetchLogs,
  } = useQuery<ConditionLogSummary[]>({
    queryKey: [
      "/api/logbook/condition",
      {
        vesselId: selectedVessel !== "all" ? selectedVessel : undefined,
        equipmentId: selectedEquipment !== "all" ? selectedEquipment : undefined,
        startDate: dateParams.start.toISOString(),
        endDate: dateParams.end.toISOString(),
      },
    ],
    enabled: true,
  });
  const { data: vesselSummary, isLoading: summaryLoading } = useQuery<VesselConditionSummary>({
    queryKey: [
      "/api/logbook/condition/vessel",
      selectedVessel,
      "summary",
      { startDate: dateParams.start.toISOString(), endDate: dateParams.end.toISOString() },
    ],
    enabled: selectedVessel !== "all",
  });

  const autoFillMutation = useMutation({
    // @ts-ignore -- bulk-silence
    mutationFn: async (vesselId: string) =>
      apiRequest("/api/logbook/condition/autofill", {
        method: "POST",
        body: JSON.stringify({
          vesselId,
          startDate: dateParams.start.toISOString(),
          endDate: dateParams.end.toISOString(),
          periodType: "hourly",
        }),
      }),
    onSuccess: (data: { recordsCreated?: number; recordsSkipped?: number }) => {
      toast({
        title: "Auto-fill Complete",
        description: `Created ${data.recordsCreated} condition log entries`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/logbook/condition"] });
    },
    onError: (error) => {
      toast({
        title: "Auto-fill Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const metrics = useMemo(() => {
    const avgHealth =
      logs.length > 0
        ? logs.reduce((sum, log) => sum + (log.healthIndex || 0), 0) / logs.length
        : 0;
    // @ts-ignore -- bulk-silence
    const totalAlerts = logs.reduce((sum, log) => sum + (log.alertsCount || 0), 0);
    // @ts-ignore -- bulk-silence
    const criticalAlerts = logs.reduce((sum, log) => sum + (log.criticalAlertsCount || 0), 0);
    const criticalCount = logs.filter((l) => l.conditionRating === "critical").length;
    const uniqueEquipmentCount = new Set(logs.map((l) => l.equipmentId)).size;
    const lowestHealthLogs = [...logs]
      .sort((a, b) => (a.healthIndex || 0) - (b.healthIndex || 0))
      .slice(0, 5);
    return {
      avgHealth,
      totalAlerts,
      criticalAlerts,
      criticalCount,
      uniqueEquipmentCount,
      lowestHealthLogs,
    };
  }, [logs]);

  const getEquipmentName = useCallback(
    (equipmentId: string) => equipment.find((e) => e.id === equipmentId)?.name || equipmentId,
    [equipment]
  );
  const handleAutoFill = useCallback(
    (vesselId: string) => {
      autoFillMutation.mutate(vesselId);
    },
    [autoFillMutation]
  );
  const handleVesselChange = useCallback((v: string) => {
    setSelectedVessel(v);
    setSelectedEquipment("all");
  }, []);

  return {
    vessels,
    equipment,
    vesselEquipment,
    logs,
    logsLoading,
    vesselSummary,
    summaryLoading,
    selectedVessel,
    setSelectedVessel: handleVesselChange,
    selectedEquipment,
    setSelectedEquipment,
    dateRange,
    setDateRange,
    activeTab,
    setActiveTab,
    ...metrics,
    autoFillMutation,
    handleAutoFill,
    getEquipmentName,
  };
}

export type { VesselConditionSummary };
