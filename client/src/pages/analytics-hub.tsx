import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Wrench, DollarSign, Shield, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";
import {
  DomainStrip,
  HeadlineMetric,
  KeyFindings,
  PredictiveInsightsCard,
  type AnalyticsHubCostSummary,
  type AnalyticsHubWorkOrderSummary,
  type EquipmentHealthItem,
  type IntegrityStatus,
} from "./analytics-hub-parts";

export default function AnalyticsHub() {
  const {
    data: equipmentHealth = [],
    isLoading: healthLoading,
    error: healthError,
  } = useQuery<EquipmentHealthItem[]>({
    queryKey: ["/api/equipment/health"],
    staleTime: 60000,
  });

  const { data: workOrderSummary, error: woError } = useQuery<AnalyticsHubWorkOrderSummary>({
    queryKey: ["/api/work-orders/summary"],
    staleTime: 60000,
  });

  const { data: costSummary, error: costError } = useQuery<AnalyticsHubCostSummary>({
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
