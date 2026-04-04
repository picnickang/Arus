import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Ship, Wrench, Users, TrendingUp, AlertCircle, Sparkles,
  Package, ShoppingCart, Info, ChevronRight, Activity, Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { CIIBadge } from "@/components/compliance/CIIBadge";
import { OperatingModeChip } from "@/components/context/OperatingModeChip";
import { ActiveDtcsPanel } from "@/components/ActiveDtcsPanel";
import { PowerSTWChart } from "@/components/analytics/PowerSTWChart";
import { NarrativeSummaryCard } from "@/components/analytics/NarrativeSummaryCard";
import { useVesselDetail } from "@/features/vessels";
import type { Equipment } from "@/features/vessels/types";
import type { Part } from "@/features/inventory/types";
import { useWorkOrders } from "@/features/work-orders";
import { useCrewList } from "@/features/crew";
import { useMaintenanceSchedules } from "@/features/maintenance";

const statusColor = (s: string) =>
  s === "operational" ? "text-green-500" :
  s === "degraded" ? "text-yellow-500" :
  s === "warning" ? "text-yellow-500" :
  s === "critical" ? "text-red-500" : "text-slate-400";

const statusFill = (s: string) =>
  s === "operational" ? "#22c55e" :
  s === "degraded" ? "#f59e0b" :
  s === "warning" ? "#f59e0b" :
  s === "critical" ? "#ef4444" : "#64748b";

const statusBg = (s: string) =>
  s === "operational" ? "bg-green-500/10" :
  s === "degraded" ? "bg-yellow-500/10" :
  s === "warning" ? "bg-yellow-500/10" :
  s === "critical" ? "bg-red-500/10" : "bg-slate-500/10";

const healthColor = (v: number) => v > 70 ? "#22c55e" : v > 40 ? "#f59e0b" : "#ef4444";

function HealthBar({ value, width = 100, height = 6 }: { value: number; width?: number; height?: number }) {
  const color = healthColor(value);
  return (
    <svg width={width} height={height} className="rounded overflow-hidden">
      <rect width={width} height={height} fill="currentColor" className="text-white/5" rx={3} />
      <rect width={width * value / 100} height={height} fill={color} rx={3}>
        <animate attributeName="width" from="0" to={String(width * value / 100)} dur="0.8s" fill="freeze" />
      </rect>
    </svg>
  );
}

function Pulse({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full animate-ping"
        style={{ backgroundColor: color, opacity: 0.6 }}
      />
      <span
        className="relative block rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    </span>
  );
}

interface SchematicEquipment {
  id: string;
  name: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: string;
  health: number;
}

function mapEquipmentToSchematic(equipment: Equipment[]): SchematicEquipment[] {
  const typePositions: Record<string, { x: number; y: number; w: number; h: number }> = {
    engine: { x: 26, y: 18, w: 20, h: 16 },
    generator: { x: 60, y: 38, w: 16, h: 14 },
    pump: { x: 38, y: 48, w: 14, h: 13 },
    thruster: { x: 78, y: 40, w: 14, h: 16 },
    crane: { x: 48, y: 20, w: 13, h: 12 },
    navigation: { x: 72, y: 18, w: 14, h: 12 },
    tank: { x: 20, y: 58, w: 16, h: 16 },
    compressor: { x: 38, y: 20, w: 14, h: 12 },
    boiler: { x: 26, y: 38, w: 16, h: 14 },
    electrical: { x: 60, y: 55, w: 16, h: 14 },
  };

  const usedPositions = new Set<string>();

  return equipment.map((eq, i) => {
    const typeLower = (eq.type || "").toLowerCase();
    let pos = Object.entries(typePositions).find(([key]) => typeLower.includes(key))?.[1];

    if (!pos || usedPositions.has(`${pos.x},${pos.y}`)) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      pos = { x: 12 + col * 20, y: 18 + row * 18, w: 16, h: 14 };
    }
    usedPositions.add(`${pos.x},${pos.y}`);

    const statusMap: Record<string, string> = {
      operational: "operational", degraded: "warning", warning: "warning",
      critical: "critical", offline: "offline",
    };

    return {
      id: eq.id,
      name: eq.name.length > 16 ? eq.name.slice(0, 14) + "…" : eq.name,
      sub: [eq.manufacturer, eq.model].filter(Boolean).join(" ") || eq.type || "",
      ...pos,
      status: statusMap[eq.status] || "operational",
      health: eq.healthScore ?? 85,
    };
  });
}

function VesselSchematic({
  equipment, selectedId, onSelect,
}: {
  equipment: SchematicEquipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <svg viewBox="0 0 100 80" className="w-full h-full min-h-[320px]">
      <defs>
        <linearGradient id="hull-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2744" />
          <stop offset="100%" stopColor="#0d1829" />
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(56,189,248,0.05)" />
          <stop offset="50%" stopColor="rgba(56,189,248,0.12)" />
          <stop offset="100%" stopColor="rgba(56,189,248,0.05)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x="0" y="72" width="100" height="8" fill="url(#water)" />

      <path
        d="M 8,68 L 8,35 Q 8,28 15,25 L 30,20 Q 35,18 40,18 L 75,18 Q 82,18 86,22 L 92,28 Q 95,32 95,38 L 95,68 Q 95,72 90,72 L 12,72 Q 8,72 8,68 Z"
        fill="url(#hull-grad)" stroke="rgba(56,189,248,0.25)" strokeWidth="0.4"
      />

      <rect x="65" y="14" width="22" height="18" rx="1.5" fill="#15243d" stroke="rgba(56,189,248,0.2)" strokeWidth="0.3" />
      {[0,1,2,3,4].map((i) => (
        <rect key={i} x={67 + i * 3.8} y={15.5} width={2.8} height={2} rx={0.4} fill="rgba(56,189,248,0.35)" />
      ))}

      <line x1="76" y1="8" x2="76" y2="14" stroke="rgba(148,163,184,0.4)" strokeWidth="0.4" />
      <circle cx="76" cy="7.5" r="0.8" fill="#f59e0b" opacity={0.8}>
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </circle>

      <rect x="10" y="34" width="50" height="34" rx="1" fill="rgba(255,255,255,0.015)" stroke="rgba(148,163,184,0.1)" strokeWidth="0.2" strokeDasharray="1 1" />
      <text x="35" y="70" textAnchor="middle" fill="rgba(148,163,184,0.25)" fontSize="2" fontFamily="monospace">AFT DECK</text>

      <line x1="52" y1="22" x2="52" y2="16" stroke="rgba(148,163,184,0.3)" strokeWidth="0.5" />
      <line x1="52" y1="16" x2="40" y2="13" stroke="rgba(148,163,184,0.3)" strokeWidth="0.4" />

      {equipment.map((eq) => {
        const isSelected = selectedId === eq.id;
        const sc = statusFill(eq.status);
        return (
          <g key={eq.id} onClick={() => onSelect(eq.id)} style={{ cursor: "pointer" }}>
            <rect
              x={eq.x} y={eq.y} width={eq.w} height={eq.h} rx={1.5}
              fill={isSelected ? `${sc}22` : `${sc}10`}
              stroke={isSelected ? sc : `${sc}66`}
              strokeWidth={isSelected ? 0.8 : 0.4}
              className="transition-all duration-200"
            />
            <circle cx={eq.x + eq.w - 2.5} cy={eq.y + 2.5} r={1.2} fill={sc} filter="url(#glow)">
              {eq.status === "critical" && (
                <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
              )}
            </circle>
            <text x={eq.x + eq.w / 2} y={eq.y + eq.h / 2 - 1} textAnchor="middle" fill="rgba(226,232,240,0.9)" fontSize="2.2" fontWeight="600" fontFamily="system-ui">
              {eq.name}
            </text>
            <text x={eq.x + eq.w / 2} y={eq.y + eq.h / 2 + 2} textAnchor="middle" fill="rgba(148,163,184,0.6)" fontSize="1.6" fontFamily="monospace">
              {eq.sub.length > 18 ? eq.sub.slice(0, 16) + "…" : eq.sub}
            </text>
            <rect x={eq.x + 1.5} y={eq.y + eq.h - 2.5} width={eq.w - 3} height={1} rx={0.5} fill="rgba(255,255,255,0.06)" />
            <rect x={eq.x + 1.5} y={eq.y + eq.h - 2.5} width={(eq.w - 3) * eq.health / 100} height={1} rx={0.5} fill={sc} opacity={0.7} />
          </g>
        );
      })}
    </svg>
  );
}

function StockBadge({ quantity, minLevel }: { quantity: number; minLevel?: number }) {
  if (quantity === 0) return <Badge variant="destructive" className="text-[10px]" data-testid="badge-stock-critical">Out of Stock</Badge>;
  if (minLevel && quantity <= minLevel) return <Badge variant="secondary" className="text-[10px] bg-yellow-500/15 text-yellow-500" data-testid="badge-stock-low">Low Stock</Badge>;
  return <Badge variant="secondary" className="text-[10px] bg-green-500/15 text-green-500" data-testid="badge-stock-ok">In Stock</Badge>;
}

export default function VesselDashboard() {
  const { match, vesselId, vessel, vesselLoading, equipment, equipmentLoading,
    vesselWorkOrders, vesselCrew, vesselMaintenanceSchedules,
    activeWorkOrders, completedWorkOrders, utilizationRate, totalCost, powerSTWDateRange,
    workOrdersLoading, crewLoading, schedulesLoading,
  } = useVesselDetail();

  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [inventoryTab, setInventoryTab] = useState("compatible");
  const [bottomTab, setBottomTab] = useState("work-orders");

  const schematicEquipment = useMemo(() => mapEquipmentToSchematic(equipment), [equipment]);
  const selected = useMemo(() => equipment.find((e) => e.id === selectedEquipment), [selectedEquipment, equipment]);
  const selectedSchematic = useMemo(() => schematicEquipment.find((e) => e.id === selectedEquipment), [selectedEquipment, schematicEquipment]);

  const { data: compatibleParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/equipment", selectedEquipment, "compatible-parts"],
    queryFn: () => apiRequest("GET", `/api/equipment/${selectedEquipment}/compatible-parts`),
    enabled: !!selectedEquipment,
  });

  const { data: allParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/parts"],
    queryFn: () => apiRequest("GET", "/api/parts"),
  });

  const filteredParts = useMemo(() => {
    if (inventoryTab === "all") return allParts;
    if (inventoryTab === "compatible") return selectedEquipment ? compatibleParts : [];
    if (inventoryTab === "critical") return allParts.filter((p) => p.criticality === "critical" || p.criticality === "high");
    return [];
  }, [inventoryTab, selectedEquipment, compatibleParts, allParts]);

  const avgHealth = useMemo(() => {
    if (equipment.length === 0) return 0;
    return Math.round(equipment.reduce((sum, eq) => sum + (eq.healthScore ?? 85), 0) / equipment.length);
  }, [equipment]);

  const riskScore = useMemo(() => {
    const criticalCount = equipment.filter((eq) => eq.status === "critical").length;
    const warningCount = equipment.filter((eq) => eq.status === "warning" || eq.status === "degraded").length;
    return Math.min(100, criticalCount * 25 + warningCount * 10);
  }, [equipment]);

  const riskLevel = riskScore > 60 ? "high" : riskScore > 30 ? "medium" : "low";

  if (!match || vesselLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  if (!vessel) {
    return (
      <div className="p-6">
        <Card><CardContent className="pt-6">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Vessel not found</h3>
            <p className="text-muted-foreground">The vessel you're looking for doesn't exist.</p>
            <Button asChild className="mt-4"><Link href="/vessel-management">Back to Vessels</Link></Button>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080e1a] text-slate-200" data-testid="vessel-dashboard-page">
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-slate-700/20 bg-[#080e1a]/95 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8" data-testid="btn-back">
            <Link href="/vessel-management"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white font-bold text-sm">
            <Ship className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <span className="text-slate-400">{vessel.vesselType || "Vessel"}</span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-sky-400" data-testid="text-vessel-name">{vessel.name}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {vessel.imo ? `IMO ${vessel.imo}` : vessel.id.slice(0, 8)} · {vessel.vesselClass?.replace("_", " ") || "N/A"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-3 text-[11px]">
            {[["Healthy", "#22c55e"], ["Warning", "#f59e0b"], ["Critical", "#ef4444"]].map(([label, color]) => (
              <span key={label as string} className="flex items-center gap-1 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color as string }} />
                {label}
              </span>
            ))}
          </div>
          <CIIBadge vesselId={vesselId!} vesselName={vessel.name} />
          <OperatingModeChip vesselId={vesselId!} />
          <Button variant="outline" size="sm" className="gap-1.5 border-sky-500/30 text-sky-400 hover:bg-sky-500/10" data-testid="btn-ai-assistant">
            <Sparkles className="h-3.5 w-3.5" /> Ask AI
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] h-[calc(100vh-53px)]">

        {/* LEFT: Vessel Status Sidebar */}
        <aside className="border-r border-slate-700/15 overflow-y-auto p-4 bg-slate-900/50 hidden lg:block" data-testid="panel-vessel-status">
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Vessel Status</h2>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: vessel.onlineStatus === "online" ? "#22c55e" : "#64748b" }}>
                <Pulse color={vessel.onlineStatus === "online" ? "#22c55e" : "#64748b"} size={7} />
                {(vessel.onlineStatus || "UNKNOWN").toUpperCase()}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-sky-500/[0.03] border border-sky-500/10">
              <div className="text-xl font-bold text-slate-100" data-testid="text-vessel-name-sidebar">{vessel.name}</div>
              <div className="text-[11px] text-slate-500 font-mono">
                {vessel.vesselClass?.replace("_", " ") || "N/A"} · {vessel.flag || "N/A"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="p-3 rounded-lg bg-green-500/[0.04] border border-green-500/10">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Health</div>
              <div className="text-2xl font-extrabold leading-none" style={{ color: healthColor(avgHealth) }} data-testid="text-health-score">{avgHealth}</div>
              <HealthBar value={avgHealth} width={90} height={4} />
            </div>
            <div className="p-3 rounded-lg border" style={{ background: `${healthColor(100 - riskScore)}08`, borderColor: `${healthColor(100 - riskScore)}18` }}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Risk</div>
              <div className="text-2xl font-extrabold leading-none" style={{ color: riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e" }} data-testid="text-risk-score">{riskScore}</div>
              <div className="text-[10px] font-semibold mt-1" style={{ color: riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f59e0b" : "#22c55e" }}>{riskLevel.toUpperCase()}</div>
            </div>
          </div>

          <div className="mb-4">
            {[
              ["Open Work Orders", String(activeWorkOrders.length)],
              ["Crew Assigned", String(vesselCrew.length)],
              ["Running Hours", equipment[0]?.runningHours ? `${equipment[0].runningHours.toLocaleString()} hrs` : "N/A"],
              ["Day Rate", vessel.dayRateSgd ? `SGD ${Number(vessel.dayRateSgd).toLocaleString()}` : "N/A"],
              ["Revenue YTD", totalCost !== "N/A" ? `SGD ${Number(totalCost).toLocaleString()}` : "N/A"],
              ["Downtime YTD", `${vessel.downtimeDays || 0} days`],
              ["Utilization", utilizationRate === "N/A" || utilizationRate === "NaN" ? "N/A" : `${utilizationRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-700/10">
                <span className="text-xs text-slate-400">{label}</span>
                <span className="text-xs font-semibold text-slate-200 font-mono">{value}</span>
              </div>
            ))}
          </div>

          {selected && selectedSchematic && (
            <div className="p-3.5 rounded-lg border animate-in fade-in-0 duration-300" style={{ background: `${statusFill(selectedSchematic.status)}06`, borderColor: `${statusFill(selectedSchematic.status)}20` }} data-testid="panel-selected-equipment">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Selected Equipment</div>
              <div className="text-[15px] font-bold text-slate-100">{selected.name}</div>
              <div className="text-[11px] text-slate-500 mb-2.5 font-mono">
                {[selected.manufacturer, selected.model].filter(Boolean).join(" ") || selected.type}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-slate-400">Health</span>
                <HealthBar value={selectedSchematic.health} width={80} height={5} />
                <span className="text-xs font-bold" style={{ color: statusFill(selectedSchematic.status) }}>{selectedSchematic.health}%</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-[10px] uppercase ${statusColor(selected.status)}`} data-testid="badge-equipment-status">
                  {selected.status}
                </Badge>
                <span className="text-[11px] text-slate-500">
                  {filteredParts.length} compatible part{filteredParts.length !== 1 ? "s" : ""}
                </span>
              </div>

              {selected.lastMaintenanceDate && (
                <div className="text-[10px] text-slate-500 mt-2">
                  Last service: {formatDistanceToNow(new Date(selected.lastMaintenanceDate), { addSuffix: true })}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* CENTER: Equipment Schematic + Bottom Tabs */}
        <main className="relative overflow-hidden flex flex-col" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(56,189,248,0.03) 0%, transparent 70%)" }}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-sky-500/10 to-transparent" style={{ animation: "scan-line 8s linear infinite" }} />
          </div>
          <style>{`@keyframes scan-line { 0% { transform: translateY(-100vh); } 100% { transform: translateY(100vh); } }`}</style>

          <div className="px-5 py-3 flex justify-between items-center border-b border-slate-700/10 shrink-0">
            <div>
              <h2 className="text-[13px] font-bold text-slate-200 uppercase tracking-wide">Equipment Schematic</h2>
              <div className="text-[11px] text-slate-500 mt-0.5">Tap equipment to view details and compatible parts</div>
            </div>
            <div className="flex gap-1.5">
              {schematicEquipment.map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => setSelectedEquipment(eq.id === selectedEquipment ? null : eq.id)}
                  className="rounded-full p-0 transition-all duration-150"
                  style={{
                    width: 8, height: 8,
                    background: eq.id === selectedEquipment ? "#38bdf8" : statusFill(eq.status),
                    border: eq.id === selectedEquipment ? "2px solid #38bdf8" : "1px solid transparent",
                    opacity: eq.id === selectedEquipment ? 1 : 0.6,
                  }}
                  title={eq.name}
                  data-testid={`dot-equipment-${eq.id}`}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 px-5 py-3 min-h-0">
            {equipmentLoading ? (
              <Skeleton className="w-full h-full min-h-[320px]" />
            ) : equipment.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                <div className="text-center">
                  <Settings2 className="mx-auto h-12 w-12 mb-3 text-slate-600" />
                  <p>No equipment registered for this vessel</p>
                  <Button asChild variant="link" className="text-sky-400 mt-2" data-testid="link-add-equipment">
                    <Link href="/equipment">Add Equipment</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <VesselSchematic
                equipment={schematicEquipment}
                selectedId={selectedEquipment}
                onSelect={(id) => setSelectedEquipment(id === selectedEquipment ? null : id)}
              />
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-5 py-2 bg-[#080e1a]/90 backdrop-blur border-t border-slate-700/10 flex gap-4 justify-center z-10">
            {[
              [equipment.filter((e) => e.status === "operational").length, "Healthy", "#22c55e"],
              [equipment.filter((e) => e.status === "warning" || e.status === "degraded").length, "Warning", "#f59e0b"],
              [equipment.filter((e) => e.status === "critical").length, "Critical", "#ef4444"],
            ].map(([count, label, color]) => (
              <div key={label as string} className="flex items-center gap-1.5 text-xs">
                <span className="w-[18px] h-[18px] rounded flex items-center justify-center text-[11px] font-bold" style={{ background: `${color}15`, color: color as string }}>
                  {count as number}
                </span>
                <span className="text-slate-400">{label}</span>
              </div>
            ))}
          </div>

          {/* Bottom tabs area */}
          <div className="border-t border-slate-700/15 bg-slate-900/30 shrink-0">
            <Tabs value={bottomTab} onValueChange={setBottomTab}>
              <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-slate-700/10 px-4 h-9">
                <TabsTrigger value="work-orders" className="text-xs data-[state=active]:text-sky-400" data-testid="tab-work-orders">
                  <Wrench className="h-3 w-3 mr-1" /> Work Orders ({activeWorkOrders.length})
                </TabsTrigger>
                <TabsTrigger value="crew" className="text-xs data-[state=active]:text-sky-400" data-testid="tab-crew">
                  <Users className="h-3 w-3 mr-1" /> Crew ({vesselCrew.length})
                </TabsTrigger>
                <TabsTrigger value="maintenance" className="text-xs data-[state=active]:text-sky-400" data-testid="tab-maintenance">
                  <Activity className="h-3 w-3 mr-1" /> Maintenance
                </TabsTrigger>
                <TabsTrigger value="performance" className="text-xs data-[state=active]:text-sky-400" data-testid="tab-performance">
                  <TrendingUp className="h-3 w-3 mr-1" /> Performance
                </TabsTrigger>
                <TabsTrigger value="diagnostics" className="text-xs data-[state=active]:text-sky-400" data-testid="tab-diagnostics">
                  <AlertCircle className="h-3 w-3 mr-1" /> DTCs
                </TabsTrigger>
              </TabsList>

              <div className="h-[200px] overflow-y-auto px-4 py-2">
                <TabsContent value="work-orders" className="mt-0">
                  {workOrdersLoading ? <Skeleton className="h-20" /> : vesselWorkOrders.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">No work orders for this vessel</div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow className="border-slate-700/20">
                        <TableHead className="text-[11px] text-slate-500">ID</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Equipment</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Description</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Status</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Created</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {vesselWorkOrders.slice(0, 10).map((wo) => (
                          <TableRow key={wo.id} className="border-slate-700/10" data-testid={`row-wo-${wo.id}`}>
                            <TableCell className="font-mono text-[11px] text-slate-400">{wo.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-xs">{wo.equipmentId}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{wo.description}</TableCell>
                            <TableCell><Badge variant={wo.status === "completed" ? "default" : "outline"} className="text-[10px]">{wo.status}</Badge></TableCell>
                            <TableCell className="text-[11px] text-slate-500">{formatDistanceToNow(new Date(wo.createdAt), { addSuffix: true })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="crew" className="mt-0">
                  {crewLoading ? <Skeleton className="h-20" /> : vesselCrew.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">No crew assigned</div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow className="border-slate-700/20">
                        <TableHead className="text-[11px] text-slate-500">Name</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Role</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Rank</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {vesselCrew.map((member) => (
                          <TableRow key={member.id} className="border-slate-700/10" data-testid={`row-crew-${member.id}`}>
                            <TableCell className="text-xs font-medium">{member.name}</TableCell>
                            <TableCell className="text-xs">{member.role || "N/A"}</TableCell>
                            <TableCell className="text-xs">{member.rank || "N/A"}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{member.status || "Active"}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="maintenance" className="mt-0">
                  {schedulesLoading ? <Skeleton className="h-20" /> : vesselMaintenanceSchedules.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">No maintenance schedules</div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow className="border-slate-700/20">
                        <TableHead className="text-[11px] text-slate-500">Equipment</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Type</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Date</TableHead>
                        <TableHead className="text-[11px] text-slate-500">Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {vesselMaintenanceSchedules.map((s) => (
                          <TableRow key={s.id} className="border-slate-700/10">
                            <TableCell className="text-xs">{s.equipmentId}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{s.isPredictive ? "Predictive" : "Scheduled"}</Badge></TableCell>
                            <TableCell className="text-xs">{new Date(s.scheduledDate).toLocaleDateString()}</TableCell>
                            <TableCell><Badge variant={s.status === "completed" ? "default" : "outline"} className="text-[10px]">{s.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="performance" className="mt-0">
                  <div className="grid gap-4 lg:grid-cols-3 py-2">
                    <div className="lg:col-span-2">
                      <PowerSTWChart vesselId={vesselId!} startDate={powerSTWDateRange.startDate} endDate={powerSTWDateRange.endDate} />
                    </div>
                    <div className="lg:col-span-1">
                      <NarrativeSummaryCard vesselId={vesselId!} vesselName={vessel.name} chartType="power_stw" currentMetrics={{ avgPower: equipment.length > 0 ? 150 : undefined }} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="diagnostics" className="mt-0">
                  {equipment.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">No equipment to show diagnostics</div>
                  ) : selectedEquipment ? (
                    <ActiveDtcsPanel equipmentId={selectedEquipment} equipmentName={selected?.name || selectedEquipment} />
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-xs">Select equipment on the schematic to view diagnostic codes</div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>

        {/* RIGHT: Inventory Panel */}
        <aside className="border-l border-slate-700/15 flex flex-col bg-slate-900/50 hidden lg:flex" data-testid="panel-inventory">
          <div className="px-4 pt-3 pb-0 border-b border-slate-700/10">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2.5 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Inventory
            </h2>
            <div className="flex gap-0.5">
              {[
                ["compatible", "Compatible"],
                ["critical", "Critical"],
                ["all", "All Parts"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setInventoryTab(key)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-t-md border border-b-0 transition-colors ${
                    inventoryTab === key
                      ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                      : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                  }`}
                  data-testid={`btn-inventory-${key}`}
                >
                  {label}
                  {key === "critical" && (
                    <span className="ml-1.5 text-[9px] font-bold px-1.5 py-px rounded bg-red-500/15 text-red-400">
                      {allParts.filter((p) => p.criticality === "critical" || p.criticality === "high").length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {filteredParts.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                {selectedEquipment
                  ? "No compatible parts found for selected equipment"
                  : "Select equipment on the schematic to see compatible parts"}
              </div>
            ) : (
              filteredParts.map((part) => (
                <div
                  key={part.id}
                  className="p-3 mb-1.5 rounded-lg bg-white/[0.015] border border-slate-700/10 hover:bg-sky-500/[0.04] transition-colors cursor-pointer"
                  data-testid={`card-part-${part.id}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-200 truncate">{part.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {part.partNumber} · {part.manufacturer || "N/A"}
                      </div>
                    </div>
                    <StockBadge quantity={part.minStockLevel ? (part.reorderPoint || 1) : 1} minLevel={part.minStockLevel} />
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <div className="flex gap-2.5">
                      <span className="text-[11px] text-slate-400">{part.category || "General"}</span>
                    </div>
                    {part.unitCost && (
                      <span className="text-[13px] font-bold text-slate-200 font-mono">
                        ${part.unitCost.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1.5 mt-2">
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2.5 border-sky-500/20 text-sky-400 hover:bg-sky-500/10" data-testid={`btn-reserve-${part.id}`}>
                      Reserve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2.5 text-slate-400" data-testid={`btn-details-${part.id}`}>
                      <Info className="h-3 w-3 mr-1" /> Details
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-slate-700/10 bg-[#080e1a]/50 flex justify-between text-[11px]">
            <span className="text-slate-500">{allParts.length} parts total</span>
            <span className="text-red-400 font-semibold">
              {allParts.filter((p) => p.criticality === "critical").length} critical
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
