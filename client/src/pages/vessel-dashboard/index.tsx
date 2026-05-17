import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Ship,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Settings2,
  PanelLeftOpen,
  PanelRightOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CIIBadge } from "@/components/compliance/CIIBadge";
import { OperatingModeChip } from "@/components/context/OperatingModeChip";
import { useVesselDetail } from "@/features/vessels";
import type { Part } from "@/features/inventory/types";
import { useSchematicLayout } from "@/hooks/useSchematicLayout";
import {
  VesselSchematic,
  SchematicConfigPanel,
  statusFill,
  computeLayout,
  assignEquipmentToSlots,
} from "@/components/vessel/VesselSchematic";

import { SlidePanel } from "./SlidePanel";
import { VesselStatusPanel } from "./VesselStatusPanel";
import { InventoryPanel } from "./InventoryPanel";
import { ConfirmActionDialog, type ConfirmAction } from "./ConfirmActionDialog";
import { BottomTabs } from "./BottomTabs";

export default function VesselDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    match,
    vesselId,
    vessel,
    vesselLoading,
    equipment,
    equipmentLoading,
    vesselWorkOrders,
    vesselCrew,
    vesselMaintenanceSchedules,
    activeWorkOrders,
    workOrdersLoading,
    crewLoading,
    schedulesLoading,
  } = useVesselDetail();

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

  const { data: compatibleParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/equipment", selectedEquipment?.id, "compatible-parts"],
    queryFn: () => apiRequest<Part[]>("GET", `/api/equipment/${selectedEquipment!.id}/compatible-parts`),
    enabled: !!selectedEquipment?.id,
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
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px] hidden md:block" />
        </div>
      </div>
    );
  }

  if (!vessel) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Vessel not found</h3>
        <Button asChild className="mt-4">
          <Link href="/fleet">Back to Vessels</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080e1a] text-slate-200" data-testid="vessel-dashboard-page">
      <ConfirmActionDialog
        action={confirmAction}
        isPending={assignMutation.isPending || unassignMutation.isPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={executeConfirmAction}
      />

      <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 border-b border-slate-700/20 bg-[#080e1a]/95 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-9 w-9 sm:h-8 sm:w-8 shrink-0"
            data-testid="btn-back"
          >
            <Link href="/fleet">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
            <Ship className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <span className="text-slate-400 hidden sm:inline">
                {vessel.vesselType || "Vessel"}
              </span>
              <ChevronRight className="h-3 w-3 text-slate-600 hidden sm:inline" />
              <span className="text-sky-400 truncate" data-testid="text-vessel-name">
                {vessel.name}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono truncate">
              {vessel.imo ? `IMO ${vessel.imo}` : vessel.id.slice(0, 8)} ·{" "}
              {vessel.vesselClass?.replace("_", " ") || "N/A"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden md:flex gap-3 text-[11px]">
            {[
              ["Healthy", "#22c55e"],
              ["Warning", "#f59e0b"],
              ["Critical", "#ef4444"],
              ["Empty", "#475569"],
            ].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1 text-slate-400">
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: color }}
                />
                {label}
              </span>
            ))}
          </div>
          <div className="hidden sm:block">
            <CIIBadge vesselId={vesselId!} vesselName={vessel.name} />
          </div>
          <div className="hidden sm:block">
            <OperatingModeChip vesselId={vesselId!} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-sky-500/30 text-sky-400 hover:bg-sky-500/10 h-9 sm:h-8"
            data-testid="btn-ai-assistant"
          >
            <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Ask AI</span>
          </Button>
        </div>
      </header>

      <div className="flex lg:hidden items-center gap-2 px-3 py-2 border-b border-slate-700/10">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs border-slate-700/20 text-slate-300 flex-1"
          onClick={() => setStatusDrawerOpen(true)}
          data-testid="btn-open-status-drawer"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" /> Status
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs border-slate-700/20 text-slate-300 flex-1"
          onClick={() => setInventoryDrawerOpen(true)}
          data-testid="btn-open-inventory-drawer"
        >
          <PanelRightOpen className="h-3.5 w-3.5" /> Inventory
          <Badge variant="secondary" className="text-[9px] ml-1 px-1 py-0 bg-slate-700/30">
            {allParts.length}
          </Badge>
        </Button>
      </div>

      <SlidePanel
        open={statusDrawerOpen}
        onClose={() => setStatusDrawerOpen(false)}
        side="left"
        testId="mobile-status-drawer"
      >
        <VesselStatusPanel
          vessel={vessel}
          avgHealth={avgHealth}
          riskScore={riskScore}
          riskLevel={riskLevel}
          activeWorkOrders={activeWorkOrders}
          vesselCrew={vesselCrew}
          equipment={equipment}
          selectedAssignment={selectedAssignment}
          compatibleParts={compatibleParts}
          onUninstall={handleUninstall}
        />
      </SlidePanel>

      <SlidePanel
        open={inventoryDrawerOpen}
        onClose={() => setInventoryDrawerOpen(false)}
        side="right"
        testId="mobile-inventory-drawer"
      >
        <InventoryPanel
          tab={inventoryTab}
          setTab={setInventoryTab}
          parts={filteredParts}
          allParts={allParts}
          selectedSlotId={selectedSlotId}
          selectedEquipment={selectedEquipment}
          onEquip={handleEquip}
          onSwap={handleSwap}
        />
      </SlidePanel>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] lg:h-[calc(100vh-53px)]">
        <aside
          className="border-r border-slate-700/15 overflow-y-auto bg-slate-900/50 hidden lg:block"
          data-testid="panel-vessel-status"
        >
          <VesselStatusPanel
            vessel={vessel}
            avgHealth={avgHealth}
            riskScore={riskScore}
            riskLevel={riskLevel}
            activeWorkOrders={activeWorkOrders}
            vesselCrew={vesselCrew}
            equipment={equipment}
            selectedAssignment={selectedAssignment}
            compatibleParts={compatibleParts}
            onUninstall={handleUninstall}
          />
        </aside>

        <main
          className="relative overflow-hidden flex flex-col"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(56,189,248,0.03) 0%, transparent 70%)",
          }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
            <div
              className="w-full h-px bg-gradient-to-r from-transparent via-sky-500/10 to-transparent"
              style={{ animation: "scan-line 8s linear infinite" }}
            />
          </div>
          <style>{`@keyframes scan-line { 0% { transform: translateY(-100vh); } 100% { transform: translateY(100vh); } }`}</style>

          <div className="px-3 sm:px-5 py-3 flex justify-between items-center border-b border-slate-700/10 shrink-0">
            <div>
              <h2 className="text-[13px] font-bold text-slate-200 uppercase tracking-wide">
                Equipment Schematic
              </h2>
              <div className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                Select slot → choose part from inventory → install
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 flex-wrap justify-end">
                {slotAssignments.map(({ slot, equipment: eq }) => (
                  <button
                    key={slot.slotId}
                    onClick={() => handleSlotSelect(slot.slotId)}
                    className="rounded-full p-0 transition-all duration-150"
                    style={{
                      width: 12,
                      height: 12,
                      minWidth: 12,
                      minHeight: 12,
                      background:
                        slot.slotId === selectedSlotId
                          ? "#38bdf8"
                          : eq
                            ? statusFill(eq.status)
                            : "#334155",
                      border:
                        slot.slotId === selectedSlotId
                          ? "2px solid #38bdf8"
                          : "1px solid transparent",
                      opacity: slot.slotId === selectedSlotId ? 1 : 0.6,
                    }}
                    title={slot.label}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-sky-400"
                onClick={() => {
                  const next = !configPanelOpen;
                  setConfigPanelOpen(next);
                  if (!next) {
                    setPreviewLayout(null);
                  }
                }}
                data-testid="btn-config-schematic"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {configPanelOpen && layout && (
            <div className="px-3 sm:px-5 py-3 border-b border-slate-700/10 shrink-0">
              <SchematicConfigPanel
                layout={layout}
                equipmentSlotMap={equipmentSlotMap}
                onSave={(draft) => saveLayout.mutate(draft)}
                onReset={() => resetLayout.mutate()}
                onClose={() => {
                  setConfigPanelOpen(false);
                  setPreviewLayout(null);
                }}
                onDraftChange={setPreviewLayout}
                isPending={saveLayout.isPending || resetLayout.isPending}
              />
            </div>
          )}

          <div className="flex-1 px-3 sm:px-5 py-3 min-h-0 overflow-auto touch-pan-x touch-pan-y">
            {equipmentLoading || layoutLoading ? (
              <Skeleton className="w-full h-full min-h-[240px]" />
            ) : (
              <div className="min-w-[320px]">
                <VesselSchematic
                  slotAssignments={slotAssignments}
                  zoneRects={zoneRects}
                  selectedSlotId={selectedSlotId}
                  onSelectSlot={handleSlotSelect}
                />
              </div>
            )}
          </div>

          <div className="px-3 sm:px-5 py-2 bg-[#080e1a]/90 backdrop-blur border-t border-slate-700/10 flex gap-3 sm:gap-4 justify-center z-10 shrink-0">
            {[
              [equipment.filter((e) => e.status === "operational").length, "Healthy", "#22c55e"],
              [
                equipment.filter((e) => e.status === "warning" || e.status === "degraded").length,
                "Warning",
                "#f59e0b",
              ],
              [equipment.filter((e) => e.status === "critical").length, "Critical", "#ef4444"],
              [(activeLayout?.slots.length ?? 0) - equipment.length, "Empty", "#475569"],
            ].map(([count, label, color]) => (
              <div key={label as string} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-[18px] h-[18px] rounded flex items-center justify-center text-[11px] font-bold"
                  style={{ background: `${color}15`, color: color as string }}
                >
                  {Math.max(0, count as number)}
                </span>
                <span className="text-slate-400">{label}</span>
              </div>
            ))}
          </div>

          <BottomTabs
            bottomTab={bottomTab}
            setBottomTab={setBottomTab}
            vesselWorkOrders={vesselWorkOrders}
            vesselCrew={vesselCrew}
            vesselMaintenanceSchedules={vesselMaintenanceSchedules}
            activeWorkOrders={activeWorkOrders}
            workOrdersLoading={workOrdersLoading}
            crewLoading={crewLoading}
            schedulesLoading={schedulesLoading}
            selectedEquipment={selectedEquipment}
          />
        </main>

        <aside
          className="border-l border-slate-700/15 flex flex-col bg-slate-900/50 hidden lg:flex"
          data-testid="panel-inventory"
        >
          <InventoryPanel
            tab={inventoryTab}
            setTab={setInventoryTab}
            parts={filteredParts}
            allParts={allParts}
            selectedSlotId={selectedSlotId}
            selectedEquipment={selectedEquipment}
            onEquip={handleEquip}
            onSwap={handleSwap}
          />
        </aside>
      </div>
    </div>
  );
}
