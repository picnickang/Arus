import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { HealthBar, Pulse, statusFill, healthColor, type SlotAssignment } from "@/components/vessel/VesselSchematic";
import type { Equipment } from "@/features/vessels/types";
import type { Part } from "@/features/inventory/types";
import { statusColor } from "./utils";

export function VesselStatusPanel({
  vessel,
  avgHealth,
  riskScore,
  riskLevel,
  activeWorkOrders,
  vesselCrew,
  equipment,
  selectedAssignment,
  compatibleParts,
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Vessel Status
        </h2>
        <div
          className="flex items-center gap-1.5 text-[11px] font-semibold"
          style={{ color: vessel.onlineStatus === "online" ? "#22c55e" : "#64748b" }}
        >
          <Pulse color={vessel.onlineStatus === "online" ? "#22c55e" : "#64748b"} size={7} />
          {(vessel.onlineStatus || "UNKNOWN").toUpperCase()}
        </div>
      </div>

      <div className="p-3.5 rounded-lg bg-sky-500/[0.03] border border-sky-500/10 mb-4">
        <div className="text-xl font-bold text-slate-100">{vessel.name}</div>
        <div className="text-[11px] text-slate-500 font-mono">
          {vessel.vesselClass?.replace("_", " ") || "N/A"} · {vessel.flag || "N/A"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-3 rounded-lg bg-green-500/[0.04] border border-green-500/10">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Health</div>
          <div
            className="text-2xl font-extrabold leading-none"
            style={{ color: healthColor(avgHealth) }}
          >
            {avgHealth}
          </div>
          <HealthBar value={avgHealth} width={90} height={4} />
        </div>
        <div
          className="p-3 rounded-lg border"
          style={{
            background: `${riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e"}08`,
            borderColor: `${riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e"}18`,
          }}
        >
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Risk</div>
          <div
            className="text-2xl font-extrabold leading-none"
            style={{ color: riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e" }}
          >
            {riskScore}
          </div>
          <div
            className="text-[10px] font-semibold mt-1"
            style={{ color: riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e" }}
          >
            {riskLevel.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="mb-4">
        {[
          ["Open Work Orders", String(activeWorkOrders.length)],
          ["Crew Assigned", String(vesselCrew.length)],
          ["Equipment", String(equipment.length)],
          [
            "Running Hours",
            equipment[0]?.runningHours
              ? `${equipment[0].runningHours.toLocaleString()} hrs`
              : "N/A",
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between items-center py-1.5 border-b border-slate-700/10"
          >
            <span className="text-xs text-slate-400">{label}</span>
            <span className="text-xs font-semibold text-slate-200 font-mono">{value}</span>
          </div>
        ))}
      </div>

      {selectedAssignment && (
        <div
          className="p-3.5 rounded-lg border animate-in fade-in-0 duration-300"
          style={{
            background: eq ? `${statusFill(eq.status)}06` : "rgba(148,163,184,0.03)",
            borderColor: eq ? `${statusFill(eq.status)}20` : "rgba(148,163,184,0.08)",
          }}
        >
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
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase ${statusColor(eq.status)}`}
                >
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
