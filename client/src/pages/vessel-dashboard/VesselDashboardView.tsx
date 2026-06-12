import { Link } from "wouter";
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
import { CIIBadge } from "@/components/compliance/CIIBadge";
import { OperatingModeChip } from "@/components/context/OperatingModeChip";
import {
  VesselSchematic,
  SchematicConfigPanel,
  statusFill,
  type SlotAssignment,
  type ZoneRect,
} from "@/components/vessel/VesselSchematic";
import type { Part } from "@/features/inventory/types";
import type { UseVesselDetailReturn, VesselEquipment } from "@/features/vessels";
import type { SchematicLayout } from "@/hooks/useSchematicLayout";
import { BottomTabs } from "./BottomTabs";
import { ConfirmActionDialog, type ConfirmAction } from "./ConfirmActionDialog";
import { InventoryPanel } from "./InventoryPanel";
import { SlidePanel } from "./SlidePanel";
import { VesselStatusPanel } from "./VesselStatusPanel";

const STATUS_LEGEND = [
  ["Healthy", "#22c55e"],
  ["Warning", "#f59e0b"],
  ["Critical", "#ef4444"],
  ["Empty", "#475569"],
] as const;

export function VesselDashboardLoading() {
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

export function VesselDashboardNotFound() {
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

interface VesselDashboardViewProps {
  vesselId: string;
  vessel: NonNullable<UseVesselDetailReturn["vessel"]>;
  equipment: VesselEquipment[];
  allParts: Part[];
  filteredParts: Part[];
  compatibleParts: Part[];
  selectedSlotId: string | null;
  selectedEquipment: VesselEquipment | null;
  selectedAssignment: SlotAssignment | null;
  slotAssignments: SlotAssignment[];
  zoneRects: ZoneRect[];
  layout: SchematicLayout | null;
  activeLayout: SchematicLayout | null;
  equipmentSlotMap: Map<string, string>;
  equipmentLoading: boolean;
  layoutLoading: boolean;
  configPanelOpen: boolean;
  isLayoutPending: boolean;
  confirmAction: ConfirmAction | null;
  isConfirmPending: boolean;
  statusDrawerOpen: boolean;
  inventoryDrawerOpen: boolean;
  inventoryTab: string;
  bottomTab: string;
  avgHealth: number;
  riskScore: number;
  riskLevel: string;
  vesselWorkOrders: UseVesselDetailReturn["vesselWorkOrders"];
  vesselCrew: UseVesselDetailReturn["vesselCrew"];
  vesselMaintenanceSchedules: UseVesselDetailReturn["vesselMaintenanceSchedules"];
  activeWorkOrders: UseVesselDetailReturn["activeWorkOrders"];
  workOrdersLoading: boolean;
  crewLoading: boolean;
  schedulesLoading: boolean;
  onCancelConfirm: () => void;
  onConfirmAction: () => void;
  onStatusDrawerOpenChange: (open: boolean) => void;
  onInventoryDrawerOpenChange: (open: boolean) => void;
  onInventoryTabChange: (tab: string) => void;
  onBottomTabChange: (tab: string) => void;
  onToggleConfigPanel: () => void;
  onCloseConfigPanel: () => void;
  onDraftLayoutChange: (draft: SchematicLayout) => void;
  onSaveLayout: (draft: SchematicLayout) => void;
  onResetLayout: () => void;
  onSlotSelect: (slotId: string) => void;
  onEquip: (part: Part) => void;
  onSwap: (part: Part) => void;
  onUninstall: (equipmentId: string, slotLabel: string) => void;
}

export function VesselDashboardView({
  vesselId,
  vessel,
  equipment,
  allParts,
  filteredParts,
  compatibleParts,
  selectedSlotId,
  selectedEquipment,
  selectedAssignment,
  slotAssignments,
  zoneRects,
  layout,
  activeLayout,
  equipmentSlotMap,
  equipmentLoading,
  layoutLoading,
  configPanelOpen,
  isLayoutPending,
  confirmAction,
  isConfirmPending,
  statusDrawerOpen,
  inventoryDrawerOpen,
  inventoryTab,
  bottomTab,
  avgHealth,
  riskScore,
  riskLevel,
  vesselWorkOrders,
  vesselCrew,
  vesselMaintenanceSchedules,
  activeWorkOrders,
  workOrdersLoading,
  crewLoading,
  schedulesLoading,
  onCancelConfirm,
  onConfirmAction,
  onStatusDrawerOpenChange,
  onInventoryDrawerOpenChange,
  onInventoryTabChange,
  onBottomTabChange,
  onToggleConfigPanel,
  onCloseConfigPanel,
  onDraftLayoutChange,
  onSaveLayout,
  onResetLayout,
  onSlotSelect,
  onEquip,
  onSwap,
  onUninstall,
}: VesselDashboardViewProps) {
  const equipmentStats = [
    [equipment.filter((item) => item.status === "operational").length, "Healthy", "#22c55e"],
    [
      equipment.filter((item) => item.status === "warning" || item.status === "degraded").length,
      "Warning",
      "#f59e0b",
    ],
    [equipment.filter((item) => item.status === "critical").length, "Critical", "#ef4444"],
    [(activeLayout?.slots.length ?? 0) - equipment.length, "Empty", "#475569"],
  ] as const;

  return (
    <div className="min-h-screen bg-[#080e1a] text-slate-200" data-testid="vessel-dashboard-page">
      <ConfirmActionDialog
        action={confirmAction}
        isPending={isConfirmPending}
        onCancel={onCancelConfirm}
        onConfirm={onConfirmAction}
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
            {STATUS_LEGEND.map(([label, color]) => (
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
            <CIIBadge vesselId={vesselId} vesselName={vessel.name} />
          </div>
          <div className="hidden sm:block">
            <OperatingModeChip vesselId={vesselId} />
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
          onClick={() => onStatusDrawerOpenChange(true)}
          data-testid="btn-open-status-drawer"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" /> Status
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs border-slate-700/20 text-slate-300 flex-1"
          onClick={() => onInventoryDrawerOpenChange(true)}
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
        onClose={() => onStatusDrawerOpenChange(false)}
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
          onUninstall={onUninstall}
        />
      </SlidePanel>

      <SlidePanel
        open={inventoryDrawerOpen}
        onClose={() => onInventoryDrawerOpenChange(false)}
        side="right"
        testId="mobile-inventory-drawer"
      >
        <InventoryPanel
          tab={inventoryTab}
          setTab={onInventoryTabChange}
          parts={filteredParts}
          allParts={allParts}
          selectedSlotId={selectedSlotId}
          selectedEquipment={selectedEquipment}
          onEquip={onEquip}
          onSwap={onSwap}
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
            onUninstall={onUninstall}
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
                {slotAssignments.map(({ slot, equipment: assignedEquipment }) => (
                  <button
                    key={slot.slotId}
                    onClick={() => onSlotSelect(slot.slotId)}
                    className="rounded-full p-0 transition-all duration-150"
                    style={{
                      width: 12,
                      height: 12,
                      minWidth: 12,
                      minHeight: 12,
                      background:
                        slot.slotId === selectedSlotId
                          ? "#38bdf8"
                          : assignedEquipment
                            ? statusFill(assignedEquipment.status)
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
                onClick={onToggleConfigPanel}
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
                onSave={onSaveLayout}
                onReset={onResetLayout}
                onClose={onCloseConfigPanel}
                onDraftChange={onDraftLayoutChange}
                isPending={isLayoutPending}
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
                  onSelectSlot={onSlotSelect}
                />
              </div>
            )}
          </div>

          <div className="px-3 sm:px-5 py-2 bg-[#080e1a]/90 backdrop-blur border-t border-slate-700/10 flex gap-3 sm:gap-4 justify-center z-10 shrink-0">
            {equipmentStats.map(([count, label, color]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-[18px] h-[18px] rounded flex items-center justify-center text-[11px] font-bold"
                  style={{ background: `${color}15`, color }}
                >
                  {Math.max(0, count)}
                </span>
                <span className="text-slate-400">{label}</span>
              </div>
            ))}
          </div>

          <BottomTabs
            bottomTab={bottomTab}
            setBottomTab={onBottomTabChange}
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
            setTab={onInventoryTabChange}
            parts={filteredParts}
            allParts={allParts}
            selectedSlotId={selectedSlotId}
            selectedEquipment={selectedEquipment}
            onEquip={onEquip}
            onSwap={onSwap}
          />
        </aside>
      </div>
    </div>
  );
}
