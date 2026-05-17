// @ts-nocheck
import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import type { Vessel, Equipment, DtcFault, DtcDefinition } from "@shared/schema";

interface EnrichedDtcFault extends DtcFault {
  definition?: DtcDefinition;
  equipmentId?: string;
}

export const dtcDiagnosticsKeys = {
  vessels: ["/api/vessels"] as const,
  equipment: ["/api/equipment"] as const,
  activeDtc: (equipmentId: string) => [`/api/equipment/${equipmentId}/dtc/active`] as const,
};

export function useDTCDiagnosticsData() {
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: dtcDiagnosticsKeys.vessels,
    refetchInterval: 300000,
  });

  const { data: allEquipment = [] } = useQuery<Equipment[]>({
    queryKey: dtcDiagnosticsKeys.equipment,
    refetchInterval: 60000,
  });

  const filteredEquipment = useMemo(
    () =>
      selectedVessel === "all"
        ? allEquipment
        : allEquipment.filter((eq) => eq.vesselId === selectedVessel),
    [allEquipment, selectedVessel]
  );

  const equipmentIds = useMemo(
    () =>
      selectedEquipment === "all" ? filteredEquipment.map((eq) => eq.id) : [selectedEquipment],
    [selectedEquipment, filteredEquipment]
  );

  const dtcQueries = useQueries({
    queries: equipmentIds.map((eqId) => ({
      queryKey: dtcDiagnosticsKeys.activeDtc(eqId),
      refetchInterval: 60000,
    })),
  });

  const activeDtcQueries = useMemo(() => {
    const hasError = dtcQueries.some((q) => q.isError);
    const isLoading = dtcQueries.some((q) => q.isLoading);
    const data = dtcQueries.flatMap((q, idx) => {
      const queryData = q.data as EnrichedDtcFault[] | undefined;
      if (!queryData || !Array.isArray(queryData)) {
        return [];
      }
      return queryData.map((dtc) => ({ ...dtc, equipmentId: equipmentIds[idx] }));
    });
    return { isLoading, isError: hasError, data };
  }, [dtcQueries, equipmentIds]);

  const activeDtcs = useMemo(() => activeDtcQueries.data ?? [], [activeDtcQueries.data]);

  const filteredActiveDtcs = useMemo(() => {
    if (!searchQuery) {
      return activeDtcs;
    }
    const query = searchQuery.toLowerCase();
    return activeDtcs.filter(
      (dtc) =>
        dtc.spn?.toString().includes(query) ||
        dtc.fmi?.toString().includes(query) ||
        dtc.definition?.description?.toLowerCase().includes(query) ||
        dtc.definition?.spnName?.toLowerCase().includes(query) ||
        dtc.definition?.fmiName?.toLowerCase().includes(query)
    );
  }, [activeDtcs, searchQuery]);

  const stats = useMemo(
    () => ({
      total: activeDtcs.length,
      critical: activeDtcs.filter(
        (dtc) => dtc.definition?.severity === 1 || dtc.definition?.severity === 2
      ).length,
      warning: activeDtcs.filter((dtc) => dtc.definition?.severity === 3).length,
      info: activeDtcs.filter((dtc) => dtc.definition?.severity === 4).length,
    }),
    [activeDtcs]
  );

  const getSeverityColor = useCallback((severity?: number) => {
    switch (severity) {
      case 1:
      case 2:
        return "destructive";
      case 3:
        return "default";
      case 4:
        return "secondary";
      default:
        return "outline";
    }
  }, []);

  const getSeverityLabel = useCallback((severity?: number) => {
    switch (severity) {
      case 1:
        return "critical";
      case 2:
        return "high";
      case 3:
        return "moderate";
      case 4:
        return "low";
      default:
        return "unknown";
    }
  }, []);

  const handleVesselChange = useCallback((value: string) => {
    setSelectedVessel(value);
    setSelectedEquipment("all");
  }, []);

  const getEquipmentForDtc = useCallback(
    (dtcEquipmentId?: string) => allEquipment.find((eq) => eq.id === dtcEquipmentId),
    [allEquipment]
  );

  const getVesselForEquipment = useCallback(
    (equipment?: Equipment) => vessels.find((v) => v.id === equipment?.vesselId),
    [vessels]
  );

  return {
    vessels,
    allEquipment,
    filteredEquipment,
    selectedVessel,
    setSelectedVessel: handleVesselChange,
    selectedEquipment,
    setSelectedEquipment,
    searchQuery,
    setSearchQuery,
    activeDtcQueries,
    filteredActiveDtcs,
    stats,
    getSeverityColor,
    getSeverityLabel,
    getEquipmentForDtc,
    getVesselForEquipment,
  };
}
