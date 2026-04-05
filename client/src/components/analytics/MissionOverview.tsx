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
