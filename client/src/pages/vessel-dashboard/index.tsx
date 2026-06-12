import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVesselDetail } from "@/features/vessels";
import type { Part } from "@/features/inventory/types";
import type { VesselEquipment } from "@/features/vessels/types";
import { useSchematicLayout } from "@/hooks/useSchematicLayout";
import {
  computeLayout,
  assignEquipmentToSlots,
} from "@/components/vessel/VesselSchematic";

import { type ConfirmAction } from "./ConfirmActionDialog";
import {
  VesselDashboardLoading,
  VesselDashboardNotFound,
  VesselDashboardView,
} from "./VesselDashboardView";

export default function VesselDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    match,
    vesselId,
    vessel,
    vesselLoading,
    equipment: equipmentRaw,
    equipmentLoading,
    vesselWorkOrders,
    vesselCrew,
    vesselMaintenanceSchedules,
    activeWorkOrders,
    workOrdersLoading,
    crewLoading,
    schedulesLoading,
  } = useVesselDetail();
  const equipment = equipmentRaw as object as VesselEquipment[];

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [inventoryTab, setInventoryTab] = useState("compatible");
  const [bottomTab, setBottomTab] = useState("work-orders");
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [inventoryDrawerOpen, setInventoryDrawerOpen] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);

  const {
    layout,
    isLoading: layoutLoading,
    saveLayout,
    resetLayout,
  } = useSchematicLayout(vesselId);

  const [previewLayout, setPreviewLayout] = useState<typeof layout | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const activeLayout = (configPanelOpen && previewLayout) || layout;

  const { zones: zoneRects, slots: positionedSlots } = useMemo(
    () => (activeLayout ? computeLayout(activeLayout) : { zones: [], slots: [] }),
    [activeLayout]
  );

  const slotAssignments = useMemo(
    () => assignEquipmentToSlots(positionedSlots, equipment),
    [positionedSlots, equipment]
  );

  const equipmentSlotMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of slotAssignments) {
      if (a.equipment) {
        map.set(a.slot.slotId, a.equipment.id);
      }
    }
    return map;
  }, [slotAssignments]);

  const selectedAssignment = useMemo(
    () => slotAssignments.find((a) => a.slot.slotId === selectedSlotId) || null,
    [slotAssignments, selectedSlotId]
  );

  const selectedEquipment = selectedAssignment?.equipment || null;

  const selectedEquipmentId = selectedEquipment?.id;
  const { data: compatibleParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/equipment", selectedEquipmentId, "compatible-parts"],
    queryFn: () =>
      apiRequest<Part[]>("GET", `/api/equipment/${selectedEquipmentId}/compatible-parts`),
    enabled: !!selectedEquipmentId,
  });

  const { data: allParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/parts"],
    queryFn: () => apiRequest<Part[]>("GET", "/api/parts"),
  });

  const filteredParts = useMemo(() => {
    if (inventoryTab === "all") {
      return allParts;
    }
    if (inventoryTab === "compatible") {
      return selectedEquipment ? compatibleParts : [];
    }
    if (inventoryTab === "critical") {
      return allParts.filter((p) => p.criticality === "critical" || p.criticality === "high");
    }
    if (inventoryTab === "installed") {
      const eqIds = equipment.map((eq) => eq.id);
      return allParts.filter((p) => p.compatibleEquipment?.some((ceId) => eqIds.includes(ceId)));
    }
    return [];
  }, [inventoryTab, selectedEquipment, compatibleParts, allParts, equipment]);

  const avgHealth = useMemo(() => {
    if (equipment.length === 0) {
      return 0;
    }
    return Math.round(
      equipment.reduce((sum, eq) => sum + (eq.healthScore ?? 85), 0) / equipment.length
    );
  }, [equipment]);

  const riskScore = useMemo(() => {
    const criticalCount = equipment.filter((eq) => eq.status === "critical").length;
    const warningCount = equipment.filter(
      (eq) => eq.status === "warning" || eq.status === "degraded"
    ).length;
    return Math.min(100, criticalCount * 25 + warningCount * 10);
  }, [equipment]);

  const riskLevel = riskScore > 60 ? "high" : riskScore > 30 ? "medium" : "low";

  const assignMutation = useMutation({
    mutationFn: ({ vesselId, equipmentId }: { vesselId: string; equipmentId: string }) =>
      apiRequest("POST", `/api/vessels/${vesselId}/equipment/${equipmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", vesselId, "equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: ({ vesselId, equipmentId }: { vesselId: string; equipmentId: string }) =>
      apiRequest("DELETE", `/api/vessels/${vesselId}/equipment/${equipmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", vesselId, "equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
    },
  });

  const handleSlotSelect = useCallback(
    (slotId: string) => {
      setSelectedSlotId(slotId === selectedSlotId ? null : slotId);
    },
    [selectedSlotId]
  );

  const handleEquip = useCallback(
    (part: Part) => {
      if (!selectedSlotId) {
        return;
      }
      const assignment = slotAssignments.find((a) => a.slot.slotId === selectedSlotId);
      if (!assignment) {
        return;
      }
      setConfirmAction({
        type: "equip",
        part,
        slotLabel: assignment.slot.label,
      });
    },
    [selectedSlotId, slotAssignments]
  );

  const handleSwap = useCallback(
    (part: Part) => {
      if (!selectedSlotId || !selectedEquipment) {
        return;
      }
      const assignment = slotAssignments.find((a) => a.slot.slotId === selectedSlotId);
      if (!assignment) {
        return;
      }
      setConfirmAction({
        type: "swap",
        part,
        equipment: selectedEquipment,
        slotLabel: assignment.slot.label,
      });
    },
    [selectedSlotId, selectedEquipment, slotAssignments]
  );

  const handleUninstall = useCallback(
    (equipmentId: string, slotLabel: string) => {
      const eq = equipment.find((e) => e.id === equipmentId);
      if (!eq) {
        return;
      }
      setConfirmAction({
        type: "uninstall",
        equipment: eq,
        slotLabel,
      });
    },
    [equipment]
  );

  const handleCancelConfirm = useCallback(() => {
    setConfirmAction(null);
  }, []);

  const handleToggleConfigPanel = useCallback(() => {
    setConfigPanelOpen((open) => {
      const next = !open;
      if (!next) {
        setPreviewLayout(null);
      }
      return next;
    });
  }, []);

  const handleCloseConfigPanel = useCallback(() => {
    setConfigPanelOpen(false);
    setPreviewLayout(null);
  }, []);

  const executeConfirmAction = useCallback(async () => {
    if (!confirmAction || !vesselId) {
      return;
    }

    try {
      if (confirmAction.type === "uninstall" && confirmAction.equipment) {
        await unassignMutation.mutateAsync({
          vesselId,
          equipmentId: confirmAction.equipment.id,
        });
        toast({
          title: "Equipment Removed",
          description: `${confirmAction.equipment.name} removed from ${confirmAction.slotLabel}`,
        });
      } else if (confirmAction.type === "swap" && confirmAction.equipment && confirmAction.part) {
        await unassignMutation.mutateAsync({
          vesselId,
          equipmentId: confirmAction.equipment.id,
        });
        toast({
          title: "Equipment Swapped",
          description: `${confirmAction.equipment.name} replaced with ${confirmAction.part.name} in ${confirmAction.slotLabel}`,
        });
      } else if (confirmAction.type === "equip" && confirmAction.part) {
        toast({
          title: "Equipment Installed",
          description: `${confirmAction.part.name} installed in ${confirmAction.slotLabel}`,
        });
      }
    } catch (err) {
      toast({
        title: "Action Failed",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }

    setConfirmAction(null);
  }, [confirmAction, vesselId, unassignMutation, toast]);

  if (!match || vesselLoading) {
    return <VesselDashboardLoading />;
  }

  if (!vessel) {
    return <VesselDashboardNotFound />;
  }

  return (
    <VesselDashboardView
      vesselId={vesselId!}
      vessel={vessel}
      equipment={equipment}
      allParts={allParts}
      filteredParts={filteredParts}
      compatibleParts={compatibleParts}
      selectedSlotId={selectedSlotId}
      selectedEquipment={selectedEquipment}
      selectedAssignment={selectedAssignment}
      slotAssignments={slotAssignments}
      zoneRects={zoneRects}
      layout={layout}
      activeLayout={activeLayout}
      equipmentSlotMap={equipmentSlotMap}
      equipmentLoading={equipmentLoading}
      layoutLoading={layoutLoading}
      configPanelOpen={configPanelOpen}
      isLayoutPending={saveLayout.isPending || resetLayout.isPending}
      confirmAction={confirmAction}
      isConfirmPending={assignMutation.isPending || unassignMutation.isPending}
      statusDrawerOpen={statusDrawerOpen}
      inventoryDrawerOpen={inventoryDrawerOpen}
      inventoryTab={inventoryTab}
      bottomTab={bottomTab}
      avgHealth={avgHealth}
      riskScore={riskScore}
      riskLevel={riskLevel}
      vesselWorkOrders={vesselWorkOrders}
      vesselCrew={vesselCrew}
      vesselMaintenanceSchedules={vesselMaintenanceSchedules}
      activeWorkOrders={activeWorkOrders}
      workOrdersLoading={workOrdersLoading}
      crewLoading={crewLoading}
      schedulesLoading={schedulesLoading}
      onCancelConfirm={handleCancelConfirm}
      onConfirmAction={executeConfirmAction}
      onStatusDrawerOpenChange={setStatusDrawerOpen}
      onInventoryDrawerOpenChange={setInventoryDrawerOpen}
      onInventoryTabChange={setInventoryTab}
      onBottomTabChange={setBottomTab}
      onToggleConfigPanel={handleToggleConfigPanel}
      onCloseConfigPanel={handleCloseConfigPanel}
      onDraftLayoutChange={setPreviewLayout}
      onSaveLayout={saveLayout.mutate}
      onResetLayout={resetLayout.mutate}
      onSlotSelect={handleSlotSelect}
      onEquip={handleEquip}
      onSwap={handleSwap}
      onUninstall={handleUninstall}
    />
  );
}
