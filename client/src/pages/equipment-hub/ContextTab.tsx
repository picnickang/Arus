import { Link } from "wouter";
import {
  Ship,
  MapPin,
  Package,
  Calendar,
  Box,
  BarChart3,
  Cpu,
  GitCompareArrows,
} from "lucide-react";
import type { EquipmentHubData } from "@/hooks/useEquipmentHub";

/** Operational context + related-tool links. */
export function ContextTab({ data }: { data: EquipmentHubData }) {
  return (
    <div className="space-y-5">
      <div
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3"
        data-testid="operational-context"
      >
        <div className="p-3 rounded-lg bg-white/[0.02] border border-slate-700/10">
          <div className="flex items-center gap-1.5 mb-1">
            <Ship className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[10px] text-slate-600 uppercase">Vessel Status</span>
          </div>
          <div className="text-sm font-semibold text-slate-200" data-testid="vessel-status">
            {data.operationalContext.vesselStatus}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.02] border border-slate-700/10">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[10px] text-slate-600 uppercase">Next Port</span>
          </div>
          <div className="text-sm font-semibold text-slate-200" data-testid="next-port">
            {data.operationalContext.nextPort || "—"}
          </div>
          {data.operationalContext.nextPortEta && (
            <div className="text-[10px] text-slate-500">
              ETA: {data.operationalContext.nextPortEta}
            </div>
          )}
        </div>
        <div className="p-3 rounded-lg bg-white/[0.02] border border-slate-700/10">
          <div className="flex items-center gap-1.5 mb-1">
            <Package className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-[10px] text-slate-600 uppercase">Parts</span>
          </div>
          <div className="text-sm font-semibold text-slate-200" data-testid="parts-availability">
            {data.operationalContext.partsAvailability === "unknown"
              ? "Check inventory"
              : data.operationalContext.partsAvailability.replace("_", " ")}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.02] border border-slate-700/10">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] text-slate-600 uppercase">Maint. Window</span>
          </div>
          <div className="text-sm font-semibold text-slate-200" data-testid="maintenance-window">
            {data.operationalContext.maintenanceWindow || "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="related-tools">
        <Link href={`/digital-twin?equipmentId=${data.id}`}>
          <div
            className="p-3 rounded-lg bg-white/[0.015] border border-slate-700/10 text-xs text-slate-400 hover:bg-violet-400/5 hover:border-violet-400/12 hover:text-violet-300 transition-colors cursor-pointer flex items-center gap-2"
            data-testid="link-digital-twin"
          >
            <Box className="h-4 w-4" /> Digital Twin
          </div>
        </Link>
        <Link href="/pdm-platform?tab=schedule">
          <div
            className="p-3 rounded-lg bg-white/[0.015] border border-slate-700/10 text-xs text-slate-400 hover:bg-blue-400/5 hover:border-blue-400/12 hover:text-blue-300 transition-colors cursor-pointer flex items-center gap-2"
            data-testid="link-schedule"
          >
            <BarChart3 className="h-4 w-4" /> Maintenance Schedule
          </div>
        </Link>
        <Link href={`/pdm-platform?equipmentId=${data.id}`}>
          <div
            className="p-3 rounded-lg bg-white/[0.015] border border-slate-700/10 text-xs text-slate-400 hover:bg-emerald-400/5 hover:border-emerald-400/12 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-2"
            data-testid="link-ml-platform"
          >
            <Cpu className="h-4 w-4" /> ML Platform
          </div>
        </Link>
        <Link href={`/equipment-intelligence?compare=${data.id}`}>
          <div
            className="p-3 rounded-lg bg-white/[0.015] border border-slate-700/10 text-xs text-slate-400 hover:bg-amber-400/5 hover:border-amber-400/12 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-2"
            data-testid="link-fleet-comparison"
          >
            <GitCompareArrows className="h-4 w-4" /> Fleet Comparison
          </div>
        </Link>
      </div>
    </div>
  );
}
