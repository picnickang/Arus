import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Ship, Wrench, Users, AlertCircle, Sparkles,
  Package, Info, ChevronRight, Activity, Settings2,
  PanelLeftOpen, PanelRightOpen, X, ArrowDownUp, Trash2,
  CheckCircle2, ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { CIIBadge } from "@/components/compliance/CIIBadge";
import { OperatingModeChip } from "@/components/context/OperatingModeChip";
import { ActiveDtcsPanel } from "@/components/ActiveDtcsPanel";
import { useVesselDetail } from "@/features/vessels";
import type { Equipment } from "@/features/vessels/types";
import type { Part } from "@/features/inventory/types";
import { useSchematicLayout } from "@/hooks/useSchematicLayout";
import {
  VesselSchematic,
  SchematicConfigPanel,
  HealthBar,
  Pulse,
  StockBadge,
  statusFill,
  healthColor,
  computeLayout,
  assignEquipmentToSlots,
  type SlotAssignment,
} from "@/components/vessel/VesselSchematic";

// ============================================================================
// Local helpers (statusColor is only used in this file)
// ============================================================================

const statusColor = (s: string) =>
  s === "operational" ? "text-green-500" :
  s === "degraded" || s === "warning" ? "text-yellow-500" :
  s === "critical" ? "text-red-500" : "text-slate-400";

// ============================================================================
// Mobile slide panel
// ============================================================================

function SlidePanel({ open, onClose, side, children, testId }: {
  open: boolean; onClose: () => void; side: "left" | "right"; children: React.ReactNode; testId?: string;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}
      <div
        className={`fixed top-0 ${side === "left" ? "left-0" : "right-0"} h-full w-[300px] sm:w-[340px] bg-[#0a1120] border-${side === "left" ? "r" : "l"} border-slate-700/20 z-50 transform transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full"
        }`}
        data-testid={testId}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/15">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {side === "left" ? "Vessel Status" : "Inventory"}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} data-testid={testId ? `${testId}-close` : undefined}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-49px)]">{children}</div>
      </div>
    </>
  );
}

// ============================================================================
// Vessel Status Sidebar
// ============================================================================

function VesselStatusPanel({
  vessel, avgHealth, riskScore, riskLevel,
  activeWorkOrders, vesselCrew, equipment,
  selectedAssignment, compatibleParts,
  onUninstall,
}: {
  vessel: any;
  avgHealth: number;
  riskScore: number;
  riskLevel: string;
  activeWorkOrders: any[];
  vesselCrew: any[];
  equipment: Equipment[];
  selectedAssignment: SlotAssignment | null;
  compatibleParts: Part[];
  onUninstall: (equipmentId: string, slotLabel: string) => void;
}) {
  const eq = selectedAssignment?.equipment;
  const slot = selectedAssignment?.slot;

  return (
    <div className="p-4">
      {/* Online status */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Vessel Status</h2>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: vessel.onlineStatus === "online" ? "#22c55e" : "#64748b" }}>
          <Pulse color={vessel.onlineStatus === "online" ? "#22c55e" : "#64748b"} size={7} />
          {(vessel.onlineStatus || "UNKNOWN").toUpperCase()}
        </div>
      </div>

      {/* Vessel name */}
      <div className="p-3.5 rounded-lg bg-sky-500/[0.03] border border-sky-500/10 mb-4">
        <div className="text-xl font-bold text-slate-100">{vessel.name}</div>
        <div className="text-[11px] text-slate-500 font-mono">
          {vessel.vesselClass?.replace("_", " ") || "N/A"} · {vessel.flag || "N/A"}
        </div>
      </div>

      {/* Health & Risk */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-3 rounded-lg bg-green-500/[0.04] border border-green-500/10">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Health</div>
          <div className="text-2xl font-extrabold leading-none" style={{ color: healthColor(avgHealth) }}>{avgHealth}</div>
          <HealthBar value={avgHealth} width={90} height={4} />
        </div>
        <div className="p-3 rounded-lg border" style={{
          background: `${riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e"}08`,
          borderColor: `${riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e"}18`,
        }}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Risk</div>
          <div className="text-2xl font-extrabold leading-none" style={{ color: riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e" }}>{riskScore}</div>
          <div className="text-[10px] font-semibold mt-1" style={{ color: riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e" }}>{riskLevel.toUpperCase()}</div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="mb-4">
        {[
          ["Open Work Orders", String(activeWorkOrders.length)],
          ["Crew Assigned", String(vesselCrew.length)],
          ["Equipment", String(equipment.length)],
          ["Running Hours", equipment[0]?.runningHours ? `${equipment[0].runningHours.toLocaleString()} hrs` : "N/A"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-700/10">
            <span className="text-xs text-slate-400">{label}</span>
            <span className="text-xs font-semibold text-slate-200 font-mono">{value}</span>
          </div>
        ))}
      </div>

      {/* Selected slot detail */}
      {selectedAssignment && (
        <div className="p-3.5 rounded-lg border animate-in fade-in-0 duration-300" style={{
          background: eq ? `${statusFill(eq.status)}06` : "rgba(148,163,184,0.03)",
          borderColor: eq ? `${statusFill(eq.status)}20` : "rgba(148,163,184,0.08)",
        }}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
            {slot?.label || "Selected Slot"}
          </div>

          {eq ? (
            <>
              <div className="text-[15px] font-bold text-slate-100">{eq.name}</div>
              <div className="text-[11px] text-slate-500 mb-2.5 font-mono">
                {[eq.manufacturer, eq.model].filter(Boolean).join(" ") || eq.type}
                {eq.runningHours ? ` · ${eq.runningHours.toLocaleString()} hrs` : ""}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-slate-400">Health</span>
                <HealthBar value={eq.healthScore ?? 85} width={80} height={5} />
                <span className="text-xs font-bold" style={{ color: statusFill(eq.status) }}>
                  {eq.healthScore ?? 85}%
                </span>
              </div>

              <div className="flex items-center gap-1.5 mb-3">
                <Badge variant="outline" className={`text-[10px] uppercase ${statusColor(eq.status)}`}>
                  {eq.status}
                </Badge>
                <span className="text-[11px] text-slate-500">
                  {compatibleParts.length} compatible part{compatibleParts.length !== 1 ? "s" : ""}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-[11px] border-red-500/20 text-red-400 hover:bg-red-500/10"
                onClick={() => onUninstall(eq.id, slot?.label || "")}
              >
                <Trash2 className="h-3 w-3 mr-1.5" /> Uninstall Equipment
              </Button>
            </>
          ) : (
            <div className="text-xs text-slate-500 py-2">
              Empty slot — select a compatible item from inventory to install
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Inventory Panel
// ============================================================================

function InventoryPanel({
  tab, setTab, parts, allParts, selectedSlotId, selectedEquipment,
  onEquip, onSwap,
}: {
  tab: string;
  setTab: (t: string) => void;
  parts: Part[];
  allParts: Part[];
  selectedSlotId: string | null;
  selectedEquipment: Equipment | null;
  onEquip: (part: Part) => void;
  onSwap: (part: Part) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-0 border-b border-slate-700/10">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2.5 flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" /> Inventory
        </h2>
        <div className="flex gap-0.5">
          {[
            ["compatible", "Compatible"],
            ["installed", "Installed"],
            ["critical", "Critical"],
            ["all", "All Parts"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-2.5 py-1.5 text-[10px] font-semibold rounded-t-md border border-b-0 transition-colors min-h-[32px] ${
                tab === key
                  ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                  : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
              }`}
              data-testid={`btn-inventory-${key}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {parts.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs">
            {tab === "compatible" && !selectedSlotId
              ? "Select a slot on the schematic to see compatible parts"
              : tab === "compatible"
              ? "No compatible parts found for this slot"
              : "No parts found"}
          </div>
        ) : (
          parts.map((part) => {
            const qty = part.minStockLevel ? (part.reorderPoint || 1) : 1;
            const hasEquipped = !!selectedEquipment;

            return (
              <div
                key={part.id}
                className="p-3 mb-1.5 rounded-lg bg-white/[0.015] border border-slate-700/10 hover:bg-sky-500/[0.04] transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-200 truncate">{part.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {part.partNumber} · {part.manufacturer || "N/A"}
                    </div>
                  </div>
                  <StockBadge part={part} />
                </div>

                <div className="flex justify-between items-center mt-2 mb-2">
                  <div className="flex gap-2.5 text-[11px]">
                    <span className="text-slate-400">ROB: <span className="text-slate-200 font-semibold">{qty}</span></span>
                    <span className="text-slate-500">{part.category || "General"}</span>
                  </div>
                  {part.unitCost != null && (
                    <span className="text-[13px] font-bold text-slate-200 font-mono">
                      ${Number(part.unitCost).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  {selectedSlotId && qty > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2.5 border-sky-500/20 text-sky-400 hover:bg-sky-500/10 flex-1"
                      onClick={() => hasEquipped ? onSwap(part) : onEquip(part)}
                    >
                      {hasEquipped ? (
                        <><ArrowDownUp className="h-3 w-3 mr-1" /> Swap</>
                      ) : (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Equip</>
                      )}
                    </Button>
                  )}
                  {selectedSlotId && qty === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2.5 border-red-500/20 text-red-400 hover:bg-red-500/10 flex-1"
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" /> Order
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] px-2.5 text-slate-400"
                  >
                    <Info className="h-3 w-3 mr-1" /> Details
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-700/10 bg-[#080e1a]/50 flex justify-between text-[11px]">
        <span className="text-slate-500">{allParts.length} parts total</span>
        <span className="text-red-400 font-semibold">
          {allParts.filter((p) => p.criticality === "critical").length} critical
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Vessel Dashboard
// ============================================================================

export default function VesselDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    match, vesselId, vessel, vesselLoading, equipment, equipmentLoading,
    vesselWorkOrders, vesselCrew, vesselMaintenanceSchedules,
    activeWorkOrders, completedWorkOrders, powerSTWDateRange,
    workOrdersLoading, crewLoading, schedulesLoading,
  } = useVesselDetail();

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [inventoryTab, setInventoryTab] = useState("compatible");
  const [bottomTab, setBottomTab] = useState("work-orders");
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [inventoryDrawerOpen, setInventoryDrawerOpen] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [previewLayout, setPreviewLayout] = useState<typeof layout | null>(null);

  // Swap confirmation modal
  const [confirmAction, setConfirmAction] = useState<{
    type: "equip" | "swap" | "uninstall";
    part?: Part;
    equipment?: Equipment;
    slotLabel: string;
  } | null>(null);

  const {
    layout, isLoading: layoutLoading,
    saveLayout, resetLayout,
  } = useSchematicLayout(vesselId);

  const activeLayout = (configPanelOpen && previewLayout) || layout;

  const { zones: zoneRects, slots: positionedSlots } = useMemo(
    () => activeLayout ? computeLayout(activeLayout) : { zones: [], slots: [] },
    [activeLayout]
  );

  // Slot assignments
  const slotAssignments = useMemo(
    () => assignEquipmentToSlots(positionedSlots, equipment),
    [positionedSlots, equipment]
  );

  const equipmentSlotMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of slotAssignments) {
      if (a.equipment) {map.set(a.slot.slotId, a.equipment.id);}
    }
    return map;
  }, [slotAssignments]);

  const selectedAssignment = useMemo(
    () => slotAssignments.find((a) => a.slot.slotId === selectedSlotId) || null,
    [slotAssignments, selectedSlotId]
  );

  const selectedEquipment = selectedAssignment?.equipment || null;

  // Compatible parts query
  const { data: compatibleParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/equipment", selectedEquipment?.id, "compatible-parts"],
    queryFn: () => apiRequest("GET", `/api/equipment/${selectedEquipment!.id}/compatible-parts`),
    enabled: !!selectedEquipment?.id,
  });

  const { data: allParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/parts"],
    queryFn: () => apiRequest("GET", "/api/parts"),
  });

  // Filtered parts based on tab
  const filteredParts = useMemo(() => {
    if (inventoryTab === "all") {return allParts;}
    if (inventoryTab === "compatible") {return selectedEquipment ? compatibleParts : [];}
    if (inventoryTab === "critical") {return allParts.filter((p) => p.criticality === "critical" || p.criticality === "high");}
    if (inventoryTab === "installed") {
      const eqIds = equipment.map((eq) => eq.id);
      return allParts.filter((p) =>
        p.compatibleEquipment?.some((ceId) => eqIds.includes(ceId))
      );
    }
    return [];
  }, [inventoryTab, selectedEquipment, compatibleParts, allParts, equipment]);

  // Health/risk computations
  const avgHealth = useMemo(() => {
    if (equipment.length === 0) {return 0;}
    return Math.round(equipment.reduce((sum, eq) => sum + (eq.healthScore ?? 85), 0) / equipment.length);
  }, [equipment]);

  const riskScore = useMemo(() => {
    const criticalCount = equipment.filter((eq) => eq.status === "critical").length;
    const warningCount = equipment.filter((eq) => eq.status === "warning" || eq.status === "degraded").length;
    return Math.min(100, criticalCount * 25 + warningCount * 10);
  }, [equipment]);

  const riskLevel = riskScore > 60 ? "high" : riskScore > 30 ? "medium" : "low";

  // Mutations for equipment assignment
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

  // Handlers
  const handleSlotSelect = useCallback((slotId: string) => {
    setSelectedSlotId(slotId === selectedSlotId ? null : slotId);
  }, [selectedSlotId]);

  const handleEquip = useCallback((part: Part) => {
    if (!selectedSlotId) {return;}
    const assignment = slotAssignments.find((a) => a.slot.slotId === selectedSlotId);
    if (!assignment) {return;}
    setConfirmAction({
      type: "equip",
      part,
      slotLabel: assignment.slot.label,
    });
  }, [selectedSlotId, slotAssignments]);

  const handleSwap = useCallback((part: Part) => {
    if (!selectedSlotId || !selectedEquipment) {return;}
    const assignment = slotAssignments.find((a) => a.slot.slotId === selectedSlotId);
    if (!assignment) {return;}
    setConfirmAction({
      type: "swap",
      part,
      equipment: selectedEquipment,
      slotLabel: assignment.slot.label,
    });
  }, [selectedSlotId, selectedEquipment, slotAssignments]);

  const handleUninstall = useCallback((equipmentId: string, slotLabel: string) => {
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq) {return;}
    setConfirmAction({
      type: "uninstall",
      equipment: eq,
      slotLabel,
    });
  }, [equipment]);

  const executeConfirmAction = useCallback(async () => {
    if (!confirmAction || !vesselId) {return;}

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
        // Unassign current, then assign new
        await unassignMutation.mutateAsync({
          vesselId,
          equipmentId: confirmAction.equipment.id,
        });
        // The new part's equipment ID would come from the part's linked equipment
        // In practice this creates a work order for the physical swap
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

  // ── Loading / Error states ──────────────────────────────────────────────

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
        <Button asChild className="mt-4"><Link href="/fleet">Back to Vessels</Link></Button>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080e1a] text-slate-200" data-testid="vessel-dashboard-page">

      {/* ── Confirm Modal ────────────────────────────────────────────────── */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="bg-[#0f1729] border-slate-700/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {confirmAction?.type === "uninstall" && `Uninstall — ${confirmAction.equipment?.name}`}
              {confirmAction?.type === "swap" && `Swap Equipment — ${confirmAction.slotLabel}`}
              {confirmAction?.type === "equip" && `Install Equipment — ${confirmAction.slotLabel}`}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {confirmAction?.type === "uninstall" &&
                `Remove ${confirmAction.equipment?.name} from the ${confirmAction.slotLabel} slot? A work order should be created for this removal.`}
              {confirmAction?.type === "swap" &&
                `Remove ${confirmAction.equipment?.name} and install ${confirmAction.part?.name} in the ${confirmAction.slotLabel} slot?`}
              {confirmAction?.type === "equip" &&
                `Install ${confirmAction.part?.name} into the ${confirmAction.slotLabel} slot?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmAction(null)} className="border-slate-700/30 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={executeConfirmAction}
              variant={confirmAction?.type === "uninstall" ? "destructive" : "default"}
              disabled={assignMutation.isPending || unassignMutation.isPending}
              className={confirmAction?.type !== "uninstall" ? "bg-sky-600 hover:bg-sky-700" : ""}
            >
              {(assignMutation.isPending || unassignMutation.isPending) ? "Processing..." :
                confirmAction?.type === "uninstall" ? "Remove Equipment" : "Install Equipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 border-b border-slate-700/20 bg-[#080e1a]/95 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 sm:h-8 sm:w-8 shrink-0" data-testid="btn-back">
            <Link href="/fleet"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
            <Ship className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <span className="text-slate-400 hidden sm:inline">{vessel.vesselType || "Vessel"}</span>
              <ChevronRight className="h-3 w-3 text-slate-600 hidden sm:inline" />
              <span className="text-sky-400 truncate" data-testid="text-vessel-name">{vessel.name}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono truncate">
              {vessel.imo ? `IMO ${vessel.imo}` : vessel.id.slice(0, 8)} · {vessel.vesselClass?.replace("_", " ") || "N/A"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden md:flex gap-3 text-[11px]">
            {[["Healthy", "#22c55e"], ["Warning", "#f59e0b"], ["Critical", "#ef4444"], ["Empty", "#475569"]].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
          <div className="hidden sm:block"><CIIBadge vesselId={vesselId!} vesselName={vessel.name} /></div>
          <div className="hidden sm:block"><OperatingModeChip vesselId={vesselId!} /></div>
          <Button variant="outline" size="sm" className="gap-1.5 border-sky-500/30 text-sky-400 hover:bg-sky-500/10 h-9 sm:h-8" data-testid="btn-ai-assistant">
            <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Ask AI</span>
          </Button>
        </div>
      </header>

      {/* ── Mobile drawer buttons ────────────────────────────────────────── */}
      <div className="flex lg:hidden items-center gap-2 px-3 py-2 border-b border-slate-700/10">
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-slate-700/20 text-slate-300 flex-1" onClick={() => setStatusDrawerOpen(true)} data-testid="btn-open-status-drawer">
          <PanelLeftOpen className="h-3.5 w-3.5" /> Status
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-slate-700/20 text-slate-300 flex-1" onClick={() => setInventoryDrawerOpen(true)} data-testid="btn-open-inventory-drawer">
          <PanelRightOpen className="h-3.5 w-3.5" /> Inventory
          <Badge variant="secondary" className="text-[9px] ml-1 px-1 py-0 bg-slate-700/30">{allParts.length}</Badge>
        </Button>
      </div>

      {/* ── Mobile drawers ───────────────────────────────────────────────── */}
      <SlidePanel open={statusDrawerOpen} onClose={() => setStatusDrawerOpen(false)} side="left" testId="mobile-status-drawer">
        <VesselStatusPanel vessel={vessel} avgHealth={avgHealth} riskScore={riskScore} riskLevel={riskLevel}
          activeWorkOrders={activeWorkOrders} vesselCrew={vesselCrew} equipment={equipment}
          selectedAssignment={selectedAssignment} compatibleParts={compatibleParts}
          onUninstall={handleUninstall} />
      </SlidePanel>

      <SlidePanel open={inventoryDrawerOpen} onClose={() => setInventoryDrawerOpen(false)} side="right" testId="mobile-inventory-drawer">
        <InventoryPanel tab={inventoryTab} setTab={setInventoryTab} parts={filteredParts} allParts={allParts}
          selectedSlotId={selectedSlotId} selectedEquipment={selectedEquipment}
          onEquip={handleEquip} onSwap={handleSwap} />
      </SlidePanel>

      {/* ── Three-column grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] lg:h-[calc(100vh-53px)]">

        {/* LEFT — Vessel status */}
        <aside className="border-r border-slate-700/15 overflow-y-auto bg-slate-900/50 hidden lg:block" data-testid="panel-vessel-status">
          <VesselStatusPanel vessel={vessel} avgHealth={avgHealth} riskScore={riskScore} riskLevel={riskLevel}
            activeWorkOrders={activeWorkOrders} vesselCrew={vesselCrew} equipment={equipment}
            selectedAssignment={selectedAssignment} compatibleParts={compatibleParts}
            onUninstall={handleUninstall} />
        </aside>

        {/* CENTER — Schematic + bottom tabs */}
        <main className="relative overflow-hidden flex flex-col" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(56,189,248,0.03) 0%, transparent 70%)" }}>
          {/* Scan line */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-sky-500/10 to-transparent" style={{ animation: "scan-line 8s linear infinite" }} />
          </div>
          <style>{`@keyframes scan-line { 0% { transform: translateY(-100vh); } 100% { transform: translateY(100vh); } }`}</style>

          {/* Schematic header */}
          <div className="px-3 sm:px-5 py-3 flex justify-between items-center border-b border-slate-700/10 shrink-0">
            <div>
              <h2 className="text-[13px] font-bold text-slate-200 uppercase tracking-wide">Equipment Schematic</h2>
              <div className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">Select slot → choose part from inventory → install</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 flex-wrap justify-end">
                {slotAssignments.map(({ slot, equipment: eq }) => (
                  <button
                    key={slot.slotId}
                    onClick={() => handleSlotSelect(slot.slotId)}
                    className="rounded-full p-0 transition-all duration-150"
                    style={{
                      width: 12, height: 12, minWidth: 12, minHeight: 12,
                      background: slot.slotId === selectedSlotId ? "#38bdf8" : eq ? statusFill(eq.status) : "#334155",
                      border: slot.slotId === selectedSlotId ? "2px solid #38bdf8" : "1px solid transparent",
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
                onClick={() => { const next = !configPanelOpen; setConfigPanelOpen(next); if (!next) {setPreviewLayout(null);} }}
                data-testid="btn-config-schematic"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Config panel */}
          {configPanelOpen && layout && (
            <div className="px-3 sm:px-5 py-3 border-b border-slate-700/10 shrink-0">
              <SchematicConfigPanel
                layout={layout}
                equipmentSlotMap={equipmentSlotMap}
                onSave={(draft) => saveLayout.mutate(draft)}
                onReset={() => resetLayout.mutate()}
                onClose={() => { setConfigPanelOpen(false); setPreviewLayout(null); }}
                onDraftChange={setPreviewLayout}
                isPending={saveLayout.isPending || resetLayout.isPending}
              />
            </div>
          )}

          {/* SVG area */}
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

          {/* Status summary bar */}
          <div className="px-3 sm:px-5 py-2 bg-[#080e1a]/90 backdrop-blur border-t border-slate-700/10 flex gap-3 sm:gap-4 justify-center z-10 shrink-0">
            {[
              [equipment.filter((e) => e.status === "operational").length, "Healthy", "#22c55e"],
              [equipment.filter((e) => e.status === "warning" || e.status === "degraded").length, "Warning", "#f59e0b"],
              [equipment.filter((e) => e.status === "critical").length, "Critical", "#ef4444"],
              [(activeLayout?.slots.length ?? 0) - equipment.length, "Empty", "#475569"],
            ].map(([count, label, color]) => (
              <div key={label as string} className="flex items-center gap-1.5 text-xs">
                <span className="w-[18px] h-[18px] rounded flex items-center justify-center text-[11px] font-bold" style={{ background: `${color}15`, color: color as string }}>
                  {Math.max(0, count as number)}
                </span>
                <span className="text-slate-400">{label}</span>
              </div>
            ))}
          </div>

          {/* Bottom tabs */}
          <div className="border-t border-slate-700/15 bg-slate-900/30 shrink-0">
            <Tabs value={bottomTab} onValueChange={setBottomTab}>
              <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-slate-700/10 px-2 sm:px-4 h-10 sm:h-9 overflow-x-auto flex-nowrap">
                <TabsTrigger value="work-orders" className="text-xs data-[state=active]:text-sky-400 min-h-[36px] px-2 sm:px-3 shrink-0" data-testid="tab-work-orders">
                  <Wrench className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Work Orders ({activeWorkOrders.length})</span>
                  <span className="sm:hidden text-[10px] ml-1">{activeWorkOrders.length}</span>
                </TabsTrigger>
                <TabsTrigger value="crew" className="text-xs data-[state=active]:text-sky-400 min-h-[36px] px-2 sm:px-3 shrink-0" data-testid="tab-crew">
                  <Users className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Crew ({vesselCrew.length})</span>
                  <span className="sm:hidden text-[10px] ml-1">{vesselCrew.length}</span>
                </TabsTrigger>
                <TabsTrigger value="maintenance" className="text-xs data-[state=active]:text-sky-400 min-h-[36px] px-2 sm:px-3 shrink-0" data-testid="tab-maintenance">
                  <Activity className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Maintenance</span>
                </TabsTrigger>
                <TabsTrigger value="diagnostics" className="text-xs data-[state=active]:text-sky-400 min-h-[36px] px-2 sm:px-3 shrink-0" data-testid="tab-diagnostics">
                  <AlertCircle className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">DTCs</span>
                </TabsTrigger>
              </TabsList>

              <div className="h-[200px] overflow-y-auto px-3 sm:px-4 py-2">
                <TabsContent value="work-orders" className="mt-0">
                  {workOrdersLoading ? <Skeleton className="h-20" /> : vesselWorkOrders.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">No work orders for this vessel</div>
                  ) : (
                    <div className="space-y-1.5">
                      {vesselWorkOrders.slice(0, 10).map((wo) => (
                        <div key={wo.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-slate-700/10">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-medium text-slate-200 truncate flex-1">{wo.description || wo.id.slice(0, 8)}</span>
                            <Badge variant={wo.status === "completed" ? "default" : "outline"} className="text-[10px] ml-2 shrink-0">{wo.status}</Badge>
                          </div>
                          <div className="text-[10px] text-slate-500">{formatDistanceToNow(new Date(wo.createdAt), { addSuffix: true })}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="crew" className="mt-0">
                  {crewLoading ? <Skeleton className="h-20" /> : vesselCrew.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">No crew assigned</div>
                  ) : (
                    <div className="space-y-1.5">
                      {vesselCrew.map((member) => (
                        <div key={member.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-slate-700/10">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-medium text-slate-200">{member.name}</span>
                            <Badge variant="outline" className="text-[10px]">{member.status || "Active"}</Badge>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{member.role || "N/A"} · {member.rank || "N/A"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="maintenance" className="mt-0">
                  {schedulesLoading ? <Skeleton className="h-20" /> : vesselMaintenanceSchedules.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">No maintenance schedules</div>
                  ) : (
                    <div className="space-y-1.5">
                      {vesselMaintenanceSchedules.map((s) => (
                        <div key={s.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-slate-700/10">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-medium text-slate-200 truncate flex-1">{s.equipmentId}</span>
                            <Badge variant={s.status === "completed" ? "default" : "outline"} className="text-[10px] ml-2 shrink-0">{s.status}</Badge>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            <Badge variant="outline" className="text-[9px] mr-1.5">{s.isPredictive ? "Predictive" : "Scheduled"}</Badge>
                            {new Date(s.nextScheduledDate).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="diagnostics" className="mt-0">
                  {selectedEquipment ? (
                    <ActiveDtcsPanel equipmentId={selectedEquipment.id} equipmentName={selectedEquipment.name} />
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-xs">Select equipment on the schematic to view diagnostic codes</div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>

        {/* RIGHT — Inventory */}
        <aside className="border-l border-slate-700/15 flex flex-col bg-slate-900/50 hidden lg:flex" data-testid="panel-inventory">
          <InventoryPanel tab={inventoryTab} setTab={setInventoryTab} parts={filteredParts} allParts={allParts}
            selectedSlotId={selectedSlotId} selectedEquipment={selectedEquipment}
            onEquip={handleEquip} onSwap={handleSwap} />
        </aside>
      </div>
    </div>
  );
}
