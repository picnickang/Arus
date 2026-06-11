import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, AlertTriangle, CheckCircle, AlertCircle, Brain } from "lucide-react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";
import {
  riskColor,
  riskBadgeVariant,
  HealthRing,
  MiniSparkline,
} from "@/pages/equipment-hub/shared";

function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}

interface EquipmentRiskItem {
  id: string;
  name: string;
  vessel: string;
  vesselId: string;
  health: number | null;
  rul: number | null;
  risk: "critical" | "warning" | "low";
  status: string;
  type: string;
  prediction: string;
  confidence: number | null;
  trend: "declining" | "stable" | "improving";
  lastService: string | null;
  nextDue: string | null;
  telemetry: number[];
  signals: string[];
  dataAvailability: "full" | "partial" | "unavailable";
}

interface FleetSummaryVessel {
  id: string;
  name: string;
  equipment: number;
  critical: number;
  warning: number;
  healthy: number;
  noData: number;
  avgHealth: number | null;
}

interface FleetSummary {
  fleetHealth: number | null;
  vessels: FleetSummaryVessel[];
  totalEquipment: number;
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
  noDataCount: number;
  dataStatus: "ok" | "degraded";
}

interface SystemDetails {
  modelStatus: string;
  lastTraining: string;
  inferenceLatency: string;
  dataQuality: string;
  sensorsOnline: string;
}

interface IntelligenceData {
  fleet: FleetSummary;
  equipment: EquipmentRiskItem[];
  systemDetails?: SystemDetails;
}

function riskStroke(r: string) {
  if (r === "critical") {
    return "#ef4444";
  }
  if (r === "warning") {
    return "#eab308";
  }
  return "#22c55e";
}

export default function EquipmentIntelligence() {
  const [, navigate] = useLocation();
  const [vesselFilter, setVesselFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const { isAdminUnlocked } = useAdminAccess();

  const [showSystem, setShowSystem] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("system") === "true";
  });

  const overviewQuery = useQuery<IntelligenceData>({
    queryKey: ["/api/equipment-intelligence/overview"],
    refetchInterval: 60000,
  });

  const systemDetailsQuery = useQuery<SystemDetails>({
    queryKey: ["/api/equipment-intelligence/system-details"],
    enabled: isAdminUnlocked && showSystem,
  });

  const data = overviewQuery.data;
  const equipment = data?.equipment || [];
  const fleet = data?.fleet;
  const systemDetails = systemDetailsQuery.data;

  const filtered = useMemo(() => {
    let items = equipment;
    if (vesselFilter !== "all") {
      items = items.filter((e) => e.vesselId === vesselFilter);
    }
    if (riskFilter !== "all") {
      items = items.filter((e) => e.risk === riskFilter);
    }
    return items;
  }, [equipment, vesselFilter, riskFilter]);

  const fleetHealth = fleet?.fleetHealth ?? null;
  const criticalCount = fleet?.criticalCount ?? 0;
  const warningCount = fleet?.warningCount ?? 0;
  const healthyCount = fleet?.healthyCount ?? 0;
  const vessels = fleet?.vessels || [];
  const fleetDataStatus = fleet?.dataStatus ?? "ok";

  if (overviewQuery.isLoading) {
    return (
      <IntelligenceLayout>
        <div className="min-h-screen flex items-center justify-center" data-testid="loading-state">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            <p className="text-sm text-slate-500">Loading Equipment Intelligence...</p>
          </div>
        </div>
      </IntelligenceLayout>
    );
  }

  return (
    <IntelligenceLayout>
      <div data-testid="equipment-intelligence-page">
        <PageTitle title="Equipment Intelligence | ARUS" />

        <div className="px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            AI health monitoring, predictions, and recommendations — all in one view
          </p>
          {isAdminUnlocked && (
            <Button
              variant={showSystem ? "secondary" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setShowSystem(!showSystem)}
              data-testid="button-system-details"
            >
              <Brain className="h-3.5 w-3.5 mr-1" />
              System Details
            </Button>
          )}
        </div>

        {fleetDataStatus === "degraded" && (
          <div
            className="px-6 py-2 bg-yellow-500/5 border-b border-yellow-500/15 text-xs text-yellow-400"
            data-testid="fleet-data-degraded"
          >
            Health monitoring data is limited. Some readings may reflect baseline estimates.
          </div>
        )}

        <div className="px-6 py-3 border-b border-slate-700/5 flex gap-4 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <HealthRing value={fleetHealth} size={40} stroke={4} />
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider">
                Fleet Health
              </div>
              <div
                className={`text-sm font-bold ${fleetHealth == null ? "text-slate-500" : fleetHealth > 70 ? "text-green-500" : fleetHealth > 40 ? "text-yellow-500" : "text-red-500"}`}
                data-testid="fleet-health-value"
              >
                {fleetHealth == null ? "No scores yet" : `${fleetHealth}%`}
              </div>
            </div>
          </div>

          <div className="w-px h-7 bg-slate-700/12" />

          {[
            {
              count: criticalCount,
              label: "Critical",
              risk: "critical",
              icon: AlertTriangle,
              color: "text-red-500",
              bg: "bg-red-500/15",
            },
            {
              count: warningCount,
              label: "Warning",
              risk: "warning",
              icon: AlertCircle,
              color: "text-yellow-500",
              bg: "bg-yellow-500/15",
            },
            {
              count: healthyCount,
              label: "Healthy",
              risk: "low",
              icon: CheckCircle,
              color: "text-green-500",
              bg: "bg-green-500/15",
            },
          ].map(({ count, label, risk, color, bg }) => (
            <button
              key={label}
              onClick={() => setRiskFilter(riskFilter === risk ? "all" : risk)}
              data-testid={`filter-${risk}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-opacity ${
                riskFilter === "all" || riskFilter === risk ? "opacity-100" : "opacity-40"
              }`}
            >
              <span
                className={`w-[18px] h-[18px] rounded flex items-center justify-center text-xs font-bold ${bg} ${color}`}
              >
                {count}
              </span>
              <span className="text-xs text-slate-400">{label}</span>
            </button>
          ))}

          <div className="w-px h-7 bg-slate-700/12" />

          <select
            value={vesselFilter}
            onChange={(e) => setVesselFilter(e.target.value)}
            className="px-2.5 py-1 rounded-md text-xs bg-white/[0.03] border border-slate-700/15 text-slate-400 cursor-pointer outline-none"
            data-testid="vessel-filter"
          >
            <option value="all">All Vessels</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {(vesselFilter !== "all" || riskFilter !== "all") && (
            <button
              onClick={() => {
                setVesselFilter("all");
                setRiskFilter("all");
              }}
              className="text-xs text-slate-500 underline hover:text-slate-300"
              data-testid="button-clear-filters"
            >
              Clear filters
            </button>
          )}
        </div>

        {showSystem && systemDetails && (
          <div
            className="px-6 py-3 border-b border-slate-700/5 bg-sky-400/[0.02] flex gap-5 flex-wrap text-xs"
            data-testid="system-details-panel"
          >
            {[
              {
                label: "Model Status",
                value: systemDetails.modelStatus,
                color: systemDetails.modelStatus.includes("healthy")
                  ? "bg-green-500"
                  : "bg-yellow-500",
              },
              { label: "Last Training", value: systemDetails.lastTraining, color: "bg-slate-400" },
              {
                label: "Deployed Models",
                value: systemDetails.inferenceLatency,
                color: "bg-slate-400",
              },
              { label: "Data Quality", value: systemDetails.dataQuality, color: "bg-yellow-500" },
              {
                label: "Sensors Online",
                value: systemDetails.sensorsOnline,
                color: "bg-green-500",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-[5px] h-[5px] rounded-full ${color}`} />
                <span className="text-slate-600">{label}:</span>
                <span className="text-slate-300 font-semibold">{value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="px-6 pt-2 pb-6">
          {filtered.length === 0 && !overviewQuery.isLoading && (
            <div className="text-center py-16 text-slate-600" data-testid="empty-state">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No equipment matches the current filters.</p>
            </div>
          )}

          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/equipment/${item.id}`)}
              data-testid={`equipment-row-${item.id}`}
              className="px-4 py-3.5 mb-1 rounded-xl bg-white/[0.01] border border-slate-700/8 grid items-center gap-4 cursor-pointer transition-colors hover:bg-sky-400/[0.03] hover:border-sky-400/10"
              style={{ gridTemplateColumns: "auto 1fr auto auto auto auto" }}
            >
              <HealthRing value={item.health} size={40} stroke={4} />

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">{item.name}</span>
                  {item.health == null ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase px-1.5 py-0 text-slate-500 border-slate-600/40"
                    >
                      No data
                    </Badge>
                  ) : (
                    <Badge
                      variant={riskBadgeVariant(item.risk)}
                      className="text-[10px] uppercase px-1.5 py-0"
                    >
                      {item.risk}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{item.prediction}</div>
              </div>

              <div className="text-[11px] text-slate-500 whitespace-nowrap hidden md:block">
                {item.vessel}
              </div>

              <div className="text-right min-w-[50px]">
                <div className="text-[9px] text-slate-600 uppercase">RUL</div>
                <div
                  className={`text-sm font-bold ${item.rul == null ? "text-slate-600" : riskColor(item.risk)}`}
                >
                  {item.rul == null ? "—" : `${item.rul}d`}
                </div>
              </div>

              <div className="hidden sm:block">
                <MiniSparkline data={item.telemetry} color={riskStroke(item.risk)} w={56} h={24} />
              </div>

              <div className="text-right min-w-[45px]">
                <div className="text-[9px] text-slate-600 uppercase">Conf.</div>
                <div className="text-[13px] font-semibold text-slate-300">
                  {item.confidence == null ? "—" : `${item.confidence}%`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </IntelligenceLayout>
  );
}
