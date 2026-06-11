import { useLocation } from "wouter";
import { Activity, Clock, ShieldCheck, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type {
  PdmDecisionSupportResult,
  PdmHealthStatus,
} from "@/features/pdm/hooks/use-decision-support";

export const STATUS_LABELS: Record<PdmHealthStatus, string> = {
  optimal: "Optimal",
  watch: "Watch",
  degrading: "Degrading",
  critical: "Critical",
};

export function statusVariant(
  status: PdmHealthStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "critical") {
    return "destructive";
  }
  if (status === "degrading") {
    return "secondary";
  }
  if (status === "watch") {
    return "outline";
  }
  return "default";
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function DecisionResultCard({ result }: { result: PdmDecisionSupportResult }) {
  const [, navigate] = useLocation();
  const topProbability = Object.entries(result.probabilities).sort((a, b) => b[1] - a[1])[0];

  return (
    <Card data-testid="card-pdm-decision-result">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Standardized PdM Decision
            </CardTitle>
            <CardDescription>
              Context-normalized status, RUL, probability mix, efficiency impact, and safe next
              action.
            </CardDescription>
          </div>
          <Badge variant={statusVariant(result.predictedStatus)} className="w-fit text-sm">
            {STATUS_LABELS[result.predictedStatus]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">RUL</div>
            <div className="text-2xl font-bold">{result.predictedRulHours}h</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Confidence</div>
            <div className="text-2xl font-bold">{percent(result.confidence)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Decision score</div>
            <div className="text-2xl font-bold">{percent(result.decisionScore)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Efficiency loss</div>
            <div className="text-2xl font-bold">
              {result.performanceIndicators.efficiencyLossPercent}%
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="font-medium">Probability mix</div>
            {(Object.keys(result.probabilities) as PdmHealthStatus[]).map((status) => (
              <div key={status} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{STATUS_LABELS[status]}</span>
                  <span>{percent(result.probabilities[status])}</span>
                </div>
                <Progress value={result.probabilities[status] * 100} />
              </div>
            ))}
            <div className="text-xs text-muted-foreground">
              Highest probability: {STATUS_LABELS[topProbability?.[0] as PdmHealthStatus] ?? "n/a"}
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="font-medium">Operational context</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Mode</span>
              <span>{result.operatingContext.operatingMode}</span>
              <span className="text-muted-foreground">Load factor</span>
              <span>{result.operatingContext.loadFactor.toFixed(2)}</span>
              <span className="text-muted-foreground">Weather severity</span>
              <span>{result.operatingContext.weatherSeverity.toFixed(2)}</span>
              <span className="text-muted-foreground">Sea state</span>
              <span>{result.operatingContext.seaState}</span>
              <span className="text-muted-foreground">Data quality</span>
              <span>{percent(result.performanceIndicators.dataQualityScore)}</span>
            </div>
            {!result.performanceIndicators.minimumSequenceSatisfied && (
              <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                Sensor window is short: {result.performanceIndicators.sequenceLength}/
                {result.performanceIndicators.requiredSequenceLength} snapshots.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" /> Safety review
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.safetyReview.decision === "blocked" ? "destructive" : "outline"}>
              {result.safetyReview.decision.replace(/_/g, " ")}
            </Badge>
            {result.alertNeeded && <Badge variant="destructive">Alert needed</Badge>}
          </div>
          {result.safetyReview.reasons.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {result.safetyReview.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <div className="font-medium">Recommended actions</div>
          {result.recommendations.map((recommendation, index) => (
            <div key={`${recommendation.action}-${index}`} className="rounded-lg border p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{recommendation.action}</div>
                  <div className="text-sm text-muted-foreground">{recommendation.reason}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{recommendation.priority}</Badge>
                  <Badge variant="outline">
                    <Clock className="mr-1 h-3 w-3" /> {recommendation.dueInHours}h
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/work-orders?action=create&equipmentId=${result.equipmentId}`)}
          >
            <Wrench className="mr-2 h-4 w-4" /> Create Work Order
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/pdm/equipment/${result.equipmentId}`)}
          >
            Open Equipment PdM Detail
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
