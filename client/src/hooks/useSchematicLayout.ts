import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface SchematicSlot {
  slotId: string;
  label: string;
  category: string;
  typeMatch: string[];
}

export interface SchematicZone {
  zoneId: string;
  label: string;
  order: number;
  slotIds: string[];
}

export interface SchematicLayout {
  zones: SchematicZone[];
  slots: SchematicSlot[];
}

export function getDefaultLayout(): SchematicLayout {
  return {
    zones: [
      { zoneId: "bow-thruster", label: "Bow / Thruster", order: 0, slotIds: ["bow"] },
      { zoneId: "bridge-nav", label: "Bridge / Navigation", order: 1, slotIds: ["dp", "comp"] },
      { zoneId: "main-deck", label: "Main Deck", order: 2, slotIds: ["crane"] },
      { zoneId: "engine-room", label: "Engine Room", order: 3, slotIds: ["me", "gen1", "gen2"] },
      { zoneId: "tank-cargo", label: "Tank / Cargo", order: 4, slotIds: ["fuel", "pump1", "elec"] },
    ],
    slots: [
      { slotId: "me", label: "Main Engine", category: "propulsion", typeMatch: ["engine", "main engine", "propulsion"] },
      { slotId: "gen1", label: "Generator #1", category: "power", typeMatch: ["generator"] },
      { slotId: "gen2", label: "Generator #2", category: "power", typeMatch: ["generator"] },
      { slotId: "pump1", label: "Cargo Pump", category: "cargo", typeMatch: ["pump"] },
      { slotId: "bow", label: "Bow Thruster", category: "thrusters", typeMatch: ["thruster", "bow thruster"] },
      { slotId: "crane", label: "Deck Crane", category: "deck", typeMatch: ["crane", "deck crane"] },
      { slotId: "dp", label: "DP System", category: "navigation", typeMatch: ["navigation", "dp", "dynamic positioning"] },
      { slotId: "fuel", label: "Fuel System", category: "fuel", typeMatch: ["tank", "fuel", "boiler"] },
      { slotId: "comp", label: "Compressor", category: "aux", typeMatch: ["compressor", "air compressor"] },
      { slotId: "elec", label: "Switchboard", category: "electrical", typeMatch: ["electrical", "switchboard", "transformer"] },
    ],
  };
}

export function useSchematicLayout(vesselId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["/api/vessels", vesselId, "schematic-layout"];

  const { data: layout, isLoading } = useQuery<SchematicLayout>({
    queryKey,
    queryFn: () => apiRequest("GET", `/api/vessels/${vesselId}/schematic-layout`),
    enabled: !!vesselId,
    retry: 2,
    placeholderData: getDefaultLayout(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const saveLayout = useMutation({
    mutationFn: (body: SchematicLayout) =>
      apiRequest("PUT", `/api/vessels/${vesselId}/schematic-layout`, body),
    onSuccess: invalidate,
  });

  const addZone = useMutation({
    mutationFn: (body: { label: string; order?: number }) =>
      apiRequest("POST", `/api/vessels/${vesselId}/schematic-layout/zones`, body),
    onSuccess: invalidate,
  });

  const updateZone = useMutation({
    mutationFn: ({ zoneId, ...body }: { zoneId: string; label?: string; order?: number }) =>
      apiRequest("PUT", `/api/vessels/${vesselId}/schematic-layout/zones/${zoneId}`, body),
    onSuccess: invalidate,
  });

  const removeZone = useMutation({
    mutationFn: (zoneId: string) =>
      apiRequest("DELETE", `/api/vessels/${vesselId}/schematic-layout/zones/${zoneId}`),
    onSuccess: invalidate,
  });

  const addSlot = useMutation({
    mutationFn: (body: { label: string; category: string; typeMatch: string[]; zoneId: string }) =>
      apiRequest("POST", `/api/vessels/${vesselId}/schematic-layout/slots`, body),
    onSuccess: invalidate,
  });

  const updateSlot = useMutation({
    mutationFn: ({ slotId, ...body }: { slotId: string; label?: string; category?: string; typeMatch?: string[] }) =>
      apiRequest("PUT", `/api/vessels/${vesselId}/schematic-layout/slots/${slotId}`, body),
    onSuccess: invalidate,
  });

  const removeSlot = useMutation({
    mutationFn: ({ slotId, force = false }: { slotId: string; force?: boolean }) =>
      apiRequest("DELETE", `/api/vessels/${vesselId}/schematic-layout/slots/${slotId}`, { force }),
    onSuccess: invalidate,
  });

  const moveSlot = useMutation({
    mutationFn: ({ slotId, targetZoneId }: { slotId: string; targetZoneId: string }) =>
      apiRequest("PUT", `/api/vessels/${vesselId}/schematic-layout/slots/${slotId}/move`, { targetZoneId }),
    onSuccess: invalidate,
  });

  const resetLayout = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/vessels/${vesselId}/schematic-layout/reset`),
    onSuccess: invalidate,
  });

  return {
    layout: layout ?? null,
    isLoading,
    saveLayout,
    addZone,
    updateZone,
    removeZone,
    addSlot,
    updateSlot,
    removeSlot,
    moveSlot,
    resetLayout,
  };
}
