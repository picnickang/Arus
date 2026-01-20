import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Ship, Users, AlertTriangle, CheckCircle, XCircle, Activity, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useSTCWComplianceData, type VesselSummary, type TrendData } from "@/features/crew/hooks/useSTCWComplianceData";

function TrendIcon({ trend }: { trend: "increasing" | "stable" | "decreasing" }) {
  if (trend === "increasing") {return <TrendingUp className="h-4 w-4 text-red-500" />;}
  if (trend === "decreasing") {return <TrendingDown className="h-4 w-4 text-green-500" />;}
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function VesselRow({ vessel, expanded, onToggle }: { vessel: VesselSummary; expanded: boolean; onToggle: () => void }) {
  const hasIssues = vessel.violationCount > 0 || vessel.criticalFatigueCount > 0;
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full" data-testid={`vessel-row-${vessel.vesselId}`}>
        <div className={cn("flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-muted/50", hasIssues && "bg-red-50/50 dark:bg-red-900/10")}>
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Ship className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <p className="font-medium">{vessel.vesselName}</p>
              <p className="text-xs text-muted-foreground">{vessel.totalCrew} crew</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {vessel.criticalFatigueCount > 0 && <Badge variant="destructive" className="gap-1" data-testid={`badge-critical-${vessel.vesselId}`}><XCircle className="h-3 w-3" />{vessel.criticalFatigueCount}</Badge>}
            {vessel.highFatigueCount > 0 && <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300" data-testid={`badge-high-${vessel.vesselId}`}><AlertTriangle className="h-3 w-3" />{vessel.highFatigueCount}</Badge>}
            <div className={cn("w-16 text-right font-medium", vessel.complianceRate >= 95 ? "text-green-600" : vessel.complianceRate >= 80 ? "text-amber-600" : "text-red-600")}>
              {vessel.complianceRate.toFixed(0)}%
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-10 pr-3 pb-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="p-2 rounded bg-muted/30"><p className="text-muted-foreground text-xs">Compliant</p><p className="font-medium">{vessel.compliantCrew}/{vessel.totalCrew}</p></div>
            <div className="p-2 rounded bg-muted/30"><p className="text-muted-foreground text-xs">Avg Rest/24h</p><p className="font-medium">{vessel.avgRestPer24h.toFixed(1)}h</p></div>
            <div className="p-2 rounded bg-muted/30"><p className="text-muted-foreground text-xs">Violations</p><p className="font-medium text-red-600">{vessel.violationCount}</p></div>
          </div>
          <Link href={`/hours-of-rest?vessel=${vessel.vesselId}`}>
            <Button variant="ghost" size="sm" className="w-full gap-2" data-testid={`link-vessel-hor-${vessel.vesselId}`}>View Hours of Rest<ExternalLink className="h-3 w-3" /></Button>
          </Link>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ComplianceTrendChart({ data }: { data: TrendData; formattedData: Array<{ date: string; complianceRate: number; highFatigueRate: number }> }) {
  const chartData = data.trends.map((t) => ({ ...t, date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(value: number, name: string) => { if (name === "complianceRate") {return [`${value.toFixed(1)}%`, "Compliance"];} if (name === "highFatigueRate") {return [`${value.toFixed(1)}%`, "High Fatigue"];} return [value, name]; }} />
          <Line type="monotone" dataKey="complianceRate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="complianceRate" />
          <Line type="monotone" dataKey="highFatigueRate" stroke="#f59e0b" strokeWidth={2} dot={false} name="highFatigueRate" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface STCWComplianceWidgetProps {
  lookbackDays?: number;
  prefetchedSummary?: Parameters<typeof useSTCWComplianceData>[0]["prefetchedSummary"];
  prefetchedTrends?: Parameters<typeof useSTCWComplianceData>[0]["prefetchedTrends"];
}

export const STCWComplianceWidget = memo(function STCWComplianceWidget({ lookbackDays = 30, prefetchedSummary, prefetchedTrends }: STCWComplianceWidgetProps) {
  const { summary, trends, isLoadingSummary, isLoadingTrends, summaryError, expandedVessel, toggleVesselExpansion, hasIssues, sortedVessels, formattedChartData } = useSTCWComplianceData({ lookbackDays, prefetchedSummary, prefetchedTrends });

  if (isLoadingSummary) {
    return (
      <Card data-testid="widget-stcw-loading">
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Fleet STCW Compliance</CardTitle></CardHeader>
        <CardContent><div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></CardContent>
      </Card>
    );
  }

  if (summaryError || !summary) {
    return (
      <Card data-testid="widget-stcw-error">
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Fleet STCW Compliance</CardTitle></CardHeader>
        <CardContent><div className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><AlertCircle className="h-5 w-5" /><span>Failed to load compliance data</span></div></CardContent>
      </Card>
    );
  }

  const { fleet, topIssues } = summary;

  return (
    <Card data-testid="widget-stcw-compliance">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Fleet STCW Compliance</CardTitle>
            <CardDescription>{lookbackDays}-day rolling compliance across {fleet.totalVessels} vessels</CardDescription>
          </div>
          {hasIssues && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Attention Required</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/30"><Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="text-2xl font-bold">{fleet.totalCrew}</p><p className="text-xs text-muted-foreground">Total Crew</p></div>
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20"><CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-600" /><p className="text-2xl font-bold text-green-700 dark:text-green-400">{fleet.overallComplianceRate.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Compliance</p></div>
          <div className={cn("text-center p-3 rounded-lg", fleet.totalViolations > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/30")}><XCircle className={cn("h-5 w-5 mx-auto mb-1", fleet.totalViolations > 0 ? "text-red-600" : "text-muted-foreground")} /><p className={cn("text-2xl font-bold", fleet.totalViolations > 0 && "text-red-700 dark:text-red-400")}>{fleet.totalViolations}</p><p className="text-xs text-muted-foreground">Violations</p></div>
          <div className={cn("text-center p-3 rounded-lg", (fleet.highFatigueCount + fleet.criticalFatigueCount) > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/30")}><Activity className={cn("h-5 w-5 mx-auto mb-1", (fleet.highFatigueCount + fleet.criticalFatigueCount) > 0 ? "text-amber-600" : "text-muted-foreground")} /><p className={cn("text-2xl font-bold", (fleet.highFatigueCount + fleet.criticalFatigueCount) > 0 && "text-amber-700 dark:text-amber-400")}>{fleet.highFatigueCount + fleet.criticalFatigueCount}</p><p className="text-xs text-muted-foreground">High Fatigue</p></div>
        </div>

        {trends && !isLoadingTrends && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Compliance Trends</h4>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><TrendIcon trend={trends.summary.violationTrend} /><span>Violations</span></div>
                <div className="flex items-center gap-1"><TrendIcon trend={trends.summary.fatigueRiskTrend} /><span>Fatigue</span></div>
              </div>
            </div>
            <ComplianceTrendChart data={trends} formattedData={formattedChartData} />
          </div>
        )}

        {sortedVessels.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Vessel Breakdown</h4>
            <ScrollArea className="h-64">
              <div className="space-y-1">
                {sortedVessels.map((vessel) => (
                  <VesselRow key={vessel.vesselId} vessel={vessel} expanded={expandedVessel === vessel.vesselId} onToggle={() => toggleVesselExpansion(vessel.vesselId)} />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {topIssues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600 dark:text-red-400">Top Issues Requiring Attention</h4>
            <div className="space-y-2">
              {topIssues.slice(0, 5).map((issue, idx) => (
                <div key={`${issue.crewId}-${idx}`} className={cn("p-2 rounded-lg border text-sm", issue.severity === "critical" ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" : "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800")} data-testid={`issue-${issue.crewId}-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{issue.crewName}</span>
                    <Badge variant={issue.severity === "critical" ? "destructive" : "outline"} className="text-xs">{issue.issueType.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{issue.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <Link href="/hours-of-rest">
            <Button variant="outline" className="w-full gap-2" data-testid="link-hor-dashboard">View Hours of Rest Dashboard<ExternalLink className="h-4 w-4" /></Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
});
