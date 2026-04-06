# ARUS Analytics Dashboard — Files for Claude Evaluation

Analytics hub page with lazy-loaded mode panels: Mission Overview, Operations, Maintenance, Finance, Data Integrity. Plus shared components: ScenarioBanner, ContextHelp, NarrativeSummaryCard, PowerSTWChart. Total ~1,150 lines across 10 files.

---

## File 1: `client/src/pages/analytics-hub.tsx`

Lightweight hub using `IconGridLayout` with lazy-loaded panels. Includes Equipment Intelligence, Knowledge Base, KB Assistant, and Optimizer as additional grid items.

```tsx
import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Compass, Activity, Wrench, DollarSign, Shield, Brain, BookOpen, Bot, Zap } from "lucide-react";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

const analyticsItems: GridItem[] = [
  {
    id: "overview",
    label: "Mission Overview",
    icon: Compass,
    description: "Critical alerts",
    load: () => import("@/components/analytics/MissionOverview").then((m) => ({ default: m.MissionOverview })),
    loaderVariant: "cards",
  },
  {
    id: "operations",
    label: "Operations",
    icon: Activity,
    description: "Ops analytics",
    load: () => import("@/components/analytics/OperationsMode").then((m) => ({ default: m.OperationsMode })),
    loaderVariant: "cards",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    description: "Maint insights",
    load: () => import("@/components/analytics/MaintenanceMode").then((m) => ({ default: m.MaintenanceMode })),
    loaderVariant: "cards",
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    description: "Cost analysis",
    load: () => import("@/components/analytics/FinanceMode").then((m) => ({ default: m.FinanceMode })),
    loaderVariant: "cards",
  },
  {
    id: "data-integrity",
    label: "Data Integrity",
    icon: Shield,
    description: "Data quality",
    load: () => import("@/components/analytics/DataIntegrityDashboard").then((m) => ({ default: m.DataIntegrityDashboard })),
    loaderVariant: "cards",
  },
  {
    id: "equipment-intelligence",
    label: "Equipment Intelligence",
    icon: Brain,
    description: "AI health, predictions & recommendations",
    load: () => import("@/pages/equipment-intelligence"),
    loaderVariant: "cards",
    legacyRoutes: ["/equipment-intelligence"],
  },
  {
    id: "knowledge-base",
    label: "Knowledge Base",
    icon: BookOpen,
    description: "Docs & RAG",
    load: () => import("@/pages/knowledge-base"),
    loaderVariant: "cards",
    legacyRoutes: ["/knowledge-base"],
  },
  {
    id: "kb-chat",
    label: "KB Assistant",
    icon: Bot,
    description: "AI-powered knowledge assistant",
    load: () => import("@/pages/kb-chat"),
    loaderVariant: "cards",
    legacyRoutes: ["/kb-chat"],
  },
  {
    id: "optimizer",
    label: "Optimizer",
    icon: Zap,
    description: "Maintenance optimization tools",
    load: () => import("@/pages/optimization-tools"),
    loaderVariant: "cards",
    legacyRoutes: ["/optimization-tools"],
  },
];

export default function AnalyticsHub() {
  return (
    <PermissionGate resource="analytics_dashboard" action="view" fallback={<PagePermissionDenied />}>
      <IconGridLayout
        title="Analytics & Intelligence"
        description="Contextual insights for marine operations"
        items={analyticsItems}
        defaultItemId="overview"
        baseRoute="/analytics"
      />
    </PermissionGate>
  );
}
```

---

## File 2: `client/src/components/analytics/MissionOverview.tsx`

Auto-prioritized critical alerts dashboard with anomaly intelligence, prediction confidence, cost spike detection, health degradation alerts, and priority alert list sorted by severity × freshness × financial impact.

```tsx
import { AlertTriangle, TrendingUp, DollarSign, Wrench, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { PriorityAlert } from "@/lib/analytics-priority";
import { ScenarioBanner } from "./ScenarioBanner";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { formatDate, formatNumber } from "@/lib/formatters";
import { EquipmentHealthChart } from "@/components/charts/EquipmentHealthChart";
import { useMissionOverviewData } from "@/features/analytics";

export function MissionOverview() {
  const { equipmentHealth, equipmentHealthLoading, equipmentHealthError, topAlerts, anomalySeverityCounts, avgConfidence, highConfidencePredictions, lowConfidencePredictions, costSpike, hasCostSpike, degradingEquipment, criticalHealth, criticalCount, warningCount, totalFinancialImpact, getSeverityColor, exportPDFSections, exportAlertsData } = useMissionOverviewData();

  const getTypeIcon = (type: string) => { switch (type) { case "equipment": return Activity; case "anomaly": return TrendingUp; case "cost": return DollarSign; case "maintenance": return Wrench; default: return AlertTriangle; } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Mission Control</h2><p className="text-sm text-muted-foreground mt-1">Auto-prioritized critical alerts and analytics</p></div>
        <ExportButton data={exportAlertsData} filename="mission-overview" formats={["csv", "pdf"]} pdfSections={exportPDFSections} csvOptions={{ columns: ["severity", "type", "message", "financialImpact", "timestamp"], headers: { severity: "Severity", type: "Type", message: "Message", financialImpact: "Financial Impact", timestamp: "Timestamp" } }} pdfOptions={{ title: "Mission Overview Report", subtitle: `Generated on ${formatDate(new Date())}` }} variant="outline" size="default" data-testid="button-export-mission" />
      </div>

      <ScenarioBanner type="guidance" title="Mission Control - Priority Dashboard" description="This view shows auto-prioritized alerts based on severity, freshness, and financial impact. Focus on critical items first, then work your way down the list." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="card-critical-alerts"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Critical Alerts</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-destructive" data-testid="text-critical-count">{criticalCount}</div><p className="text-xs text-muted-foreground mt-1">Require immediate attention</p></CardContent></Card>
        <Card data-testid="card-warnings"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-amber-600" data-testid="text-warning-count">{warningCount}</div><p className="text-xs text-muted-foreground mt-1">Need attention soon</p></CardContent></Card>
        <Card data-testid="card-financial-impact"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Potential Impact</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold" data-testid="text-financial-impact">${(totalFinancialImpact / 1000).toFixed(0)}k</div><p className="text-xs text-muted-foreground mt-1">Estimated cost at risk</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-anomaly-intelligence"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Anomaly Intelligence (24h)</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="anomaly-critical"><span className="text-sm text-muted-foreground">Critical</span><Badge variant="destructive" className="min-w-[3rem] justify-center" data-testid="badge-anomaly-critical">{anomalySeverityCounts.critical}</Badge></div><div className="flex justify-between items-center" data-testid="anomaly-high"><span className="text-sm text-muted-foreground">High</span><Badge variant="default" className="min-w-[3rem] justify-center" data-testid="badge-anomaly-high">{anomalySeverityCounts.high}</Badge></div><div className="flex justify-between items-center" data-testid="anomaly-medium-low"><span className="text-sm text-muted-foreground">Medium/Low</span><Badge variant="secondary" className="min-w-[3rem] justify-center" data-testid="badge-anomaly-medium-low">{anomalySeverityCounts.medium + anomalySeverityCounts.low}</Badge></div></div></CardContent>
        </Card>
        <Card data-testid="card-prediction-confidence"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Prediction Confidence</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="metric-model-accuracy"><span className="text-sm text-muted-foreground">Model Accuracy</span><span className="text-lg font-bold" data-testid="text-model-accuracy">{(avgConfidence * 100).toFixed(1)}%</span></div><div className="flex justify-between items-center" data-testid="metric-high-confidence"><span className="text-sm text-muted-foreground">High Confidence</span><Badge variant="default" className="min-w-[3rem] justify-center" data-testid="badge-high-confidence">{highConfidencePredictions}</Badge></div>{lowConfidencePredictions > 0 && <div className="flex justify-between items-center" data-testid="metric-low-confidence"><span className="text-sm text-amber-600">Low Confidence</span><Badge variant="outline" className="min-w-[3rem] justify-center border-amber-600 text-amber-600" data-testid="badge-low-confidence">{lowConfidencePredictions}</Badge></div>}</div></CardContent>
        </Card>
        {hasCostSpike && <Card className="border-amber-500" data-testid="card-cost-spike"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-amber-600"><DollarSign className="h-4 w-4" />Cost Spike Detected</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="metric-cost-spike"><span className="text-sm text-muted-foreground">Recent Increase</span><span className="text-lg font-bold text-amber-600" data-testid="text-cost-spike">+{costSpike.toFixed(1)}%</span></div><p className="text-xs text-muted-foreground" data-testid="text-cost-spike-description">Recent costs are {costSpike.toFixed(0)}% higher than historical average</p><Link href="/analytics?tab=finance"><Button size="sm" variant="outline" className="w-full mt-2" data-testid="button-analyze-trends">Analyze Trends →</Button></Link></div></CardContent></Card>}
        {degradingEquipment.length > 0 && <Card className="border-destructive" data-testid="card-health-degradation"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><Wrench className="h-4 w-4" />Health Degradation Alert</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="metric-degrading-units"><span className="text-sm text-muted-foreground">Degrading Units</span><span className="text-lg font-bold text-destructive" data-testid="text-degrading-count">{degradingEquipment.length}</span></div><div className="flex justify-between items-center" data-testid="metric-critical-health"><span className="text-sm text-muted-foreground">Critical Health</span><Badge variant="destructive" className="min-w-[3rem] justify-center" data-testid="badge-critical-health">{criticalHealth}</Badge></div><Link href="/fleet?tab=equipment"><Button size="sm" variant="outline" className="w-full mt-2" data-testid="button-view-equipment">View Equipment →</Button></Link></div></CardContent></Card>}
      </div>

      <EquipmentHealthChart equipment={equipmentHealth} isLoading={equipmentHealthLoading} error={equipmentHealthError instanceof Error ? equipmentHealthError.message : null} data-testid="chart-fleet-health" />

      <Card data-testid="card-priority-alerts"><CardHeader><CardTitle>Priority Alerts</CardTitle><p className="text-sm text-muted-foreground">Sorted by priority score (severity × freshness × financial impact)</p></CardHeader>
        <CardContent>
          {topAlerts.length === 0 ? <div className="text-center py-12 text-muted-foreground" data-testid="no-alerts-message"><Activity className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-lg font-medium">All Systems Nominal</p><p className="text-sm mt-1">No critical alerts or warnings at this time</p></div> : (
            <div className="space-y-3" data-testid="list-priority-alerts">
              {topAlerts.map((alert: PriorityAlert) => { const Icon = getTypeIcon(alert.type); return (
                <div key={alert.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors" data-testid={`item-alert-${alert.id}`}>
                  <div className={`p-2 rounded-full ${alert.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`} data-testid={`icon-alert-${alert.id}`}><Icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><h4 className="font-semibold text-sm" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</h4><Badge variant={getSeverityColor(alert.severity)} className="text-xs" data-testid={`badge-alert-severity-${alert.id}`}>{alert.severity}</Badge><Badge variant="outline" className="text-xs" data-testid={`badge-alert-score-${alert.id}`}>Score: {alert.priorityScore}</Badge></div><p className="text-sm text-muted-foreground" data-testid={`text-alert-description-${alert.id}`}>{alert.description}</p><div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground"><span data-testid={`text-alert-time-${alert.id}`}>{alert.timestamp && !Number.isNaN(new Date(alert.timestamp).getTime()) ? formatDistanceToNow(alert.timestamp, { addSuffix: true }) : "Recently"}</span>{alert.financialImpact && <span className="text-destructive font-medium" data-testid={`text-alert-impact-${alert.id}`}>~${formatNumber(alert.financialImpact)} at risk</span>}</div></div>
                  {alert.actionUrl && <Link href={alert.actionUrl}><Button size="sm" variant="ghost" data-testid={`button-alert-action-${alert.id}`}>View →</Button></Link>}
                </div>
              ); })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## File 3: `client/src/components/analytics/OperationsMode.tsx`

Real-time monitoring: live WebSocket connection status, AI prediction status, telemetry drift detection, equipment health cards (critical/warning/healthy), failure predictions, anomaly management (acknowledge/watch), equipment health trend charts, and active telemetry streams with sensor sparklines.

```tsx
import { useState, useCallback } from "react";
import { Wifi, WifiOff, AlertTriangle, Check, Eye, TrendingUp, Brain, LineChart as LineChartIcon, RefreshCw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { ContextHelp } from "./ContextHelp";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { useOperationsModeData } from "@/features/analytics";
import { useTelemetryStreams, SensorSparklineChart } from "@/features/telemetry";
import { useQuery } from "@tanstack/react-query";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { DataFreshnessBadge } from "@/components/ui/data-freshness-badge";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { getAckStatusLabel, getAckStatusVariant } from "@/lib/severity";

export function OperationsMode() {
  const [, navigate] = useLocation();
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");

  const { isConnected, latestTelemetry, failurePredictions, criticalEquipment, warningEquipment, healthyEquipment, driftingSensors, highConfidencePredictions, avgPredictionConfidence, equipmentHealthTrends, unacknowledgedAnomalies, watchingAnomalies, acknowledgedCount, handleAcknowledge, handleWatch, getAnomalyAckStatus, getAnomalyId, getDriftThreshold } = useOperationsModeData();

  const { data: vessels = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
  });

  const { data: equipment = [] } = useQuery<Array<{ id: string; name: string; vesselId: string }>>({
    queryKey: ["/api/equipment"],
  });

  const filteredEquipment = selectedVessel === "all" 
    ? equipment 
    : equipment.filter((e) => e.vesselId === selectedVessel);

  const [telemetrySectionRef, isTelemetrySectionVisible] = useIntersectionObserver<HTMLDivElement>({
    rootMargin: "100px",
    triggerOnce: true,
  });

  const { streams, isLoading: streamsLoading, refetch: refetchStreams } = useTelemetryStreams({
    vesselId: selectedVessel === "all" ? undefined : selectedVessel,
    equipmentId: selectedEquipment === "all" ? undefined : selectedEquipment,
    hours: 1,
    refreshInterval: 30000,
    enabled: isTelemetrySectionVisible,
  });

  const handleViewDetails = useCallback((equipmentId: string, sensorType: string) => {
    navigate(`/dashboard?tab=telemetry&equipment=${equipmentId}&sensor=${sensorType}`);
  }, [navigate]);

  return (
    <div className="space-y-6">
      <ScenarioBanner type="info" title="Operations Mode - Real-Time Monitoring" description="Monitor live equipment health, telemetry streams, and operational anomalies. Use this view for day-to-day fleet oversight and rapid response to issues." />

      <Card data-testid="card-connection-status"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Live Connection Status</CardTitle><div className="flex items-center gap-2" data-testid="connection-indicator">{isConnected ? <><Wifi className="h-4 w-4 text-green-500" data-testid="icon-connected" /><span className="text-sm text-green-500" data-testid="status-connection">Connected</span></> : <><WifiOff className="h-4 w-4 text-red-500" data-testid="icon-disconnected" /><span className="text-sm text-red-500" data-testid="status-connection">Disconnected</span></>}</div></div></CardHeader><CardContent>{latestTelemetry && <div className="text-sm" data-testid="latest-telemetry"><p className="text-muted-foreground" data-testid="text-latest-reading">Latest: {latestTelemetry.sensorType} = {latestTelemetry.value}{latestTelemetry.unit} ({formatDistanceToNow(new Date(latestTelemetry.timestamp), { addSuffix: true })})</p></div>}</CardContent></Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-prediction-status">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4" />AI Prediction Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center" data-testid="metric-avg-confidence">
                <span className="text-sm text-muted-foreground">Avg Confidence</span>
                <ConfidenceBadge confidence={avgPredictionConfidence} />
              </div>
              <div className="flex justify-between items-center" data-testid="metric-high-confidence">
                <span className="text-sm text-muted-foreground">High Confidence</span>
                <Badge variant="default" className="min-w-[3rem] justify-center" data-testid="badge-high-confidence">{highConfidencePredictions.length}</Badge>
              </div>
              <div className="flex justify-between items-center" data-testid="metric-active-predictions">
                <span className="text-sm text-muted-foreground">Active Predictions</span>
                <Badge variant="outline" className="min-w-[3rem] justify-center" data-testid="badge-active-predictions">{failurePredictions.length}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        {driftingSensors.length > 0 && <Card className="border-amber-500" data-testid="card-telemetry-drift"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-amber-600"><TrendingUp className="h-4 w-4" />Telemetry Drift Detected</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="metric-drifting-sensors"><span className="text-sm text-muted-foreground">Drifting Sensors</span><span className="text-lg font-bold text-amber-600" data-testid="text-drifting-sensors">{driftingSensors.length}</span></div><p className="text-xs text-muted-foreground" data-testid="text-drift-description">Sensor values deviating beyond per-sensor thresholds from baseline</p><div className="mt-2 space-y-1" data-testid="list-drifting-sensors">{driftingSensors.slice(0, 3).map((sensor, idx) => <div key={`drift-${sensor.equipmentId}-${sensor.sensorType}`} className="text-xs flex items-center justify-between" data-testid={`item-drift-${idx}`}><span><span className="font-medium" data-testid={`text-drift-sensor-${idx}`}>{sensor.sensorType}</span><span className="text-muted-foreground"> on {sensor.equipmentId}</span></span><span className="text-muted-foreground ml-2">threshold: {getDriftThreshold(sensor.sensorType)}%</span></div>)}</div></div></CardContent></Card>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-500/50" data-testid="card-critical-equipment"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Critical</CardTitle><ContextHelp title="Critical Equipment" description="Equipment with health index below 30%. Requires immediate attention to prevent failures." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-destructive" data-testid="text-critical-count">{criticalEquipment.length}</div></CardContent></Card>
        <Card className="border-amber-500/50" data-testid="card-warning-equipment"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Warning</CardTitle><ContextHelp title="Warning Equipment" description="Equipment with health index 30-49%. Schedule maintenance soon to prevent degradation." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-amber-600" data-testid="text-warning-count">{warningEquipment.length}</div></CardContent></Card>
        <Card className="border-green-500/50" data-testid="card-healthy-equipment"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Healthy</CardTitle><ContextHelp title="Healthy Equipment" description="Equipment with health index 75%+. Operating within normal parameters." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-green-600" data-testid="text-healthy-count">{healthyEquipment.length}</div></CardContent></Card>
      </div>

      {criticalEquipment.length > 0 && <Card className="border-destructive" data-testid="card-critical-list"><CardHeader><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><CardTitle>Critical Equipment Requiring Attention</CardTitle></div></CardHeader><CardContent><div className="space-y-2" data-testid="list-critical-equipment">{criticalEquipment.map((eq) => <div key={eq.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`item-critical-equipment-${eq.id}`}><div><p className="font-medium" data-testid={`text-equipment-name-${eq.id}`}>{eq.name || eq.id}</p><p className="text-sm text-muted-foreground" data-testid={`text-equipment-metrics-${eq.id}`}>Health: {eq.healthIndex}% | Failure Risk: {eq.failureRisk}%</p></div><Badge variant="destructive" data-testid={`badge-critical-${eq.id}`}>CRITICAL</Badge></div>)}</div></CardContent></Card>}

      {failurePredictions.length > 0 && (
        <CollapsibleSection title="Active Failure Predictions" badge={`${failurePredictions.length} active`} summary={`${highConfidencePredictions.length} high-confidence predictions`}>
          <div className="space-y-2" data-testid="list-predictions">
            {failurePredictions.slice(0, 8).map((pred, idx) => (
              <div key={pred.id || `pred-${idx}`} className="flex items-center justify-between gap-3 p-3 border rounded-lg" data-testid={`item-prediction-${idx}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm" data-testid={`text-prediction-equipment-${idx}`}>{pred.equipmentName || pred.equipmentId || "Unknown"}</p>
                    <ConfidenceBadge confidence={pred.confidence || 0} />
                    <DataFreshnessBadge lastUpdated={pred.timestamp} />
                  </div>
                  {pred.failureType && <p className="text-xs text-muted-foreground mt-1">{pred.failureType}</p>}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Recent Anomalies" badge={unacknowledgedAnomalies.length > 0 ? `${unacknowledgedAnomalies.length} new` : undefined} summary={unacknowledgedAnomalies.length > 0 ? `${unacknowledgedAnomalies.length} new, ${watchingAnomalies.length} watching` : `No new anomalies. ${acknowledgedCount > 0 ? `${acknowledgedCount} acknowledged this session.` : ""}`}>
        {unacknowledgedAnomalies.length === 0 && watchingAnomalies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No anomalies requiring attention. {acknowledgedCount > 0 && `${acknowledgedCount} acknowledged this session.`}</p>
        ) : (
          <div className="space-y-2">
            {[...unacknowledgedAnomalies.slice(0, 8), ...watchingAnomalies.slice(0, 4)].map((anomaly, idx) => {
              const anomalyId = getAnomalyId(anomaly);
              const status = getAnomalyAckStatus(anomalyId);
              return (
                <div key={anomalyId} className="flex items-center justify-between gap-3 p-3 border rounded-lg" data-testid={`item-anomaly-${idx}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" data-testid={`text-anomaly-equipment-${idx}`}>{anomaly.equipmentName || anomaly.equipmentId}</p>
                      <Badge variant={getAckStatusVariant(status)} className="text-xs" data-testid={`badge-anomaly-status-${idx}`}>{getAckStatusLabel(status)}</Badge>
                      <DataFreshnessBadge lastUpdated={anomaly.timestamp} />
                    </div>
                    <p className="text-xs text-muted-foreground" data-testid={`text-anomaly-details-${idx}`}>{anomaly.sensorType}: {anomaly.value}{anomaly.unit} ({anomaly.zscore?.toFixed(1)}σ deviation)</p>
                    <Badge variant="outline" className="mt-1 text-xs" data-testid={`badge-anomaly-time-${idx}`}>{formatDistanceToNow(new Date(anomaly.timestamp), { addSuffix: true })}</Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/dashboard?tab=telemetry&equipment=${anomaly.equipmentId}&sensor=${anomaly.sensorType}`}>
                      <Button size="sm" variant="outline" data-testid={`button-view-graph-${idx}`}><LineChartIcon className="h-3 w-3 mr-1" />Graph</Button>
                    </Link>
                    {status === "unacknowledged" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleWatch(anomalyId)} data-testid={`button-watch-anomaly-${idx}`}><Eye className="h-3 w-3 mr-1" />Watch</Button>
                        <Button size="sm" variant="outline" onClick={() => handleAcknowledge(anomalyId)} data-testid={`button-acknowledge-anomaly-${idx}`}><Check className="h-3 w-3 mr-1" />Ack</Button>
                      </>
                    )}
                    {status === "watching" && (
                      <Button size="sm" variant="outline" onClick={() => handleAcknowledge(anomalyId)} data-testid={`button-acknowledge-anomaly-${idx}`}><Check className="h-3 w-3 mr-1" />Ack</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {equipmentHealthTrends.length > 0 && <CollapsibleSection title="Equipment Health Trends" summary={`Showing trends for ${equipmentHealthTrends.slice(0, 3).length} equipment units`}><div className="space-y-6">{equipmentHealthTrends.slice(0, 3).map((eq) => <div key={eq.equipmentId} className="space-y-2" data-testid={`item-health-trend-${eq.equipmentId}`}><div className="flex items-center justify-between"><h4 className="text-sm font-medium" data-testid={`text-trend-name-${eq.equipmentId}`}>{eq.name}</h4><Badge variant={eq.currentHealth < 50 ? "destructive" : "default"} data-testid={`badge-trend-health-${eq.equipmentId}`}>{eq.currentHealth}% Health</Badge></div><div className="h-48" data-testid={`chart-health-trend-${eq.equipmentId}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={eq.trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="timestamp" tick={{ fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="health" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></div>)}</div></CollapsibleSection>}

      <div ref={telemetrySectionRef}>
        <CollapsibleSection title="Active Telemetry Streams" summary={`${streams.length} sensors reporting`}>
          <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedVessel} onValueChange={(v) => { setSelectedVessel(v); setSelectedEquipment("all"); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-vessel">
                <SelectValue placeholder="All Vessels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
              <SelectTrigger className="w-[180px]" data-testid="select-equipment">
                <SelectValue placeholder="All Equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Equipment</SelectItem>
                {filteredEquipment.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => refetchStreams()} data-testid="button-refresh-streams">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            {streams.filter((s) => s.hasAnomaly).length > 0 && (
              <Badge variant="destructive" data-testid="badge-anomaly-count">
                {streams.filter((s) => s.hasAnomaly).length} anomalies
              </Badge>
            )}
          </div>
          {streamsLoading ? (
            <div className="text-sm text-muted-foreground">Loading telemetry streams...</div>
          ) : streams.length === 0 ? (
            <div className="text-sm text-muted-foreground">No telemetry streams available. Check sensor configuration.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {streams.slice(0, 12).map((stream) => (
                <SensorSparklineChart
                  key={`${stream.equipmentId}-${stream.sensorType}`}
                  sensorType={stream.sensorType}
                  equipmentId={stream.equipmentId}
                  currentValue={stream.currentValue}
                  unit={stream.unit}
                  status={stream.status}
                  hasAnomaly={stream.hasAnomaly}
                  anomalyZScore={stream.anomalyZScore}
                  anomalyTimestamp={stream.anomalyTimestamp}
                  data={stream.data}
                  lastUpdate={stream.lastUpdate}
                  onViewDetails={() => handleViewDetails(stream.equipmentId, stream.sensorType)}
                />
              ))}
            </div>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
```

---

## File 4: `client/src/components/analytics/MaintenanceMode.tsx`

Predictive & preventive maintenance analytics: open/overdue work orders, high-risk equipment, completion analytics, prevention effectiveness, cost optimization opportunities, scheduling recommendations, PdM scores, failure pattern bar chart, and recent maintenance activity.

```tsx
import { TrendingUp, Clock, Target, DollarSign, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "./CollapsibleSection";
import { ContextHelp } from "./ContextHelp";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { useMaintenanceModeData } from "@/features/analytics";
import { formatNumber } from "@/lib/formatters";

export function MaintenanceMode() {
  const { maintenanceRecords, openOrders, overdueOrders, highRiskEquipment, avgCompletionTimeHours, completionRate, completedOrders, preventiveSavings, totalFailures, totalPrevented, preventionRate, failureChartData, schedulingSuggestions, overdueWorkOrders, highRiskPdmScores, highReactiveCostEquipment } = useMaintenanceModeData();

  return (
    <div className="space-y-6">
      <ScenarioBanner type="info" title="Maintenance Mode - Predictive & Preventive" description="Track work orders, monitor predictive maintenance scores, analyze failure patterns, and optimize maintenance schedules. Use this view to plan and execute maintenance strategies." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="card-open-orders"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Open Work Orders</CardTitle><ContextHelp title="Open Work Orders" description="Work orders that are currently in progress or pending. Track these to ensure timely completion." /></div></CardHeader><CardContent><div className="text-3xl font-bold" data-testid="text-open-orders">{openOrders}</div>{overdueOrders > 0 && <Badge variant="destructive" className="mt-2" data-testid="badge-overdue-orders">{overdueOrders} overdue</Badge>}</CardContent></Card>
        <Card data-testid="card-high-risk"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">High Risk Equipment</CardTitle><ContextHelp title="High Risk Equipment" description="Equipment with failure risk above 70%. Priority candidates for predictive maintenance interventions." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-amber-600" data-testid="text-high-risk">{highRiskEquipment}</div></CardContent></Card>
        <Card data-testid="card-maintenance-records"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Maintenance Records</CardTitle><ContextHelp title="Maintenance Records" description="Historical maintenance activities tracked in the system. Used for trend analysis and compliance reporting." /></div></CardHeader><CardContent><div className="text-3xl font-bold" data-testid="text-records-count">{maintenanceRecords.length}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-completion-analytics"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />Completion Analytics</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Completion Rate</span><span className="text-lg font-bold" data-testid="text-completion-rate">{completionRate.toFixed(0)}%</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Avg Time to Complete</span><span className="text-sm font-medium" data-testid="text-avg-completion-time">{avgCompletionTimeHours > 24 ? `${(avgCompletionTimeHours / 24).toFixed(1)} days` : `${avgCompletionTimeHours.toFixed(0)} hours`}</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Completed Orders</span><Badge variant="default" className="min-w-[3rem] justify-center" data-testid="badge-completed-orders">{completedOrders.length}</Badge></div></div></CardContent>
        </Card>
        <Card data-testid="card-prevention-effectiveness"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Prevention Effectiveness</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Prevention Rate</span><span className="text-lg font-bold text-green-600" data-testid="text-prevention-rate">{preventionRate.toFixed(0)}%</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Failures Prevented</span><Badge variant="default" className="min-w-[3rem] justify-center bg-green-600" data-testid="badge-prevented">{totalPrevented}</Badge></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Total Failures</span><Badge variant="outline" className="min-w-[3rem] justify-center" data-testid="badge-total-failures">{totalFailures}</Badge></div></div></CardContent>
        </Card>
        {highReactiveCostEquipment.length > 0 && <Card className="border-amber-500" data-testid="card-cost-optimization"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-amber-600"><DollarSign className="h-4 w-4" />Cost Optimization Opportunity</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Under-Maintained Units</span><span className="text-lg font-bold text-amber-600" data-testid="text-undermaintained">{highReactiveCostEquipment.length}</span></div><p className="text-xs text-muted-foreground" data-testid="text-optimization-description">Equipment below 60% health - shift to preventive maintenance to reduce reactive costs</p><div className="mt-2"><span className="text-xs font-medium" data-testid="text-est-savings">Est. Savings: ${formatNumber(preventiveSavings)}</span></div></div></CardContent></Card>}
        {schedulingSuggestions.length > 0 && <Card className="border-blue-500" data-testid="card-scheduling-recommendations"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-blue-600"><Calendar className="h-4 w-4" />Scheduling Recommendations</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Equipment Needing Scheduling</span><span className="text-lg font-bold text-blue-600" data-testid="text-scheduling-count">{schedulingSuggestions.length}</span></div><p className="text-xs text-muted-foreground">Equipment in optimal maintenance window (50-90% risk)</p></div></CardContent></Card>}
      </div>

      {overdueOrders > 0 && <Card className="border-destructive"><CardHeader><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-destructive" /><CardTitle>Overdue Work Orders</CardTitle></div></CardHeader><CardContent><div className="space-y-2">{overdueWorkOrders.map((wo) => <div key={wo.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`overdue-order-${wo.id}`}><div><p className="font-medium text-sm">{wo.reason || "Maintenance Required"}</p><p className="text-xs text-muted-foreground">Created {wo.createdAt ? formatDistanceToNow(new Date(wo.createdAt), { addSuffix: true }) : "recently"}</p></div><Badge variant="destructive">OVERDUE</Badge></div>)}</div></CardContent></Card>}

      {schedulingSuggestions.length > 0 && <CollapsibleSection title="Optimal Maintenance Windows" badge={`${schedulingSuggestions.length} recommended`} summary={`${schedulingSuggestions.length} equipment units in optimal maintenance window`}><div className="space-y-2">{schedulingSuggestions.slice(0, 10).map((suggestion) => <div key={suggestion.equipmentId} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`scheduling-suggestion-${suggestion.equipmentId}`}><div className="flex-1"><p className="font-medium text-sm">{suggestion.equipmentName}</p><p className="text-xs text-muted-foreground">Risk: {suggestion.failureRisk.toFixed(0)}% | Recommended window: {suggestion.recommendedWindow}</p></div><Badge variant={suggestion.priority === "High" ? "destructive" : suggestion.priority === "Medium" ? "default" : "secondary"}>{suggestion.priority}</Badge></div>)}</div></CollapsibleSection>}

      <CollapsibleSection title="Predictive Maintenance - High Risk Equipment" badge={highRiskEquipment > 0 ? `${highRiskEquipment} items` : undefined} summary={`${highRiskEquipment} equipment items with failure risk >70%`}>
        {highRiskEquipment === 0 ? <p className="text-sm text-muted-foreground">No high-risk equipment detected</p> : <div className="space-y-2">{highRiskPdmScores.map((score) => <div key={score.equipmentId} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`high-risk-equipment-${score.equipmentId}`}><div className="flex-1"><p className="font-medium text-sm">{score.equipmentName || score.equipmentId}</p><p className="text-xs text-muted-foreground">Failure Risk: {score.failureRisk.toFixed(0)}% | Confidence: {(score.confidence * 100).toFixed(0)}%</p></div><Badge variant={score.failureRisk > 85 ? "destructive" : "default"}>{score.failureRisk.toFixed(0)}% risk</Badge></div>)}</div>}
      </CollapsibleSection>

      <CollapsibleSection title="Failure Pattern Analysis" summary="Historical failure trends and prevention metrics">
        {failureChartData.length > 0 ? <ResponsiveContainer width="100%" height={300}><BarChart data={failureChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="failures" fill="#ef4444" name="Failures" /><Bar dataKey="prevented" fill="#10b981" name="Prevented" /></BarChart></ResponsiveContainer> : <p className="text-sm text-muted-foreground">No failure pattern data available</p>}
      </CollapsibleSection>

      <CollapsibleSection title="Recent Maintenance Activity" summary={`${maintenanceRecords.slice(0, 10).length} recent records`}>
        <div className="space-y-2">{maintenanceRecords.slice(0, 10).map((record) => <div key={record.id || `${record.equipmentId}-${record.type}-${record.completedAt}`} className="flex items-center justify-between p-3 border rounded-lg text-sm"><div><p className="font-medium">{record.equipmentName || record.equipmentId}</p><p className="text-xs text-muted-foreground">{record.type}</p></div><Badge variant="outline">{record.completedAt ? formatDistanceToNow(new Date(record.completedAt), { addSuffix: true }) : "N/A"}</Badge></div>)}</div>
      </CollapsibleSection>
    </div>
  );
}
```

---

## File 5: `client/src/components/analytics/FinanceMode.tsx`

Cost intelligence and ROI tracking: total savings, monthly spend with trend, predictive savings, ROI, AI insights cost, downtime projections, preventive vs reactive ratio, labor cost analytics, ROI trend chart, cost trends line chart, cost breakdown pie chart, and cost optimization recommendations.

```tsx
import { TrendingUp, TrendingDown, PieChart, Target, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/components/ui/export-button";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "./CollapsibleSection";
import { ContextHelp } from "./ContextHelp";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { formatDate } from "@/lib/formatters";
import { useFinanceModeData } from "@/features/analytics";

export function FinanceMode() {
  const { latestMonth, monthlyChange, totalSavings, predictiveSavings, completedInsights, estimatedLLMCost, avgCostPerInsight, openWorkOrders, estimatedFutureDowntime, projectedDowntimeCost, preventiveCost, reactiveCost, preventiveRatio, totalLaborCost, totalLaborHours, avgLaborCostPerHour, workOrdersWithLabor, pendingLaborHours, estimatedPendingLaborCost, roiAnalysis, costBreakdownData, roiTrendData, costTrendsData, exportPDFSections, exportCostTrendsData, COLORS } = useFinanceModeData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Finance Mode</h2>
          <p className="text-sm text-muted-foreground mt-1">Cost intelligence, ROI tracking, and financial optimization</p>
        </div>
        <ExportButton data={exportCostTrendsData} filename="finance-report" formats={["csv", "pdf"]} pdfSections={exportPDFSections} csvOptions={{ columns: ["month", "totalCost", "labor", "parts", "downtime"], headers: { month: "Month", totalCost: "Total Cost", labor: "Labor", parts: "Parts", downtime: "Downtime" } }} pdfOptions={{ title: "Finance Report", subtitle: `Generated on ${formatDate(new Date())}` }} variant="outline" size="default" data-testid="button-export-finance" />
      </div>

      <ScenarioBanner type="info" title="Finance Mode - Cost Intelligence & ROI" description="Track maintenance costs, analyze spending trends, measure ROI from predictive maintenance, and identify cost optimization opportunities. Use this view for budget planning and financial reporting." />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card data-testid="card-total-savings"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Total Savings</CardTitle><ContextHelp title="Total Savings" description="Cumulative cost savings from predictive and preventive maintenance interventions vs. reactive repairs." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-green-600" data-testid="text-total-savings">${(totalSavings / 1000).toFixed(0)}k</div></CardContent></Card>
        <Card data-testid="card-monthly-spend"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Monthly Spend</CardTitle><ContextHelp title="Monthly Maintenance Spend" description="Total maintenance costs for the most recent month including labor, parts, and downtime." /></div></CardHeader><CardContent><div className="text-3xl font-bold" data-testid="text-monthly-spend">${latestMonth ? (latestMonth.totalCost / 1000).toFixed(0) : 0}k</div>{monthlyChange !== 0 && <div className={`flex items-center gap-1 mt-1 text-sm ${monthlyChange > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-monthly-change">{monthlyChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(monthlyChange).toFixed(1)}% vs last month</div>}</CardContent></Card>
        <Card data-testid="card-predictive-savings"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Predictive Savings</CardTitle><ContextHelp title="Predictive Maintenance Savings" description="Savings from using ML predictions to prevent failures before they occur." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-blue-600" data-testid="text-predictive-savings">${(predictiveSavings / 1000).toFixed(0)}k</div></CardContent></Card>
        <Card data-testid="card-roi"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">ROI</CardTitle><ContextHelp title="Return on Investment" description="Overall ROI from implementing predictive maintenance vs. traditional reactive maintenance." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-purple-600" data-testid="text-roi">{roiAnalysis?.overallRoi ? `${roiAnalysis.overallRoi.toFixed(0)}%` : "N/A"}</div></CardContent></Card>
      </div>

      {/* AI Insights Cost, Downtime Projections, Preventive vs Reactive, Labor Cost Analytics cards omitted for brevity - see full source */}

      {roiTrendData.length > 0 && (
        <Card data-testid="card-roi-trend"><CardHeader><CardTitle>ROI Trend Analysis</CardTitle><p className="text-sm text-muted-foreground">6-month return on investment trend</p></CardHeader><CardContent><div data-testid="chart-roi-trend"><ResponsiveContainer width="100%" height={250}><BarChart data={roiTrendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="roi" fill="#8b5cf6" name="ROI %" /></BarChart></ResponsiveContainer></div></CardContent></Card>
      )}

      <Card data-testid="card-cost-trends"><CardHeader><CardTitle>Cost Trends</CardTitle><p className="text-sm text-muted-foreground">Monthly maintenance costs breakdown</p></CardHeader><CardContent>{costTrendsData.length > 0 ? (<div data-testid="chart-cost-trends"><ResponsiveContainer width="100%" height={300}><LineChart data={costTrendsData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="totalCost" stroke="#3b82f6" name="Total Cost" strokeWidth={2} /><Line type="monotone" dataKey="labor" stroke="#10b981" name="Labor" /><Line type="monotone" dataKey="parts" stroke="#f59e0b" name="Parts" /><Line type="monotone" dataKey="downtime" stroke="#ef4444" name="Downtime" /></LineChart></ResponsiveContainer></div>) : <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-cost-data">No cost trend data available</p>}</CardContent></Card>

      <CollapsibleSection title="Cost Breakdown by Type" summary={`${costBreakdownData.length} cost categories tracked`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {costBreakdownData.length > 0 && <ResponsiveContainer width="100%" height={250}><RechartsPieChart><Pie data={costBreakdownData} cx="50%" cy="50%" labelLine={false} label={(entry) => `${entry.name}: $${(entry.value / 1000).toFixed(0)}k`} outerRadius={80} fill="#8884d8" dataKey="value">{costBreakdownData.map((entry) => <Cell key={`cell-${entry.name}`} fill={COLORS[costBreakdownData.indexOf(entry) % COLORS.length]} />)}</Pie><Tooltip /></RechartsPieChart></ResponsiveContainer>}
          <div className="space-y-2">{costBreakdownData.map((item: { name: string; value: number }) => <div key={item.name} className="flex items-center justify-between p-3 border rounded-lg"><div className="flex items-center gap-3"><div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[costBreakdownData.indexOf(item) % COLORS.length] }} /><span className="font-medium capitalize">{item.name}</span></div><span className="font-bold">${(item.value / 1000).toFixed(1)}k</span></div>)}</div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Cost Optimization Opportunities" summary="Data-driven recommendations to reduce maintenance costs">
        <div className="space-y-3">
          {preventiveRatio < 40 && <div className="p-4 border rounded-lg bg-blue-500/5"><div className="flex items-start gap-3"><Target className="h-5 w-5 text-blue-600 mt-0.5" /><div><h4 className="font-semibold text-sm">Shift to Preventive Maintenance</h4><p className="text-sm text-muted-foreground mt-1">Your preventive ratio is {preventiveRatio.toFixed(0)}%. Increasing to 60% could save ${((reactiveCost * 0.3) / 1000).toFixed(0)}k/year by preventing costly failures</p></div></div></div>}
          {projectedDowntimeCost > 10000 && <div className="p-4 border rounded-lg bg-amber-500/5"><div className="flex items-start gap-3"><TrendingDown className="h-5 w-5 text-amber-600 mt-0.5" /><div><h4 className="font-semibold text-sm">Reduce Projected Downtime</h4><p className="text-sm text-muted-foreground mt-1">${(projectedDowntimeCost / 1000).toFixed(0)}k in downtime costs projected. Act on {openWorkOrders.length} open work orders earlier to reduce impact</p></div></div></div>}
        </div>
      </CollapsibleSection>
    </div>
  );
}
```

---

## File 6: `client/src/components/analytics/DataIntegrityDashboard.tsx`

Automated telemetry validation: service status, last run, health score, total checks, reconciliation report with validation issues, data quality and issue type charts, and an about section.

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExportButton } from "@/components/ui/export-button";
import { Shield, Database, AlertTriangle, CheckCircle2, RefreshCw, Clock, FileWarning, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/formatters";
import { DataQualityChart } from "@/components/charts/DataQualityChart";
import { IssueTypeChart } from "@/components/charts/IssueTypeChart";
import { useDataIntegrityData } from "@/features/analytics";

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6" data-testid="loading-integrity-dashboard">
      <Skeleton className="h-32 w-full" data-testid="skeleton-header" />
      <Skeleton className="h-64 w-full" data-testid="skeleton-cards" />
      <Skeleton className="h-96 w-full" data-testid="skeleton-report" />
    </div>
  );
}

function ErrorAlert({ error }: { error: Error | unknown }) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="space-y-6 p-6">
      <Alert variant="destructive" data-testid="alert-status-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription data-testid="text-status-error-message">
          Failed to load reconciliation status: {message}
        </AlertDescription>
      </Alert>
    </div>
  );
}

function getHealthRating(percentage: number): { variant: "default" | "secondary" | "destructive"; label: string } {
  if (percentage >= 95) {return { variant: "default", label: "Excellent" };}
  if (percentage >= 80) {return { variant: "secondary", label: "Good" };}
  return { variant: "destructive", label: "Poor" };
}

function getReportStatusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "completed") {return "default";}
  if (status === "failed") {return "destructive";}
  return "secondary";
}

function getSeverityVariant(severity: string): "destructive" | "secondary" | "outline" {
  if (severity === "critical") {return "destructive";}
  if (severity === "warning") {return "secondary";}
  return "outline";
}

function getNoReportMessage(reportError: Error | unknown): string {
  if (reportError instanceof Error && reportError.message.includes("404")) {
    return 'No reconciliation report available yet. Click "Run Integrity Check" to generate the first report.';
  }
  if (reportError) {
    const errorMsg = reportError instanceof Error ? reportError.message : "Unknown error";
    return `Failed to load reconciliation report: ${errorMsg}`;
  }
  return "No reconciliation report available. The report will appear after the first data integrity check completes.";
}

export function DataIntegrityDashboard() {
  const { status, statusLoading, statusError, latestReport, reportLoading, reportError, healthPercentage, runReconciliation, handleRunReconciliation, exportPDFSections, exportTableData, exportCSVData } = useDataIntegrityData();

  if (statusLoading || reportLoading) {return <LoadingSkeleton />;}
  if (statusError) {return <ErrorAlert error={statusError} />;}

  const healthRating = getHealthRating(healthPercentage);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-primary" />Data Integrity Monitor</h2><p className="text-sm text-muted-foreground mt-1">Automated telemetry validation and consistency checks</p></div>
        <div className="flex items-center gap-2">
          <ExportButton data={exportCSVData} filename="data-integrity-report" formats={exportTableData ? ["csv", "pdf", "pdf-table"] : ["csv", "pdf"]} pdfSections={exportPDFSections} pdfTableData={exportTableData} csvOptions={{ columns: ["severity", "issueType", "message", "affectedRecords"], headers: { severity: "Severity", issueType: "Issue Type", message: "Message", affectedRecords: "Affected Records" } }} pdfOptions={{ title: "Data Integrity Report", subtitle: `Generated on ${formatDate(new Date())}` }} variant="outline" size="default" data-testid="button-export-report" />
          <Button onClick={handleRunReconciliation} disabled={status?.isRunning || runReconciliation.isPending} data-testid="button-run-reconciliation"><RefreshCw className={`h-4 w-4 mr-2 ${status?.isRunning || runReconciliation.isPending ? "animate-spin" : ""}`} />{status?.isRunning ? "Running..." : "Run Check"}</Button>
        </div>
      </div>

      {/* Status cards, report details, charts - see full 118-line source */}
    </div>
  );
}
```

---

## File 7: `client/src/components/analytics/NarrativeSummaryCard.tsx`

AI-powered performance narrative card with OpenAI-generated headline, analysis, context bullets, and recommendations. Severity-colored gradient backgrounds. Used alongside vessel performance charts.

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle, Info, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";

interface NarrativeSummaryCardProps {
  vesselId: string;
  vesselName: string;
  chartType: "power_stw" | "load_distribution" | "fuel_consumption" | "efficiency";
  currentMetrics: {
    avgPower?: number;
    avgSpeed?: number;
    avgLoad?: number;
    avgFuelRate?: number;
    efficiency?: number;
  };
  baseline?: { value: number; percentageDiff: number; };
  fleetAverage?: { value: number; percentageDiff: number; };
  operatingMode?: string;
  periodDays?: number;
}

interface NarrativeSummary {
  headline: string;
  analysis: string;
  context: string[];
  recommendations: string[];
  severity: "good" | "normal" | "attention" | "critical";
  confidence: number;
}

export function NarrativeSummaryCard({
  vesselId, vesselName, chartType, currentMetrics, baseline, fleetAverage, operatingMode, periodDays = 30,
}: NarrativeSummaryCardProps) {
  const { data: summary, isLoading, error } = useQuery<NarrativeSummary>({
    queryKey: ["/api/analytics/narrative-summary", vesselId, chartType, periodDays],
    queryFn: async () => {
      return apiRequest("POST", "/api/analytics/narrative-summary", {
        body: JSON.stringify({ vesselId, vesselName, chartType, currentMetrics, baseline, fleetAverage, operatingMode, periodDays }),
      });
    },
    refetchInterval: 300000,
    staleTime: 120000,
    enabled: !!vesselId && !!chartType,
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-950" data-testid="card-narrative-loading">
        <CardHeader><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" /><CardTitle className="text-lg">AI Performance Insights</CardTitle></div></CardHeader>
        <CardContent className="space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /></CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card className="border-amber-200 dark:border-amber-800" data-testid="card-narrative-error">
        <CardHeader><div className="flex items-center gap-2"><Info className="h-5 w-5 text-amber-600" /><CardTitle className="text-lg">Performance Summary</CardTitle></div><CardDescription>AI insights temporarily unavailable</CardDescription></CardHeader>
      </Card>
    );
  }

  const getSeverityIcon = () => {
    switch (summary.severity) {
      case "good": return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "attention": return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "critical": return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default: return <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getSeverityColor = (): string => {
    switch (summary.severity) {
      case "good": return "from-green-50 to-white dark:from-green-950/20 dark:to-gray-950 border-green-200 dark:border-green-800";
      case "attention": return "from-amber-50 to-white dark:from-amber-950/20 dark:to-gray-950 border-amber-200 dark:border-amber-800";
      case "critical": return "from-red-50 to-white dark:from-red-950/20 dark:to-gray-950 border-red-200 dark:border-red-800";
      default: return "from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-950 border-blue-200 dark:border-blue-800";
    }
  };

  const confidencePercent = Math.round(summary.confidence * 100);

  return (
    <Card className={`bg-gradient-to-br ${getSeverityColor()}`} data-testid="card-narrative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span data-testid={`icon-severity-${summary.severity}`}>{getSeverityIcon()}</span>
            <div>
              <CardTitle className="text-lg" data-testid="text-headline">{summary.headline}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Sparkles className="h-3 w-3" /> AI Analysis
                {confidencePercent < 70 && <Badge variant="outline" className="text-xs" data-testid="badge-confidence">{confidencePercent}% confidence</Badge>}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.analysis && <div className="text-sm text-gray-700 dark:text-gray-300" data-testid="text-analysis">{summary.analysis}</div>}
        {summary.context?.length > 0 && (
          <div className="space-y-2" data-testid="container-context">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Context</h4>
            <ul className="space-y-1">{summary.context.map((item, index) => <li key={`context-${item.slice(0, 30)}-${index}`} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2" data-testid={`item-context-${index}`}><span className="text-blue-500 mt-0.5">•</span><span>{item}</span></li>)}</ul>
          </div>
        )}
        {summary.recommendations?.length > 0 && (
          <div className="space-y-2" data-testid="container-recommendations">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recommendations</h4>
            <ul className="space-y-1">{summary.recommendations.map((rec, index) => <li key={`rec-${rec.slice(0, 30)}-${index}`} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2" data-testid={`item-recommendation-${index}`}><span className="text-blue-500 mt-0.5">→</span><span>{rec}</span></li>)}</ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## File 8: `client/src/components/analytics/PowerSTWChart.tsx`

Propulsion efficiency scatter chart (Power vs Speed Through Water) with baseline/fleet average/percentile benchmark overlays, hull fouling analysis, and configurable toggle controls.

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Ship, AlertCircle, TrendingUp, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BenchmarkLayer } from "./chart-overlays/BenchmarkLayer";
import { usePowerSTWData, type EnrichedDataPoint } from "@/features/analytics/hooks/usePowerSTWData";
import { formatNumber } from "@/lib/formatters";

interface PowerSTWChartProps {
  vesselId: string;
  startDate?: Date;
  endDate?: Date;
}

export function PowerSTWChart({ vesselId, startDate, endDate }: PowerSTWChartProps) {
  const {
    data, isLoading, isError, error, enrichedData, avgDeviation,
    speedUnit, powerUnit, toggles, setToggle, showControls, setShowControls,
  } = usePowerSTWData({ vesselId, startDate, endDate });

  if (isLoading) {
    return (<Card data-testid="card-power-stw-loading"><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Power vs Speed Through Water</CardTitle><CardDescription>Propulsion efficiency and hull fouling analysis</CardDescription></CardHeader><CardContent><Skeleton className="h-80 w-full" /></CardContent></Card>);
  }

  if (isError) {
    return (<Card className="border-destructive/50" data-testid="card-power-stw-error"><CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertCircle className="h-5 w-5" />Power-STW Analysis Error</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p></CardContent></Card>);
  }

  if (!data || data.actual.length === 0) {
    return (<Card data-testid="card-power-stw-empty"><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Power vs Speed Through Water</CardTitle></CardHeader><CardContent><div className="flex flex-col items-center justify-center h-80 text-center"><Ship className="h-12 w-12 text-muted-foreground/50 mb-4" /><p className="text-sm text-muted-foreground">No RPM/torque data available for the selected period.</p></div></CardContent></Card>);
  }

  return (
    <Card data-testid="card-power-stw">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Power vs Speed Through Water</CardTitle>
            <CardDescription>Propulsion efficiency analysis • {formatNumber(data.metadata.sampleCount)} samples{data.metadata.estimatedSTW && <Badge variant="outline" className="ml-2 text-xs">Speed Estimated</Badge>}</CardDescription>
          </div>
          <button onClick={() => setShowControls(!showControls)} className="p-2 hover:bg-accent rounded-md transition-colors" data-testid="button-toggle-controls"><Settings2 className="h-4 w-4" /></button>
        </div>
        {showControls && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3" data-testid="container-chart-controls">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2"><Switch id="baseline-toggle" checked={toggles.showBaseline} onCheckedChange={(checked) => setToggle("showBaseline", checked)} /><Label htmlFor="baseline-toggle" className="text-sm cursor-pointer">Baseline</Label></div>
              <div className="flex items-center space-x-2"><Switch id="fleet-avg-toggle" checked={toggles.showFleetAverage} onCheckedChange={(checked) => setToggle("showFleetAverage", checked)} /><Label htmlFor="fleet-avg-toggle" className="text-sm cursor-pointer">Fleet Average</Label></div>
              <div className="flex items-center space-x-2"><Switch id="percentiles-toggle" checked={toggles.showPercentiles} onCheckedChange={(checked) => setToggle("showPercentiles", checked)} /><Label htmlFor="percentiles-toggle" className="text-sm cursor-pointer">Percentiles</Label></div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart data={enrichedData} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="speed" type="number" name="Speed" unit={` ${speedUnit}`} label={{ value: `Speed Through Water (${speedUnit})`, position: "insideBottom", offset: -15 }} />
            <YAxis type="number" name="Power" unit={` ${powerUnit}`} label={{ value: `Propulsion Power (${powerUnit})`, angle: -90, position: "insideLeft" }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
              if (active && payload?.length > 0) {
                const d = payload[0].payload as EnrichedDataPoint;
                return (<div className="bg-background border border-border rounded-lg p-3 shadow-lg"><p className="font-medium text-sm mb-2">Performance Data</p><p className="text-sm text-muted-foreground">Speed: <span className="font-mono text-foreground">{d.speed?.toFixed(1)} {speedUnit}</span></p>{d.actualPower !== undefined && <p className="text-sm text-muted-foreground">Actual Power: <span className="font-mono text-foreground">{d.actualPower.toFixed(0)} {powerUnit}</span></p>}{d.baselinePower !== undefined && <p className="text-sm text-muted-foreground">Baseline: <span className="font-mono text-foreground">{d.baselinePower.toFixed(0)} {powerUnit}</span></p>}{d.fleetAvg !== undefined && <p className="text-sm text-muted-foreground">Fleet Avg: <span className="font-mono text-foreground">{d.fleetAvg.toFixed(0)} {powerUnit}</span></p>}</div>);
              }
              return null;
            }} />
            <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="circle" />
            <BenchmarkLayer data={enrichedData} showBaseline={toggles.showBaseline} showFleetAverage={toggles.showFleetAverage} showPercentiles={toggles.showPercentiles} xKey="speed" />
            <Scatter name="Actual Performance" data={enrichedData.filter((d) => d.actualPower !== undefined)} fill="hsl(var(--primary))" opacity={0.6} dataKey="actualPower" />
          </ScatterChart>
        </ResponsiveContainer>

        <div className="mt-4 p-4 bg-muted/50 rounded-lg" data-testid="container-hull-analysis">
          <h4 className="font-medium text-sm mb-2">Hull Efficiency Analysis</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground">Average Deviation:</p><p className={`font-mono font-medium ${avgDeviation > 20 ? "text-destructive" : avgDeviation > 10 ? "text-warning" : "text-success"}`} data-testid="text-avg-deviation">{avgDeviation > 0 ? "+" : ""}{avgDeviation.toFixed(1)}%</p></div>
            <div><p className="text-muted-foreground">Status:</p><Badge variant={avgDeviation > 20 ? "destructive" : avgDeviation > 10 ? "default" : "secondary"} data-testid="badge-hull-status">{avgDeviation > 20 ? "Hull Fouling Likely" : avgDeviation > 10 ? "Efficiency Reduced" : "Normal Performance"}</Badge></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## File 9: `client/src/components/analytics/ScenarioBanner.tsx`

Contextual guidance banner with info/guidance/alert variants.

```tsx
import { AlertCircle, Info, Lightbulb } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ScenarioBannerProps {
  type?: "info" | "guidance" | "alert";
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}

export function ScenarioBanner({ type = "info", title, description, actions, className = "" }: ScenarioBannerProps) {
  const icons = { info: Info, guidance: Lightbulb, alert: AlertCircle };
  const Icon = icons[type];
  const variants = {
    info: "border-blue-500/50 bg-blue-500/10",
    guidance: "border-amber-500/50 bg-amber-500/10",
    alert: "border-red-500/50 bg-red-500/10",
  };

  return (
    <Alert className={`${variants[type]} ${className}`} data-testid="scenario-banner">
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        {description}
        {actions && <div className="mt-3">{actions}</div>}
      </AlertDescription>
    </Alert>
  );
}
```

---

## File 10: `client/src/components/analytics/ContextHelp.tsx`

Tooltip-based contextual help for metrics and features.

```tsx
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ContextHelpProps {
  title: string;
  description: string;
  className?: string;
}

export function ContextHelp({ title, description, className = "" }: ContextHelpProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
            data-testid="context-help"
            aria-label={`Help: ${title}`}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```
