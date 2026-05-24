import { Card, CardContent } from "@/components/ui/card";
import { useModels } from "@/features/pdm/hooks/use-model-registry";
import { useDriftSummary } from "@/features/pdm/hooks/use-model-monitoring";
import { usePredictionGovernance } from "@/features/pdm/hooks/usePredictionGovernance";

export function SummaryDashboard() {
  const { data: models } = useModels();
  const { data: pendingPredictions } = usePredictionGovernance("pending");
  const { data: allPredictions } = usePredictionGovernance();
  const { data: driftSummary } = useDriftSummary();

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
    </div>
  );
}
