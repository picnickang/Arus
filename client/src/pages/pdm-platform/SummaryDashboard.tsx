import { Card, CardContent } from "@/components/ui/card";
import { useModels } from "@/features/pdm/hooks/use-model-registry";
import { useDriftSummary } from "@/features/pdm/hooks/use-model-monitoring";
import { usePredictionGovernance } from "@/features/pdm/hooks/usePredictionGovernance";
import { useCostSavingsSummary } from "@/features/pdm/hooks/use-pdm-dashboard";

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return `$${Math.round(value)}`;
}

export function SummaryDashboard() {
  const { data: models } = useModels();
  const { data: pendingPredictions } = usePredictionGovernance("pending");
  const { data: allPredictions } = usePredictionGovernance();
  const { data: driftSummary } = useDriftSummary();
  const { data: costSavings } = useCostSavingsSummary(12);

  const modelsList: Array<{ status?: string }> = Array.isArray(models) ? models : [];
  const deployedCount = modelsList.filter((m) => m.status === "deployed").length;
  const totalModels = modelsList.length;
  const pendingCount = Array.isArray(pendingPredictions) ? pendingPredictions.length : 0;
  const allPredictionsList: Array<{
    predictionTimestamp?: string | Date | null;
    createdAt?: string | Date | null;
  }> = Array.isArray(allPredictions) ? allPredictions : [];
  const totalPredictions = allPredictionsList.length;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentPredictions = allPredictionsList.filter((p) => {
    const ts = p.predictionTimestamp || p.createdAt;
    return ts && new Date(ts) >= sevenDaysAgo;
  }).length;

  const driftAlertCount = driftSummary?.alertCount ?? 0;
  const monitoredVersions = driftSummary?.monitoredVersions ?? 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Deployed Models</div>
          <div className="text-2xl font-bold" data-testid="text-summary-deployed">
            {deployedCount}
          </div>
          <div className="text-xs text-muted-foreground">{totalModels} total registered</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Drift Alerts</div>
          <div className="text-2xl font-bold" data-testid="text-summary-drift-alerts">
            {driftAlertCount}
          </div>
          <div className="text-xs text-muted-foreground">
            {monitoredVersions} versions monitored
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Pending Reviews</div>
          <div className="text-2xl font-bold" data-testid="text-summary-pending">
            {pendingCount}
          </div>
          <div className="text-xs text-muted-foreground">governance queue</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Recent Predictions</div>
          <div className="text-2xl font-bold" data-testid="text-summary-recent-predictions">
            {recentPredictions}
          </div>
          <div className="text-xs text-muted-foreground">
            {totalPredictions} total (last 7 days)
          </div>
        </CardContent>
      </Card>
      {/* Value strip — only rendered when real savings rows exist; the
          figures are estimates (probability × repair cost), labeled so. */}
      {costSavings && costSavings.savingsCount > 0 && (
        <Card className="col-span-2 md:col-span-4 border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-[10px] font-bold tracking-wider text-emerald-600 uppercase">
              PdM value (12 mo)
            </span>
            <span className="text-sm font-bold" data-testid="text-summary-savings-total">
              {formatUsd(costSavings.totalSavings)} saved
            </span>
            <span className="text-sm text-muted-foreground">
              · {costSavings.savingsCount} incidents averted
            </span>
            <span className="text-sm text-muted-foreground">
              · {Math.round(costSavings.totalDowntimePrevented)}h downtime prevented
            </span>
            <span className="ml-auto rounded border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              ESTIMATES — probability × repair cost
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
