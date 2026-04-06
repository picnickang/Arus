import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, AlertTriangle, CheckCircle, AlertCircle, Brain } from "lucide-react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";

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
  health: number;
  rul: number;
  risk: "critical" | "warning" | "low";
  status: string;
  type: string;
  prediction: string;
  confidence: number;
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
  avgHealth: number;
}

interface FleetSummary {
  fleetHealth: number;
  vessels: FleetSummaryVessel[];
  totalEquipment: number;
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
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


function riskColor(r: string) {
  if (r === "critical") return "text-red-500";
  if (r === "warning") return "text-yellow-500";
  return "text-green-500";
}

function riskBg(r: string) {
  if (r === "critical") return "bg-red-500/10 border-red-500/20";
  if (r === "warning") return "bg-yellow-500/8 border-yellow-500/15";
  return "bg-green-500/5 border-green-500/10";
}

function riskBadgeVariant(r: string) {
  if (r === "critical") return "destructive" as const;
  if (r === "warning") return "outline" as const;
  return "secondary" as const;
}

function riskStroke(r: string) {
  if (r === "critical") return "#ef4444";
  if (r === "warning") return "#eab308";
  return "#22c55e";
}

function healthStroke(v: number) {
  if (v > 70) return "#22c55e";
  if (v > 40) return "#eab308";
  return "#ef4444";
}

function MiniSparkline({ data, color, w = 64, h = 20 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HealthRing({ value, size = 56, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = healthStroke(value);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} data-testid={`health-ring-${value}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size * 0.3}
        fontWeight={800}
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
      >
        {value}
      </text>
    </svg>
  );
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
    if (vesselFilter !== "all") items = items.filter((e) => e.vesselId === vesselFilter);
    if (riskFilter !== "all") items = items.filter((e) => e.risk === riskFilter);
    return items;
  }, [equipment, vesselFilter, riskFilter]);

  const fleetHealth = fleet?.fleetHealth ?? 0;
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
        <div className="px-6 py-2 bg-yellow-500/5 border-b border-yellow-500/15 text-xs text-yellow-400" data-testid="fleet-data-degraded">
          Health monitoring data is limited. Some readings may reflect baseline estimates.
        </div>
      )}

      <div className="px-6 py-3 border-b border-slate-700/5 flex gap-4 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <HealthRing value={fleetHealth} size={40} stroke={4} />
          <div>
            <div className="text-[10px] text-slate-600 uppercase tracking-wider">Fleet Health</div>
            <div className={`text-sm font-bold ${fleetHealth > 70 ? "text-green-500" : fleetHealth > 40 ? "text-yellow-500" : "text-red-500"}`} data-testid="fleet-health-value">
              {fleetHealth}%
            </div>
          </div>
        </div>

        <div className="w-px h-7 bg-slate-700/12" />

        {[
          { count: criticalCount, label: "Critical", risk: "critical", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/15" },
          { count: warningCount, label: "Warning", risk: "warning", icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-500/15" },
          { count: healthyCount, label: "Healthy", risk: "low", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/15" },
        ].map(({ count, label, risk, color, bg }) => (
          <button
            key={label}
            onClick={() => setRiskFilter(riskFilter === risk ? "all" : risk)}
            data-testid={`filter-${risk}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-opacity ${
              riskFilter === "all" || riskFilter === risk ? "opacity-100" : "opacity-40"
            }`}
          >
            <span className={`w-[18px] h-[18px] rounded flex items-center justify-center text-xs font-bold ${bg} ${color}`}>
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
        <div className="px-6 py-3 border-b border-slate-700/5 bg-sky-400/[0.02] flex gap-5 flex-wrap text-xs" data-testid="system-details-panel">
          {[
            { label: "Model Status", value: systemDetails.modelStatus, color: systemDetails.modelStatus.includes("healthy") ? "bg-green-500" : "bg-yellow-500" },
            { label: "Last Training", value: systemDetails.lastTraining, color: "bg-slate-400" },
            { label: "Deployed Models", value: systemDetails.inferenceLatency, color: "bg-slate-400" },
            { label: "Data Quality", value: systemDetails.dataQuality, color: "bg-yellow-500" },
            { label: "Sensors Online", value: systemDetails.sensorsOnline, color: "bg-green-500" },
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
                <Badge variant={riskBadgeVariant(item.risk)} className="text-[10px] uppercase px-1.5 py-0">
                  {item.risk}
                </Badge>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">{item.prediction}</div>
            </div>

            <div className="text-[11px] text-slate-500 whitespace-nowrap hidden md:block">{item.vessel}</div>

            <div className="text-right min-w-[50px]">
              <div className="text-[9px] text-slate-600 uppercase">RUL</div>
              <div className={`text-sm font-bold ${riskColor(item.risk)}`}>{item.rul}d</div>
            </div>

            <div className="hidden sm:block">
              <MiniSparkline data={item.telemetry} color={riskStroke(item.risk)} w={56} h={24} />
            </div>

            <div className="text-right min-w-[45px]">
              <div className="text-[9px] text-slate-600 uppercase">Conf.</div>
              <div className="text-[13px] font-semibold text-slate-300">{item.confidence}%</div>
            </div>
          </div>
        ))}
      </div>
      </div>
    </IntelligenceLayout>
  );
}
