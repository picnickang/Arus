import type { ElementType } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Wrench, ChevronRight, Sparkles, Brain, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryBoundary } from "@/components/patterns/QueryBoundary";

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

export interface EquipmentHealthItem {
  healthIndex?: number;
  healthScore?: number;
}

export interface AnalyticsHubWorkOrderSummary {
  openCount?: number;
  open?: number;
  overdueCount?: number;
  overdue?: number;
  completionRate?: number;
}

export interface AnalyticsHubCostSummary {
  latestMonthCost?: number;
  monthlyChange?: number;
  totalSavings?: number;
}

export interface IntegrityStatus {
  healthPercentage?: number;
  healthScore?: number;
  issueCount?: number;
}

export function PredictiveInsightsCard() {
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

export function HeadlineMetric({
  label,
  value,
  icon: Icon,
  color,
  domain,
  testId,
}: {
  label: string;
  value: string | number;
  icon: ElementType;
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

export function DomainStrip({
  title,
  icon: Icon,
  stats,
  href,
  color,
  testId,
}: {
  title: string;
  icon: ElementType;
  stats: string[];
  href: string;
  color: string;
  testId: string;
}) {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/30 transition-colors"
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

export function KeyFindings({
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
