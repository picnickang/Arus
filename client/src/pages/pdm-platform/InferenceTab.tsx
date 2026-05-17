import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRunInference, usePredictionExplanations } from "@/features/pdm/hooks/use-inference";
import { EquipmentSelector } from "@/components/shared/EquipmentSelector";
import { EquipmentLink, TimestampBadge } from "./_shared";

export function InferenceTab() {
  const [equipmentId, setEquipmentId] = useState("");
  const [lastPredictionId, setLastPredictionId] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastInferredEquipmentId, setLastInferredEquipmentId] = useState("");
  const [inferenceTime, setInferenceTime] = useState<Date | null>(null);
  const inferenceMutation = useRunInference();
  const { data: explanations } = usePredictionExplanations(lastPredictionId);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleInference = async () => {
    if (!equipmentId) {
      return;
    }
    try {
      const result: any = await inferenceMutation.mutateAsync({ equipmentId });
      setLastResult(result);
      setLastInferredEquipmentId(equipmentId);
      setInferenceTime(new Date());
      if (result.inferenceRun?.predictionId) {
        setLastPredictionId(result.inferenceRun.predictionId);
      }
      toast({ title: "Inference completed" });
    } catch {
      toast({ title: "Inference failed", variant: "destructive" });
    }
  };

  const riskColor = (level: string) =>
    level === "critical" ? "destructive" : level === "high" ? "secondary" : "default";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-72">
          <EquipmentSelector
            value={equipmentId}
            onValueChange={setEquipmentId}
            placeholder="Select equipment"
            data-testid="input-equipment-id-inference"
          />
        </div>
        <Button
          data-testid="button-run-inference"
          onClick={handleInference}
          disabled={!equipmentId || inferenceMutation.isPending}
        >
          {inferenceMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          Run Inference
        </Button>
      </div>

      {lastResult?.prediction && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Prediction: <EquipmentLink equipmentId={lastInferredEquipmentId} />
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <TimestampBadge label="Ran" timestamp={inferenceTime} />
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {lastResult.inferenceRun?.status === "completed" ? (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  ) : null}
                  {lastResult.inferenceRun?.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Failure Probability</div>
                <div className="text-2xl font-bold" data-testid="text-failure-probability">
                  {(lastResult.prediction.failureProbability * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Risk Level</div>
                <Badge
                  variant={riskColor(lastResult.prediction.riskLevel)}
                  data-testid="text-risk-level"
                  className="mt-1"
                >
                  {lastResult.prediction.riskLevel}
                </Badge>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Remaining Useful Life</div>
                <div className="text-2xl font-bold" data-testid="text-rul">
                  {lastResult.prediction.remainingUsefulLife}d
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Latency</div>
                <div className="text-2xl font-bold">{lastResult.inferenceRun?.latencyMs}ms</div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                data-testid="button-create-wo-inference"
                variant="outline"
                onClick={() =>
                  navigate(`/work-orders?action=create&equipmentId=${lastInferredEquipmentId}`)
                }
              >
                <Wrench className="w-4 h-4 mr-2" />
                Create Work Order
              </Button>
            </div>

            {lastResult.prediction.recommendations?.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Recommendations:</div>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {lastResult.prediction.recommendations.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {Array.isArray(explanations) && explanations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prediction Explanations</CardTitle>
            <CardDescription>
              Feature contributions to prediction — normalized importance with deviation direction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {explanations.map((e: any) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 p-2 rounded border"
                  data-testid={`row-explanation-${e.featureName}`}
                >
                  <div className="w-32 font-medium text-sm">{e.featureName}</div>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${e.importance * 100}%` }}
                    />
                  </div>
                  <div className="text-sm text-right w-16">{(e.importance * 100).toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground w-24 text-right">
                    {e.featureValue?.toFixed(2)}{" "}
                    <span className="text-xs">/ {e.baselineValue?.toFixed(2)}</span>
                  </div>
                  {e.direction === "increasing" ? (
                    <TrendingUp className="w-4 h-4 text-red-500" />
                  ) : e.direction === "decreasing" ? (
                    <TrendingDown className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
