import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronRight,
  Ship,
  Clock,
  Award,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  useSTCWComplianceData,
  type VesselSummary,
  type TrendData,
} from "@/features/crew/hooks/useSTCWComplianceData";
import { useCertificationExpiryData } from "@/features/crew/hooks/useCertificationExpiryData";

function ComplianceTrendChart({ data }: { data: TrendData }) {
  const chartData = data.trends.map((t) => ({
    ...t,
    date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value: number, name: string) => {
              if (name === "complianceRate") {
                return [`${value.toFixed(1)}%`, "Compliance"];
              }
              if (name === "highFatigueRate") {
                return [`${value.toFixed(1)}%`, "High Fatigue"];
              }
              return [value, name];
            }}
          />
          <Line
            type="monotone"
            dataKey="complianceRate"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            name="complianceRate"
          />
          <Line
            type="monotone"
            dataKey="highFatigueRate"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            name="highFatigueRate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function VesselComplianceRow({
  vessel,
  expanded,
  onToggle,
}: {
  vessel: VesselSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasIssues = vessel.violationCount > 0 || vessel.criticalFatigueCount > 0;
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full" data-testid={`compliance-vessel-${vessel.vesselId}`}>
        <div
          className={cn(
            "flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-muted/50",
            hasIssues && "bg-red-50/50 dark:bg-red-900/10"
          )}
        >
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Ship className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <p className="font-medium">{vessel.vesselName}</p>
              <p className="text-xs text-muted-foreground">{vessel.totalCrew} crew</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {vessel.criticalFatigueCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {vessel.criticalFatigueCount}
              </Badge>
            )}
            {vessel.highFatigueCount > 0 && (
              <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300">
                <AlertTriangle className="h-3 w-3" />
                {vessel.highFatigueCount}
              </Badge>
            )}
            <div
              className={cn(
                "w-16 text-right font-medium",
                vessel.complianceRate >= 95
                  ? "text-green-600"
                  : vessel.complianceRate >= 80
                    ? "text-amber-600"
                    : "text-red-600"
              )}
            >
              {vessel.complianceRate.toFixed(0)}%
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-10 pr-3 pb-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="p-2 rounded bg-muted/30">
              <p className="text-muted-foreground text-xs">Compliant</p>
              <p className="font-medium">
                {vessel.compliantCrew}/{vessel.totalCrew}
              </p>
            </div>
            <div className="p-2 rounded bg-muted/30">
              <p className="text-muted-foreground text-xs">Avg Rest/24h</p>
              <p className="font-medium">{vessel.avgRestPer24h.toFixed(1)}h</p>
            </div>
            <div className="p-2 rounded bg-muted/30">
              <p className="text-muted-foreground text-xs">Violations</p>
              <p className="font-medium text-red-600">{vessel.violationCount}</p>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function getUrgencyBadge(level: string) {
  switch (level) {
    case "critical":
      return (
        <Badge variant="destructive" className="text-xs">
          Critical
        </Badge>
      );
    case "warning":
      return (
        <Badge
          variant="outline"
          className="text-xs border-amber-500 text-amber-600 dark:text-amber-400"
        >
          Warning
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-xs">
          Notice
        </Badge>
      );
  }
}

function getUrgencyIcon(level: string) {
  switch (level) {
    case "critical":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    default:
      return <Clock className="h-4 w-4 text-blue-500" />;
  }
}

export default function CrewComplianceDashboard() {
  const {
    summary,
    trends,
    isLoadingSummary,
    isLoadingTrends,
    summaryError,
    expandedVessel,
    toggleVesselExpansion,
    hasIssues,
    sortedVessels,
  } = useSTCWComplianceData({ lookbackDays: 30 });

  const {
    data: certData,
    isLoading: certLoading,
    error: certError,
    criticalCount: certCritical,
  } = useCertificationExpiryData({ daysAhead: 90 });

  if (isLoadingSummary || certLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="compliance-dashboard-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <span>Unable to load compliance data. Please try again later.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { fleet, topIssues } = summary;
  const certLoaded = !certError && !!certData;
  const certTotal = certLoaded ? (certData.summary?.total ?? 0) : null;

  return (
    <div className="p-6 space-y-6" data-testid="compliance-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-lg font-semibold flex items-center gap-2"
            data-testid="text-compliance-title"
          >
            <Shield className="h-5 w-5" />
            Crew Compliance Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            30-day rolling STCW/MLC compliance across {fleet.totalVessels} vessel
            {fleet.totalVessels !== 1 ? "s" : ""}
          </p>
        </div>
        {(hasIssues || certCritical > 0) && (
          <Badge variant="destructive" className="gap-1" data-testid="badge-attention-required">
            <AlertTriangle className="h-3 w-3" />
            Attention Required
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="compliance-metrics">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold" data-testid="metric-total-crew">
              {fleet.totalCrew}
            </p>
            <p className="text-xs text-muted-foreground">Total Crew</p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            fleet.overallComplianceRate >= 95
              ? "border-green-200 dark:border-green-800"
              : fleet.overallComplianceRate >= 80
                ? "border-amber-200 dark:border-amber-800"
                : "border-red-200 dark:border-red-800"
          )}
        >
          <CardContent className="pt-4 pb-3 text-center">
            <CheckCircle
              className={cn(
                "h-5 w-5 mx-auto mb-1",
                fleet.overallComplianceRate >= 95
                  ? "text-green-600"
                  : fleet.overallComplianceRate >= 80
                    ? "text-amber-600"
                    : "text-red-600"
              )}
            />
            <p
              className={cn(
                "text-2xl font-bold",
                fleet.overallComplianceRate >= 95
                  ? "text-green-700 dark:text-green-400"
                  : fleet.overallComplianceRate >= 80
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-red-700 dark:text-red-400"
              )}
              data-testid="metric-compliance-rate"
            >
              {fleet.overallComplianceRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">STCW Compliance</p>
          </CardContent>
        </Card>
        <Card className={cn(fleet.totalViolations > 0 && "border-red-200 dark:border-red-800")}>
          <CardContent className="pt-4 pb-3 text-center">
            <XCircle
              className={cn(
                "h-5 w-5 mx-auto mb-1",
                fleet.totalViolations > 0 ? "text-red-600" : "text-muted-foreground"
              )}
            />
            <p
              className={cn(
                "text-2xl font-bold",
                fleet.totalViolations > 0 && "text-red-700 dark:text-red-400"
              )}
              data-testid="metric-violations"
            >
              {fleet.totalViolations}
            </p>
            <p className="text-xs text-muted-foreground">Rest Violations</p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            fleet.highFatigueCount + fleet.criticalFatigueCount > 0 &&
              "border-amber-200 dark:border-amber-800"
          )}
        >
          <CardContent className="pt-4 pb-3 text-center">
            <Activity
              className={cn(
                "h-5 w-5 mx-auto mb-1",
                fleet.highFatigueCount + fleet.criticalFatigueCount > 0
                  ? "text-amber-600"
                  : "text-muted-foreground"
              )}
            />
            <p
              className={cn(
                "text-2xl font-bold",
                fleet.highFatigueCount + fleet.criticalFatigueCount > 0 &&
                  "text-amber-700 dark:text-amber-400"
              )}
              data-testid="metric-fatigue"
            >
              {fleet.highFatigueCount + fleet.criticalFatigueCount}
            </p>
            <p className="text-xs text-muted-foreground">High Fatigue Risk</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {certTotal !== null && certTotal > 0 && (
          <Card data-testid="card-cert-expiry">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4" />
                Certification Expiry Alerts
              </CardTitle>
              <CardDescription>
                {certTotal} certification{certTotal !== 1 ? "s" : ""} expiring within 90 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div
                  className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30"
                  data-testid="cert-critical-count"
                >
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {certData?.summary?.critical ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </div>
                <div
                  className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30"
                  data-testid="cert-warning-count"
                >
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {certData?.summary?.warning ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Warning</div>
                </div>
                <div
                  className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30"
                  data-testid="cert-notice-count"
                >
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {certData?.summary?.notice ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Notice</div>
                </div>
              </div>
              {certData?.certifications && certData.certifications.length > 0 && (
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {certData.certifications.slice(0, 8).map((cert) => (
                      <div
                        key={cert.id}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-lg border text-sm",
                          cert.urgencyLevel === "critical"
                            ? "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800"
                            : cert.urgencyLevel === "warning"
                              ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800"
                              : "bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800"
                        )}
                        data-testid={`cert-expiry-${cert.id}`}
                      >
                        <div className="mt-0.5 shrink-0">{getUrgencyIcon(cert.urgencyLevel)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{cert.crewMemberName}</span>
                            {getUrgencyBadge(cert.urgencyLevel)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {cert.cert} —{" "}
                            {cert.daysUntilExpiry <= 0
                              ? "Expired"
                              : `${cert.daysUntilExpiry} days remaining`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}

        {certTotal === null && (
          <Card data-testid="card-cert-error">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4" />
                Certification Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm">Certification data is currently unavailable</span>
              </div>
            </CardContent>
          </Card>
        )}

        {certTotal !== null && certTotal === 0 && (
          <Card data-testid="card-cert-clear">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4" />
                Certification Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 text-green-600 py-4">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm">
                  All crew certifications are current — no expiries within 90 days
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {trends && !isLoadingTrends && (
          <Card data-testid="card-compliance-trend">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Compliance Trends (30 Days)
              </CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-primary inline-block" />
                    Compliance Rate
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                    Fatigue Risk
                  </span>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComplianceTrendChart data={trends} />
            </CardContent>
          </Card>
        )}
      </div>

      {topIssues.length > 0 && (
        <Card data-testid="card-top-issues">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Crew Requiring Attention
            </CardTitle>
            <CardDescription>
              Personnel with active rest violations or high fatigue risk scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topIssues.slice(0, 8).map((issue, idx) => (
                <div
                  key={`${issue.crewId}-${idx}`}
                  className={cn(
                    "p-3 rounded-lg border text-sm",
                    issue.severity === "critical"
                      ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                      : "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
                  )}
                  data-testid={`issue-crew-${issue.crewId}-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{issue.crewName}</span>
                    <Badge
                      variant={issue.severity === "critical" ? "destructive" : "outline"}
                      className="text-xs"
                    >
                      {issue.issueType === "violation"
                        ? "Rest Violation"
                        : issue.issueType === "critical_fatigue"
                          ? "Critical Fatigue"
                          : "High Fatigue"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sortedVessels.length > 0 && (
        <Card data-testid="card-vessel-breakdown">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ship className="h-4 w-4" />
              Vessel Compliance Breakdown
            </CardTitle>
            <CardDescription>Sorted by compliance rate (lowest first)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-1">
                {sortedVessels.map((vessel) => (
                  <VesselComplianceRow
                    key={vessel.vesselId}
                    vessel={vessel}
                    expanded={expandedVessel === vessel.vesselId}
                    onToggle={() => toggleVesselExpansion(vessel.vesselId)}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Link href="/crew?tab=hours-of-rest" className="flex-1">
          <Button variant="outline" className="w-full gap-2" data-testid="link-hours-of-rest">
            <Clock className="h-4 w-4" />
            View Hours of Rest
          </Button>
        </Link>
        <Link href="/crew?tab=roster" className="flex-1">
          <Button variant="outline" className="w-full gap-2" data-testid="link-crew-roster">
            <Users className="h-4 w-4" />
            View Crew Roster
          </Button>
        </Link>
      </div>
    </div>
  );
}
