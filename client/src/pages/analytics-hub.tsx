import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Heart, AlertTriangle, Wrench, DollarSign, Shield,
  ChevronRight, Activity, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

function HeadlineMetric({
  label, value, icon: Icon, color, domain, testId,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  domain: string;
  testId: string;
}) {
  return (
    <div className="text-center p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors cursor-default" data-testid={testId}>
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground font-medium">{label}</div>
      <div className="text-[9px] text-muted-foreground/60 mt-0.5">{domain}</div>
    </div>
  );
}

function DomainStrip({
  title, icon: Icon, stats, href, color, testId,
}: {
  title: string;
  icon: React.ElementType;
  stats: string[];
  href: string;
  color: string;
  testId: string;
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/30 transition-colors`} data-testid={testId}>
      <Icon className={`h-5 w-5 ${color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {stats.join(" · ")}
        </div>
      </div>
      <Link href={href}>
        <Button variant="outline" size="sm" className="shrink-0 text-xs gap-1" data-testid={`${testId}-open`}>
          Open <ChevronRight className="h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}

function KeyFindings({
  equipmentHealth,
  workOrderStats,
  costData,
  dataIntegrity,
}: {
  equipmentHealth: any[];
  workOrderStats: { open: number; overdue: number; completionRate: number };
  costData: { monthlySpend: number; monthlyChange: number; totalSavings: number };
  dataIntegrity: { healthScore: number; issueCount: number };
}) {
  const findings: string[] = [];

  const criticalCount = equipmentHealth.filter((e) => (e.healthIndex ?? e.healthScore ?? 100) < 40).length;
  const warningCount = equipmentHealth.filter((e) => {
    const h = e.healthIndex ?? e.healthScore ?? 100;
    return h >= 40 && h < 70;
  }).length;

  if (criticalCount > 0) {
    findings.push(
      `${criticalCount} equipment item${criticalCount > 1 ? "s" : ""} in critical condition — immediate maintenance action recommended.`
    );
  }

  if (warningCount > 3) {
    findings.push(
      `${warningCount} equipment items showing degraded health — schedule preventive maintenance to avoid failures.`
    );
  }

  if (costData.monthlyChange > 10) {
    findings.push(
      `Maintenance costs up ${costData.monthlyChange.toFixed(0)}% this month — investigate root cause in Finance mode.`
    );
  }

  if (costData.totalSavings > 50000) {
    findings.push(
      `$${(costData.totalSavings / 1000).toFixed(0)}k saved through predictive maintenance this year.`
    );
  }

  if (workOrderStats.overdue > 0) {
    findings.push(
      `${workOrderStats.overdue} overdue work order${workOrderStats.overdue > 1 ? "s" : ""} — prioritize completion to maintain fleet readiness.`
    );
  }

  if (dataIntegrity.healthScore < 95) {
    findings.push(
      `Data quality at ${dataIntegrity.healthScore}% — ${dataIntegrity.issueCount} validation issue${dataIntegrity.issueCount > 1 ? "s" : ""} detected.`
    );
  }

  if (findings.length === 0) {
    findings.push("All systems operating within normal parameters. No critical findings.");
  }

  return (
    <div data-testid="key-findings">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-sky-500" />
        <h2 className="text-sm font-semibold">Key Findings</h2>
      </div>
      <Card className="bg-gradient-to-br from-sky-500/5 to-transparent border-sky-500/15">
        <CardContent className="p-4">
          <ul className="space-y-2">
            {findings.slice(0, 5).map((finding, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2" data-testid={`finding-${i}`}>
                <span className="text-sky-500 mt-0.5 shrink-0">•</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnalyticsHub() {
  const { data: equipmentHealth = [], isLoading: healthLoading, error: healthError } = useQuery<any[]>({
    queryKey: ["/api/equipment/health"],
    staleTime: 60000,
  });

  const { data: workOrderSummary, error: woError } = useQuery<any>({
    queryKey: ["/api/work-orders/summary"],
    staleTime: 60000,
  });

  const { data: costSummary, error: costError } = useQuery<any>({
    queryKey: ["/api/pdm/cost-savings/summary"],
    staleTime: 120000,
  });

  const { data: integrityStatus, error: integrityError } = useQuery<any>({
    queryKey: ["/api/reconciliation/status"],
    staleTime: 120000,
  });

  const hasErrors = healthError || woError || costError || integrityError;

  const avgHealth = useMemo(() => {
    if (!equipmentHealth || equipmentHealth.length === 0) {return 0;}
    const sum = equipmentHealth.reduce((s: number, e: any) => s + (e.healthIndex ?? e.healthScore ?? 100), 0);
    return Math.round(sum / equipmentHealth.length);
  }, [equipmentHealth]);

  const criticalCount = equipmentHealth.filter((e: any) => (e.healthIndex ?? e.healthScore ?? 100) < 40).length;

  const openWOs = workOrderSummary?.openCount ?? workOrderSummary?.open ?? 0;
  const overdueWOs = workOrderSummary?.overdueCount ?? workOrderSummary?.overdue ?? 0;
  const completionRate = workOrderSummary?.completionRate ?? 0;

  const monthlySpend = costSummary?.latestMonthCost ?? 0;
  const monthlyChange = costSummary?.monthlyChange ?? 0;
  const totalSavings = costSummary?.totalSavings ?? 0;

  const dataHealthScore = integrityStatus?.healthPercentage ?? integrityStatus?.healthScore ?? 100;
  const dataIssueCount = integrityStatus?.issueCount ?? 0;

  if (healthLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <PermissionGate resource="analytics_dashboard" action="view" fallback={<PagePermissionDenied />}>
      <div className="p-4 lg:p-6 space-y-6" data-testid="analytics-hub">
        <div>
          <h1 className="text-xl font-bold">Analytics & Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cross-domain fleet intelligence and performance analysis
          </p>
        </div>

        {hasErrors && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10" data-testid="error-banner">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Some data could not be loaded</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[healthError && "equipment health", woError && "work orders", costError && "cost savings", integrityError && "data integrity"].filter(Boolean).join(", ")} — values shown may be incomplete. Data will retry automatically.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <HeadlineMetric
            label="Fleet Health"
            value={`${avgHealth}%`}
            icon={Heart}
            color={avgHealth >= 80 ? "text-green-600" : avgHealth >= 60 ? "text-yellow-600" : "text-red-600"}
            domain="Operations"
            testId="headline-health"
          />
          <HeadlineMetric
            label="Risk Items"
            value={criticalCount}
            icon={AlertTriangle}
            color={criticalCount > 0 ? "text-red-600" : "text-green-600"}
            domain="Operations"
            testId="headline-risk"
          />
          <HeadlineMetric
            label="WO Completion"
            value={`${completionRate}%`}
            icon={Wrench}
            color={completionRate >= 80 ? "text-green-600" : "text-yellow-600"}
            domain="Maintenance"
            testId="headline-completion"
          />
          <HeadlineMetric
            label="Monthly Spend"
            value={`$${(monthlySpend / 1000).toFixed(0)}k`}
            icon={DollarSign}
            color={monthlyChange > 10 ? "text-red-600" : "text-blue-600"}
            domain="Finance"
            testId="headline-spend"
          />
          <HeadlineMetric
            label="Data Quality"
            value={`${dataHealthScore}%`}
            icon={Shield}
            color={dataHealthScore >= 95 ? "text-green-600" : "text-yellow-600"}
            domain="Integrity"
            testId="headline-data"
          />
        </div>

        <KeyFindings
          equipmentHealth={equipmentHealth}
          workOrderStats={{ open: openWOs, overdue: overdueWOs, completionRate }}
          costData={{ monthlySpend, monthlyChange, totalSavings }}
          dataIntegrity={{ healthScore: dataHealthScore, issueCount: dataIssueCount }}
        />

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Domains</h2>

          <DomainStrip
            title="Operations"
            icon={Activity}
            stats={[
              `${criticalCount} critical equipment`,
              `${equipmentHealth.length} total monitored`,
              avgHealth >= 80 ? "Fleet healthy" : "Needs attention",
            ]}
            href="/analytics/operations"
            color="text-blue-600"
            testId="domain-operations"
          />

          <DomainStrip
            title="Maintenance"
            icon={Wrench}
            stats={[
              `${openWOs} open WOs${overdueWOs > 0 ? ` (${overdueWOs} overdue)` : ""}`,
              `${completionRate}% completion rate`,
              totalSavings > 0 ? `$${(totalSavings / 1000).toFixed(0)}k saved` : "No savings data",
            ]}
            href="/analytics/maintenance"
            color="text-amber-600"
            testId="domain-maintenance"
          />

          <DomainStrip
            title="Finance"
            icon={DollarSign}
            stats={[
              `$${(monthlySpend / 1000).toFixed(0)}k monthly${monthlyChange !== 0 ? ` (${monthlyChange > 0 ? "+" : ""}${monthlyChange.toFixed(0)}%)` : ""}`,
              totalSavings > 0 ? `$${(totalSavings / 1000).toFixed(0)}k total savings` : "No savings data",
            ]}
            href="/analytics/finance"
            color="text-green-600"
            testId="domain-finance"
          />

          <DomainStrip
            title="Data Integrity"
            icon={Shield}
            stats={[
              `${dataHealthScore}% health score`,
              `${dataIssueCount} validation issue${dataIssueCount !== 1 ? "s" : ""}`,
            ]}
            href="/analytics/data-integrity"
            color="text-purple-600"
            testId="domain-integrity"
          />
        </div>
      </div>
    </PermissionGate>
  );
}
