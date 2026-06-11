import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Wrench,
  DollarSign,
  Shield,
  ChevronRight,
  Activity,
  Sparkles,
  Brain,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryBoundary } from "@/components/patterns/QueryBoundary";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

interface FailurePrediction {
  equipmentId?: string;
  equipmentName?: string | null;
  failureProbability?: number | null;
  predictedFailureDate?: string | null;
  remainingUsefulLife?: number | null;
  riskLevel?: "low" | "medium" | "high" | "critical" | string | null;
  maintenanceRecommendations?: Array<{ action?: string; priority?: string }> | null;
  whyItMatters?: string | null;
}

interface FailurePredictionsResponse {
  results?: FailurePrediction[];
  metadata?: {
    highRiskCount?: number;
    criticalRiskCount?: number;
  };
}

function PredictiveInsightsCard() {
  const { data, isLoading, error } = useQuery<FailurePredictionsResponse>({
    queryKey: ["/api/analytics/failure-predictions"],
    staleTime: 120_000,
  });

  const top = (data?.results ?? [])[0];

  return (
    <QueryBoundary
      isLoading={isLoading}
      error={error}
      loadingFallback={<Skeleton className="h-32" data-testid="predictive-insights-loading" />}
      errorFallback={
        <Card data-testid="predictive-insights-error">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Predictive insights unavailable right now.
          </CardContent>
        </Card>
      }
      data={top}
      emptyFallback={
        <Card data-testid="predictive-insights-empty">
          <CardContent className="p-4 text-sm text-muted-foreground">
            No active failure predictions across the fleet.
          </CardContent>
        </Card>
      }
    >
      {(top) => {
        const prob =
          typeof top.failureProbability === "number"
            ? Math.round(top.failureProbability * (top.failureProbability <= 1 ? 100 : 1))
            : null;
        const rul = top.remainingUsefulLife;
        const eta = top.predictedFailureDate
          ? new Date(top.predictedFailureDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : typeof rul === "number"
            ? `~${Math.max(0, Math.round(rul))} days`
            : "—";

        const riskTone =
          top.riskLevel === "critical"
            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
            : top.riskLevel === "high"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-blue-500/15 text-blue-700 dark:text-blue-300";

        const recs = (top.maintenanceRecommendations ?? []).slice(0, 4);

        return (
          <div data-testid="predictive-insights">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-violet-500" />
              <h2 className="text-sm font-semibold">Predictive Insights</h2>
            </div>
            <Card className="bg-gradient-to-br from-violet-500/5 to-transparent border-violet-500/15">
              <CardContent className="p-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold">
                        {top.equipmentName ?? "Equipment"}
                      </span>
                      {top.riskLevel && (
                        <Badge
                          variant="outline"
                          className={riskTone}
                          data-testid="predictive-risk-badge"
                        >
                          {top.riskLevel.toUpperCase()}
                        </Badge>
                      )}
                      {prob !== null && (
                        <Badge
                          variant="outline"
                          className="bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        >
                          {prob}% failure probability
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> ETA: {eta}
                      </span>
                    </div>
                    {recs.length > 0 && (
                      <ul className="mt-3 space-y-1" data-testid="predictive-recommendations">
                        {recs.map((r, i) => (
                          <li
                            key={i}
                            className="text-sm flex items-start gap-2"
                            data-testid={`predictive-rec-${i}`}
                          >
                            <span className="text-violet-500 mt-0.5 shrink-0">•</span>
                            <span>{r.action ?? "Recommended action"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Link href="/work-orders?source=predictive">
                    <Button size="sm" className="gap-1" data-testid="button-predictive-create-wo">
                      <Wrench className="h-3 w-3" /> Create Work Order
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

function HeadlineMetric({
  label,
  value,
  icon: Icon,
  color,
  domain,
  testId,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  domain: string;
  testId: string;
}) {
  return (
    <div
      className="text-center p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors cursor-default"
      data-testid={testId}
    >
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground font-medium">{label}</div>
      <div className="text-[9px] text-muted-foreground/60 mt-0.5">{domain}</div>
    </div>
  );
}

function DomainStrip({
  title,
  icon: Icon,
  stats,
  href,
  color,
  testId,
}: {
  title: string;
  icon: React.ElementType;
  stats: string[];
  href: string;
  color: string;
  testId: string;
}) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/30 transition-colors`}
      data-testid={testId}
    >
      <Icon className={`h-5 w-5 ${color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{stats.join(" · ")}</div>
      </div>
      <Link href={href}>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-xs gap-1"
          data-testid={`${testId}-open`}
        >
          Open <ChevronRight className="h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}

interface EquipmentHealthItem {
  healthIndex?: number;
  healthScore?: number;
}

interface WorkOrderSummary {
  openCount?: number;
  open?: number;
  overdueCount?: number;
  overdue?: number;
  completionRate?: number;
}

interface CostSummary {
  latestMonthCost?: number;
  monthlyChange?: number;
  totalSavings?: number;
}

interface IntegrityStatus {
  healthPercentage?: number;
  healthScore?: number;
  issueCount?: number;
}

function KeyFindings({
  equipmentHealth,
  workOrderStats,
  costData,
  dataIntegrity,
  hasErrors,
}: {
  equipmentHealth: EquipmentHealthItem[];
  workOrderStats: { open: number; overdue: number; completionRate: number };
  costData: { monthlySpend: number; monthlyChange: number; totalSavings: number };
  dataIntegrity: { healthScore: number | null; issueCount: number };
  hasErrors: boolean;
}) {
  const findings: string[] = [];

  // Only items with a real score are classified — unscored equipment is
  // neither healthy nor critical, it is unscored.
  const scores = equipmentHealth
    .map((e) => e.healthIndex ?? e.healthScore)
    .filter((h): h is number => h != null);
  const criticalCount = scores.filter((h) => h < 40).length;
  const warningCount = scores.filter((h) => h >= 40 && h < 70).length;

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

  if (dataIntegrity.healthScore != null && dataIntegrity.healthScore < 95) {
    findings.push(
      `Data quality at ${dataIntegrity.healthScore}% — ${dataIntegrity.issueCount} validation issue${dataIntegrity.issueCount > 1 ? "s" : ""} detected.`
    );
  }

  if (findings.length === 0) {
    findings.push(
      hasErrors
        ? "Findings unavailable — some analytics data failed to load. Results will refresh automatically once data is restored."
        : "All systems operating within normal parameters. No critical findings."
    );
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
              <li
                key={i}
                className="text-sm text-foreground flex items-start gap-2"
                data-testid={`finding-${i}`}
              >
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
  const {
    data: equipmentHealth = [],
    isLoading: healthLoading,
    error: healthError,
  } = useQuery<EquipmentHealthItem[]>({
    queryKey: ["/api/equipment/health"],
    staleTime: 60000,
  });

  const { data: workOrderSummary, error: woError } = useQuery<WorkOrderSummary>({
    queryKey: ["/api/work-orders/summary"],
    staleTime: 60000,
  });

  const { data: costSummary, error: costError } = useQuery<CostSummary>({
    queryKey: ["/api/pdm/cost-savings/summary"],
    staleTime: 120000,
  });

  const { data: integrityStatus, error: integrityError } = useQuery<IntegrityStatus>({
    queryKey: ["/api/reconciliation/status"],
    staleTime: 120000,
  });

  const hasErrors = healthError || woError || costError || integrityError;

  const avgHealth = useMemo(() => {
    const scores = (equipmentHealth ?? [])
      .map((e) => e.healthIndex ?? e.healthScore)
      .filter((h): h is number => h != null);
    if (scores.length === 0) {
      return null;
    }
    return Math.round(scores.reduce((s, h) => s + h, 0) / scores.length);
  }, [equipmentHealth]);

  const criticalCount = equipmentHealth.filter((e) => {
    const h = e.healthIndex ?? e.healthScore;
    return h != null && h < 40;
  }).length;

  const openWOs = workOrderSummary?.openCount ?? workOrderSummary?.open ?? 0;
  const overdueWOs = workOrderSummary?.overdueCount ?? workOrderSummary?.overdue ?? 0;
  const completionRate = workOrderSummary?.completionRate ?? 0;

  const monthlySpend = costSummary?.latestMonthCost ?? 0;
  const monthlyChange = costSummary?.monthlyChange ?? 0;
  const totalSavings = costSummary?.totalSavings ?? 0;

  const dataHealthScore = integrityStatus?.healthPercentage ?? integrityStatus?.healthScore ?? null;
  const dataIssueCount = integrityStatus?.issueCount ?? 0;

  if (healthLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
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
    <PermissionGate
      resource="analytics_dashboard"
      action="view"
      fallback={<PagePermissionDenied />}
    >
      <div className="p-4 lg:p-6 space-y-6" data-testid="analytics-hub">
        <div>
          <h1 className="text-xl font-bold">Analytics & Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cross-domain fleet intelligence and performance analysis
          </p>
        </div>

        {hasErrors && (
          <div
            className="flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
            data-testid="error-banner"
          >
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                Some data could not be loaded
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[
                  healthError && "equipment health",
                  woError && "work orders",
                  costError && "cost savings",
                  integrityError && "data integrity",
                ]
                  .filter(Boolean)
                  .join(", ")}{" "}
                — values shown may be incomplete. Data will retry automatically.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            value={dataHealthScore == null ? "—" : `${dataHealthScore}%`}
            icon={Shield}
            color={
              dataHealthScore == null
                ? "text-muted-foreground"
                : dataHealthScore >= 95
                  ? "text-green-600"
                  : "text-yellow-600"
            }
            domain="Integrity"
            testId="headline-data"
          />
        </div>

        <PredictiveInsightsCard />

        <KeyFindings
          equipmentHealth={equipmentHealth}
          workOrderStats={{ open: openWOs, overdue: overdueWOs, completionRate }}
          costData={{ monthlySpend, monthlyChange, totalSavings }}
          dataIntegrity={{ healthScore: dataHealthScore, issueCount: dataIssueCount }}
          hasErrors={Boolean(hasErrors)}
        />

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Domains</h2>

          <DomainStrip
            title="Operations"
            icon={Activity}
            stats={[
              `${criticalCount} critical equipment`,
              `${equipmentHealth.length} total monitored`,
              avgHealth == null
                ? "No health scores yet"
                : avgHealth >= 80
                  ? "Fleet healthy"
                  : "Needs attention",
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
              totalSavings > 0
                ? `$${(totalSavings / 1000).toFixed(0)}k total savings`
                : "No savings data",
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
