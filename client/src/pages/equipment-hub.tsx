import { useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  AlertTriangle,
  ChevronRight,
  Clock,
  Wrench,
  FileText,
  Activity,
  Box,
  BarChart3,
  Cpu,
  Play,
  ArrowRight,
  Ship,
  MapPin,
  Package,
  Calendar,
  GitCompareArrows,
  Check,
  UserPlus,
  BellOff,
} from "lucide-react";
import { useEquipmentHub } from "@/hooks/useEquipmentHub";

function riskColor(r: string) {
  if (r === "critical") {
    return "text-red-500";
  }
  if (r === "warning") {
    return "text-yellow-500";
  }
  return "text-green-500";
}
function riskBg(r: string) {
  if (r === "critical") {
    return "bg-red-500/10 border-red-500/20";
  }
  if (r === "warning") {
    return "bg-yellow-500/8 border-yellow-500/15";
  }
  return "bg-green-500/5 border-green-500/10";
}
function riskBadgeVariant(r: string) {
  if (r === "critical") {
    return "destructive" as const;
  }
  if (r === "warning") {
    return "outline" as const;
  }
  return "secondary" as const;
}
function healthStroke(v: number) {
  if (v > 70) {
    return "#22c55e";
  }
  if (v > 40) {
    return "#eab308";
  }
  return "#ef4444";
}

function HealthRing({
  value,
  size = 72,
  stroke = 6,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = healthStroke(value);
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: "rotate(-90deg)" }}
      data-testid={`health-ring-${value}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={stroke}
      />
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
        fontSize={size * 0.28}
        fontWeight={800}
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
      >
        {value}
      </text>
    </svg>
  );
}

function MiniSparkline({
  data,
  color,
  w = 120,
  h = 32,
}: {
  data: number[];
  color: string;
  w?: number;
  h?: number;
}) {
  if (!data || data.length < 2) {
    return null;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    scheduled: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    draft: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    sent: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${variants[status] || "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}
    >
      {status}
    </span>
  );
}

function SeverityDot({ severity }: { severity?: string | undefined }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-red-500",
    warning: "bg-yellow-500",
    medium: "bg-yellow-500",
    info: "bg-blue-400",
    low: "bg-green-500",
  };
  return <span className={`w-2 h-2 rounded-full ${colors[severity || "info"] || "bg-blue-400"}`} />;
}

export default function EquipmentHub() {
  const params = useParams<{ equipmentId: string }>();
  const equipmentId = params.equipmentId || "";
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = "Equipment Hub | ARUS";
  }, []);

  const {
    data,
    isLoading,
    error,
    runDiagnostic,
    isDiagnosticPending,
    acknowledgeAnomaly,
    isAcknowledgePending,
    crew,
    isCrewLoading,
    assignWork,
    isAssignPending,
  } = useEquipmentHub(equipmentId);

  if (isLoading) {
    return (
      <IntelligenceLayout>
        <div className="min-h-screen flex items-center justify-center" data-testid="loading-state">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            <p className="text-sm text-slate-500">Loading equipment data...</p>
          </div>
        </div>
      </IntelligenceLayout>
    );
  }

  if (error || !data) {
    return (
      <IntelligenceLayout>
        <div className="min-h-screen flex items-center justify-center" data-testid="error-state">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500">Failed to load equipment data</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => navigate("/equipment-intelligence")}
              data-testid="button-back-to-fleet"
            >
              Back to Fleet
            </Button>
          </div>
        </div>
      </IntelligenceLayout>
    );
  }

  return (
    <IntelligenceLayout>
      <div
        className="max-w-6xl mx-auto px-4 md:px-6 py-4 space-y-5"
        data-testid="equipment-hub-page"
      >
        {/* Breadcrumb */}
        <nav
          className="flex items-center gap-1.5 text-xs text-slate-500"
          data-testid="equipment-breadcrumb"
        >
          <Link href="/equipment-intelligence" className="hover:text-slate-300 transition-colors">
            Fleet
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-400">{data.vessel}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-200 font-medium">{data.name}</span>
        </nav>

        {/* Section 1: Header */}
        <div className="flex flex-col md:flex-row gap-5 items-start" data-testid="hub-header">
          <div className="flex items-center gap-4 flex-1">
            <HealthRing value={data.health} size={80} stroke={7} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-100" data-testid="equipment-name">
                  {data.name}
                </h1>
                <Badge
                  variant={riskBadgeVariant(data.risk)}
                  className="text-[10px] uppercase"
                  data-testid="risk-badge"
                >
                  {data.risk}
                </Badge>
              </div>
              <div className="text-xs text-slate-500">
                {data.vessel} · {data.type}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <div>
                  <span className="text-slate-600">RUL</span>{" "}
                  <span className={`font-bold ${riskColor(data.risk)}`} data-testid="rul-value">
                    {data.rul}d
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Confidence</span>{" "}
                  <span className="font-bold text-slate-200" data-testid="confidence-value">
                    {data.confidence}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Trend</span>{" "}
                  <span
                    className={`font-semibold ${data.trend === "declining" ? "text-red-400" : data.trend === "improving" ? "text-green-400" : "text-slate-400"}`}
                  >
                    {data.trend === "declining"
                      ? "↘ Declining"
                      : data.trend === "improving"
                        ? "↗ Improving"
                        : "→ Stable"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <MiniSparkline data={data.telemetry} color={healthStroke(data.health)} w={140} h={40} />
        </div>

        {/* Section 2: Sticky Action Bar */}
        {(() => {
          const assignableWorkOrder = data.workOrders.find(
            (wo) =>
              wo.status === "open" || wo.status === "pending" || wo.status === "in_progress"
          );
          const anomaly = data.activeAnomaly;
          const canAcknowledge = !!anomaly && !anomaly.acknowledged;
          return (
            <div
              className="flex items-center gap-2 flex-wrap sticky top-0 z-10 py-2 bg-[#080e1a]/95 backdrop-blur-sm -mx-4 px-4 md:-mx-6 md:px-6"
              data-testid="action-bar"
            >
              <Button
                size="sm"
                className="text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 hover:bg-sky-500/25"
                onClick={() => navigate(`/work-orders?action=create&equipmentId=${data.id}`)}
                data-testid="button-create-work-order"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Create Work Order
              </Button>

              {anomaly && anomaly.acknowledged ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-emerald-400 border-emerald-500/25"
                  disabled
                  data-testid="button-acknowledge"
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Acknowledged
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => acknowledgeAnomaly()}
                  disabled={!canAcknowledge || isAcknowledgePending}
                  title={
                    canAcknowledge
                      ? "Acknowledge the active anomaly"
                      : "No active anomaly to acknowledge"
                  }
                  data-testid="button-acknowledge"
                >
                  {isAcknowledgePending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Acknowledge
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={isAssignPending}
                    data-testid="button-assign"
                  >
                    {isAssignPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Assign
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel className="text-xs">
                    {assignableWorkOrder
                      ? `Assign "${assignableWorkOrder.title}" to`
                      : "Assign work to"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!assignableWorkOrder ? (
                    <DropdownMenuItem
                      onClick={() =>
                        navigate(`/work-orders?action=create&equipmentId=${data.id}`)
                      }
                      data-testid="assign-no-work-order"
                    >
                      <FileText className="h-3.5 w-3.5 mr-2" />
                      No open work order — create one
                    </DropdownMenuItem>
                  ) : isCrewLoading ? (
                    <DropdownMenuItem disabled>
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Loading crew...
                    </DropdownMenuItem>
                  ) : crew.length === 0 ? (
                    <DropdownMenuItem
                      onClick={() => navigate("/crew")}
                      data-testid="assign-no-crew"
                    >
                      No crew available — manage crew
                    </DropdownMenuItem>
                  ) : (
                    crew.map((member) => (
                      <DropdownMenuItem
                        key={member.id}
                        onClick={() =>
                          assignWork({ workOrderId: assignableWorkOrder.id, crewId: member.id })
                        }
                        data-testid={`assign-crew-${member.id}`}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-2" />
                        <span className="truncate">
                          {member.name}
                          {member.rank ? ` · ${member.rank}` : ""}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })()}

        {/* Section 3: Assessment */}
        <Card className="bg-white/[0.02] border-slate-700/15" data-testid="assessment-section">
          <CardContent className="p-4">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
              AI Assessment
            </div>
            <p
              className="text-sm text-slate-300 leading-relaxed mb-3"
              data-testid="assessment-text"
            >
              {data.assessment}
            </p>
            <div className={`p-3 rounded-lg border text-xs ${riskBg(data.risk)}`}>
              <span className={`font-semibold ${riskColor(data.risk)}`}>Recommended Action:</span>
              <span className="text-slate-400 ml-1" data-testid="recommended-action">
                {data.recommendedAction}
              </span>
            </div>
            <div className="flex gap-4 mt-3 text-[11px] text-slate-500">
              <div>
                <span className="text-slate-600">Last Service:</span>{" "}
                {data.lastService || "No data"}
              </div>
              <div>
                <span className="text-slate-600">Next Due:</span> {data.nextDue || "Not scheduled"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Operational Context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3" data-testid="operational-context">
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

        {/* Section 5: Needs Action */}
        {data.needsAction.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1" data-testid="needs-action-strip">
            {data.needsAction.map((item) => (
              <Link key={item.id} href={item.link}>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border whitespace-nowrap text-xs cursor-pointer transition-colors ${item.urgency === "high" ? "bg-red-500/5 border-red-500/15 text-red-400 hover:bg-red-500/10" : item.urgency === "medium" ? "bg-yellow-500/5 border-yellow-500/15 text-yellow-400 hover:bg-yellow-500/10" : "bg-slate-500/5 border-slate-500/15 text-slate-400 hover:bg-slate-500/10"}`}
                  data-testid={`needs-action-${item.id}`}
                >
                  <SeverityDot severity={item.urgency} />
                  {item.title}
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Section 6: Evidence */}
        {data.signals.length > 0 && (
          <Card className="bg-white/[0.02] border-slate-700/15" data-testid="evidence-section">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-600 uppercase tracking-wider">
                Evidence & Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data.signals.map((sig, i) => (
                <div
                  key={i}
                  className="px-3 py-2 rounded-md bg-white/[0.015] border border-slate-700/8 text-xs text-slate-400 flex items-center gap-2"
                  data-testid={`signal-${i}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${data.risk === "critical" ? "bg-red-500" : data.risk === "warning" ? "bg-yellow-500" : "bg-green-500"}`}
                  />
                  {sig}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Section 7: Work Orders + Procurement */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          data-testid="work-procurement-section"
        >
          <Card className="bg-white/[0.02] border-slate-700/15">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Work Orders ({data.workOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.workOrders.length > 0 ? (
                <div className="space-y-1.5">
                  {data.workOrders.slice(0, 5).map((wo) => (
                    <div
                      key={wo.id}
                      className="flex justify-between items-center px-3 py-2 rounded-md bg-white/[0.015] border border-slate-700/8"
                      data-testid={`work-order-${wo.id}`}
                    >
                      <div>
                        <div className="text-xs font-medium text-slate-200">{wo.title}</div>
                        <div className="text-[10px] text-slate-500">{wo.createdAt}</div>
                      </div>
                      <StatusBadge status={wo.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600 py-3 text-center">No work orders</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/[0.02] border-slate-700/15">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" /> Service Orders ({data.serviceOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.serviceOrders.length > 0 ? (
                <div className="space-y-1.5">
                  {data.serviceOrders.slice(0, 5).map((so) => (
                    <div
                      key={so.id}
                      className="flex justify-between items-center px-3 py-2 rounded-md bg-white/[0.015] border border-slate-700/8"
                      data-testid={`service-order-${so.id}`}
                    >
                      <div>
                        <div className="text-xs font-medium text-slate-200">{so.title}</div>
                        <div className="text-[10px] text-slate-500">
                          {so.vendorName || "—"}
                          {so.eta ? ` · ETA: ${so.eta}` : ""}
                        </div>
                      </div>
                      <StatusBadge status={so.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600 py-3 text-center">No service orders</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section 8: Diagnostics */}
        <Card className="bg-white/[0.02] border-slate-700/15" data-testid="diagnostics-section">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Diagnostics
            </CardTitle>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-7"
                onClick={() => runDiagnostic("bearing")}
                disabled={isDiagnosticPending}
                data-testid="button-run-bearing"
              >
                <Play className="h-3 w-3 mr-1" /> Bearing Analysis
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-7"
                onClick={() => runDiagnostic("pump")}
                disabled={isDiagnosticPending}
                data-testid="button-run-pump"
              >
                <Play className="h-3 w-3 mr-1" /> Pump Analysis
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-7"
                onClick={() => runDiagnostic("general")}
                disabled={isDiagnosticPending}
                data-testid="button-run-general"
              >
                <Play className="h-3 w-3 mr-1" /> General
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isDiagnosticPending && (
              <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running analysis...
              </div>
            )}
            {data.diagnosticRuns.length > 0 ? (
              <div className="space-y-1.5">
                {data.diagnosticRuns.map((diag) => (
                  <div
                    key={diag.id}
                    className="px-3 py-2 rounded-md bg-white/[0.015] border border-slate-700/8"
                    data-testid={`diagnostic-run-${diag.id}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-slate-200 capitalize">
                        {diag.analysisType} Analysis
                      </span>
                      <span className="text-[10px] text-slate-500">{diag.createdAt}</span>
                    </div>
                    {diag.summary && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">{diag.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 py-3 text-center">
                No diagnostic history. Run an analysis above.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section 9: Activity Timeline */}
        <Card className="bg-white/[0.02] border-slate-700/15" data-testid="activity-timeline">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.activityTimeline.length > 0 ? (
              <div className="space-y-0">
                {data.activityTimeline.map((event, i) => (
                  <div
                    key={event.id}
                    className="flex gap-3 py-2"
                    data-testid={`timeline-event-${i}`}
                  >
                    <div className="flex flex-col items-center pt-0.5">
                      <SeverityDot severity={event.severity} />
                      {i < data.activityTimeline.length - 1 && (
                        <div className="w-px flex-1 bg-slate-700/30 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {event.title}
                        </span>
                        <span className="text-[10px] text-slate-600 shrink-0">
                          {new Date(event.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 py-3 text-center">No activity recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Section 10: Related Tools */}
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
    </IntelligenceLayout>
  );
}
