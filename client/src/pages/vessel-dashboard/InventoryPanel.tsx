import { Button } from "@/components/ui/button";
import { ArrowDownUp, CheckCircle2, Info, Package, ShoppingCart } from "lucide-react";
import { StockBadge } from "@/components/vessel/VesselSchematic";
import type { VesselEquipment } from "@/features/vessels/types";
import type { Part } from "@/features/inventory/types";

export function InventoryPanel({
  tab,
  setTab,
  parts,
  allParts,
  selectedSlotId,
  selectedEquipment,
  onEquip,
  onSwap,
}: {
  tab: string;
  setTab: (t: string) => void;
  parts: Part[];
  allParts: Part[];
  selectedSlotId: string | null;
  selectedEquipment: VesselEquipment | null;
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
              onClick={() => setTab(key ?? "all")}
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
            const qty = part.minStockLevel ? part.reorderPoint || 1 : 1;
            const hasEquipped = !!selectedEquipment;

            return (
              <div
                key={part.id}
                className="p-3 mb-1.5 rounded-lg bg-white/[0.015] border border-slate-700/10 hover:bg-sky-500/[0.04] transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-200 truncate">
                      {part.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {part.partNumber} · {part.manufacturer || "N/A"}
                    </div>
                  </div>
                  <StockBadge part={part} />
                </div>

                <div className="flex justify-between items-center mt-2 mb-2">
                  <div className="flex gap-2.5 text-[11px]">
                    <span className="text-slate-400">
                      ROB: <span className="text-slate-200 font-semibold">{qty}</span>
                    </span>
                    <span className="text-slate-500">{part.category || "General"}</span>
                  </div>
                  {part.unitCost != null && (
                    <span className="text-[13px] font-bold text-slate-200 font-mono">
                      ${Number(part.unitCost).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {selectedSlotId && qty > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2.5 border-sky-500/20 text-sky-400 hover:bg-sky-500/10 flex-1"
                      onClick={() => (hasEquipped ? onSwap(part) : onEquip(part))}
                    >
                      {hasEquipped ? (
                        <>
                          <ArrowDownUp className="h-3 w-3 mr-1" /> Swap
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Equip
                        </>
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
