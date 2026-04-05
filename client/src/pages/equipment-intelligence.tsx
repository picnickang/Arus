import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, X, Send, AlertTriangle, CheckCircle, AlertCircle, Brain } from "lucide-react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface WorkOrderSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface EquipmentDetailData extends EquipmentRiskItem {
  workOrders: WorkOrderSummary[];
}

const AI_CHAT_SUGGESTIONS = [
  "What's the failure history for this equipment?",
  "When should I schedule the next overhaul?",
  "What spare parts do I need?",
  "Show me the vibration trend analysis",
];

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

function DetailDrawer({
  item,
  open,
  onClose,
}: {
  item: EquipmentRiskItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [activeSection, setActiveSection] = useState("overview");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiMessages, setAiMessages] = useState<{ role: string; content: string }[]>([]);
  const [, navigate] = useLocation();

  const detailQuery = useQuery<EquipmentDetailData>({
    queryKey: ["/api/equipment-intelligence/detail", item?.id],
    enabled: open && !!item?.id,
  });

  const aiMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest("POST", "/api/agent/chat", {
        message: `Regarding equipment "${item?.name}" on vessel "${item?.vessel}": ${question}`,
      });
      return response as { response?: string; reply?: string; message?: string };
    },
    onSuccess: (data) => {
      setAiMessages((prev) => [...prev, { role: "assistant", content: data?.response || data?.reply || data?.message || "No response" }]);
    },
    onError: () => {
      setAiMessages((prev) => [...prev, { role: "assistant", content: "Unable to process request. Please try again." }]);
    },
  });

  const handleAskAI = useCallback(
    (question: string) => {
      if (!question.trim()) return;
      setAiMessages((prev) => [...prev, { role: "user", content: question }]);
      setAiQuestion("");
      aiMutation.mutate(question);
    },
    [aiMutation]
  );

  if (!open || !item) return null;

  const detail = detailQuery.data;
  const health = detail?.health ?? item.health;
  const rul = detail?.rul ?? item.rul;
  const risk = detail?.risk ?? item.risk;
  const confidence = detail?.confidence ?? item.confidence;
  const prediction = detail?.prediction ?? item.prediction;
  const trend = detail?.trend ?? item.trend;
  const telemetry = detail?.telemetry ?? item.telemetry;
  const signals = detail?.signals ?? item.signals;
  const workOrders = detail?.workOrders || [];
  const lastService = detail?.lastService || item.lastService;
  const nextDue = detail?.nextDue || item.nextDue;
  const dataAvailability = detail?.dataAvailability ?? item.dataAvailability;

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "telemetry", label: "Telemetry" },
    { id: "prediction", label: "AI Prediction" },
    { id: "history", label: "Work History" },
    { id: "ask", label: "Ask AI" },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        data-testid="drawer-backdrop"
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-[51] w-full sm:w-[520px] bg-[#0b1222] border-l border-slate-700/10 flex flex-col animate-in slide-in-from-right duration-250"
        data-testid="detail-drawer"
      >
        <div className="px-5 py-3.5 border-b border-slate-700/10 flex justify-between items-start shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold text-slate-100" data-testid="drawer-equipment-name">
                {item.name}
              </span>
              <Badge variant={riskBadgeVariant(item.risk)} className="text-[10px] uppercase" data-testid="drawer-risk-badge">
                {item.risk}
              </Badge>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {item.vessel} · {item.type}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-500 -mt-0.5" data-testid="drawer-close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-5 py-2 border-b border-slate-700/5 flex gap-1 overflow-x-auto shrink-0">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              data-testid={`tab-${s.id}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                activeSection === s.id
                  ? "bg-sky-400/12 text-sky-400 border-sky-400/20"
                  : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeSection === "overview" && (
            <div>
              {dataAvailability === "unavailable" && (
                <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15 text-xs text-yellow-400 mb-4" data-testid="data-unavailable-warning">
                  Health and prediction data is currently unavailable. Displaying baseline estimates.
                </div>
              )}
              <div className="flex gap-5 items-center mb-6">
                <HealthRing value={health} size={72} stroke={6} />
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-slate-700/10">
                    <div className="text-[9px] text-slate-600 uppercase tracking-wider">RUL</div>
                    <div className={`text-xl font-extrabold ${riskColor(risk)}`}>
                      {rul}
                      <span className="text-xs font-normal text-slate-500"> days</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-slate-700/10">
                    <div className="text-[9px] text-slate-600 uppercase tracking-wider">Confidence</div>
                    <div className="text-xl font-extrabold text-slate-200">
                      {confidence}
                      <span className="text-xs font-normal text-slate-500">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border mb-4 ${riskBg(risk)}`}>
                <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${riskColor(risk)}`}>
                  AI Assessment
                </div>
                <div className="text-[13px] text-slate-200 leading-relaxed" data-testid="ai-assessment">
                  {prediction}
                </div>
              </div>

              {signals.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Contributing Signals
                  </div>
                  {signals.map((sig, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 rounded-md bg-white/[0.015] border border-slate-700/8 mb-1 text-xs text-slate-400 flex items-center gap-2"
                      data-testid={`signal-${i}`}
                    >
                      <span className={`w-1 h-1 rounded-full shrink-0 ${risk === "critical" ? "bg-red-500" : risk === "warning" ? "bg-yellow-500" : "bg-green-500"}`} />
                      {sig}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs bg-sky-400/10 border-sky-400/20 text-sky-400 hover:bg-sky-400/20"
                  data-testid="button-create-work-order"
                  onClick={() => {
                    navigate(`/work-orders?action=create&equipmentId=${item.id}`);
                  }}
                >
                  Create Work Order
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  data-testid="button-view-history"
                  onClick={() => setActiveSection("history")}
                >
                  View History
                </Button>
              </div>
            </div>
          )}

          {activeSection === "telemetry" && (
            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Health Trend — Last {telemetry.length} Readings
              </div>
              <div className="p-4 rounded-xl bg-white/[0.015] border border-slate-700/10 mb-4">
                <MiniSparkline data={telemetry} color={riskStroke(risk)} w={420} h={80} />
                <div className="flex justify-between mt-2 text-[10px] text-slate-600">
                  <span>{telemetry.length} readings ago</span>
                  <span>Latest: {health}%</span>
                </div>
              </div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Trend Direction
              </div>
              <div
                className={`p-3 rounded-lg text-[13px] font-semibold border ${
                  trend === "declining"
                    ? "bg-red-500/5 border-red-500/12 text-red-500"
                    : "bg-green-500/5 border-green-500/12 text-green-500"
                }`}
              >
                {trend === "declining" ? "↘ Declining" : trend === "improving" ? "↗ Improving" : "→ Stable"}
                <span className="font-normal text-slate-400 ml-2">
                  {trend === "declining"
                    ? `Lost ${(telemetry[0] || 0) - health}% over period`
                    : "No significant change"}
                </span>
              </div>
            </div>
          )}

          {activeSection === "prediction" && (
            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Failure Prediction Detail
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.015] border border-slate-700/10 mb-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase">Remaining Life</div>
                    <div className={`text-[22px] font-extrabold ${riskColor(risk)}`}>{rul}d</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase">Model Confidence</div>
                    <div className="text-[22px] font-extrabold text-slate-200">{confidence}%</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase">Next Service</div>
                    <div className="text-[13px] font-semibold text-slate-200 mt-1">{nextDue || "Not scheduled"}</div>
                  </div>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border mb-4 ${riskBg(risk)}`}>
                <div className="text-[13px] text-slate-200 leading-relaxed">{prediction}</div>
              </div>

              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Recommended Action
              </div>
              <div className="p-3 rounded-lg bg-sky-400/5 border border-sky-400/10 text-xs text-slate-400 leading-relaxed">
                {risk === "critical"
                  ? `Schedule immediate repair. Estimated window: ${rul} days. Create a work order and ensure spare parts are available.`
                  : risk === "warning"
                    ? "Monitor closely. Plan maintenance for next scheduled port call. Check parts availability."
                    : "No action required. Continue normal operating schedule."}
              </div>
            </div>
          )}

          {activeSection === "history" && (
            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Maintenance History
              </div>
              <div className="p-3 rounded-lg bg-white/[0.015] border border-slate-700/10 mb-2">
                <div className="text-xs font-semibold text-slate-200">Last Service</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{lastService || "No data available"}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.015] border border-slate-700/10 mb-4">
                <div className="text-xs font-semibold text-slate-200">Next Scheduled</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{nextDue || "Not scheduled"}</div>
              </div>

              {detailQuery.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                </div>
              )}

              {workOrders.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Work Orders
                  </div>
                  {workOrders.map((wo) => (
                    <div
                      key={wo.id}
                      className="p-3 rounded-lg bg-white/[0.015] border border-slate-700/10 mb-1 flex justify-between items-center"
                      data-testid={`work-order-${wo.id}`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{wo.title}</div>
                        <div className="text-[10px] text-slate-500">{wo.createdAt}</div>
                      </div>
                      <Badge variant={wo.status === "completed" ? "secondary" : "outline"} className="text-[10px]">
                        {wo.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {workOrders.length === 0 && !detailQuery.isLoading && (
                <div className="text-center py-5 text-slate-600 text-xs">
                  No work order history available.
                </div>
              )}
            </div>
          )}

          {activeSection === "ask" && (
            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Ask AI About {item.name}
              </div>
              <div className="mb-4">
                {AI_CHAT_SUGGESTIONS.map((q, i) => (
                  <button
                    key={i}
                    data-testid={`ai-suggestion-${i}`}
                    onClick={() => handleAskAI(q)}
                    className="block w-full text-left px-3.5 py-2.5 rounded-lg bg-white/[0.015] border border-slate-700/10 text-slate-400 text-xs cursor-pointer mb-1 leading-relaxed hover:bg-sky-400/5 hover:border-sky-400/12 transition-colors"
                  >
                    <span className="text-sky-400 mr-1.5">→</span> {q}
                  </button>
                ))}
              </div>

              {aiMessages.length > 0 && (
                <div className="mb-4 space-y-2 max-h-60 overflow-y-auto">
                  {aiMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-sky-400/10 text-sky-300 ml-8"
                          : "bg-white/[0.02] text-slate-300 mr-8"
                      }`}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {aiMutation.isPending && (
                    <div className="flex items-center gap-2 p-3 text-xs text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                    </div>
                  )}
                </div>
              )}

              <div className="relative">
                <Input
                  placeholder={`Ask about ${item.name}...`}
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskAI(aiQuestion)}
                  className="pr-10 bg-white/[0.03] border-slate-700/15 text-slate-200 text-[13px]"
                  data-testid="ai-chat-input"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-sky-400"
                  onClick={() => handleAskAI(aiQuestion)}
                  disabled={aiMutation.isPending}
                  data-testid="ai-chat-send"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function EquipmentIntelligence() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const selected = useMemo(() => equipment.find((e) => e.id === selectedId) || null, [selectedId, equipment]);

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
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-state">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
          <p className="text-sm text-slate-500">Loading Equipment Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080e1a] text-slate-200" data-testid="equipment-intelligence-page">
      <PageTitle title="Equipment Intelligence | ARUS" />

      <DetailDrawer item={selected} open={!!selectedId} onClose={() => setSelectedId(null)} />

      <div className="px-6 py-4 border-b border-slate-700/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-100" data-testid="page-title">Equipment Intelligence</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            AI health monitoring, predictions, and recommendations — all in one view
          </p>
        </div>
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
            onClick={() => setSelectedId(item.id)}
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
  );
}
