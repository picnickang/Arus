import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Beaker,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { EquipmentSelector } from "@/components/shared/EquipmentSelector";
import { useToast } from "@/hooks/use-toast";
import {
  useEvaluatePdmDecisionSupport,
  useGenerateSyntheticTelemetry,
  type OperationalContextOverride,
  type PdmDecisionSupportResult,
  type PdmHealthStatus,
  type SyntheticTelemetryScenario,
  type SyntheticTelemetryResult,
} from "@/features/pdm/hooks/use-decision-support";

const STATUS_LABELS: Record<PdmHealthStatus, string> = {
  optimal: "Optimal",
  watch: "Watch",
  degrading: "Degrading",
  critical: "Critical",
};

const SCENARIOS: Array<{ value: SyntheticTelemetryScenario; label: string }> = [
  { value: "normal", label: "Normal baseline" },
  { value: "heavy_weather", label: "Heavy weather load" },
  { value: "cooling_degradation", label: "Cooling degradation" },
  { value: "bearing_wear", label: "Bearing wear" },
  { value: "fuel_inefficiency", label: "Fuel inefficiency" },
  { value: "sensor_drift", label: "Sensor drift" },
  { value: "sensor_dropout", label: "Sensor dropout" },
  { value: "progressive_failure", label: "Progressive failure" },
  { value: "post_maintenance_recovery", label: "Post-maintenance recovery" },
];

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function statusVariant(status: PdmHealthStatus): "default" | "secondary" | "destructive" | "outline" {
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

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function DecisionResultCard({ result }: { result: PdmDecisionSupportResult }) {
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
              Context-normalized status, RUL, probability mix, efficiency impact, and safe next action.
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
          <Button variant="outline" onClick={() => navigate(`/pdm/equipment/${result.equipmentId}`)}>
            Open Equipment PdM Detail
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SyntheticTelemetryCard({ result }: { result: SyntheticTelemetryResult }) {
  const preview = useMemo(() => result.samples.slice(-8), [result.samples]);

  return (
    <Card data-testid="card-synthetic-telemetry-result">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="h-5 w-5" /> Synthetic Telemetry Scenario
        </CardTitle>
        <CardDescription>
          Generates deterministic test telemetry for feature-store, drift, and PdM inference smoke tests.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Expected status</div>
            <Badge variant={statusVariant(result.summary.expectedStatus)} className="mt-1">
              {STATUS_LABELS[result.summary.expectedStatus]}
            </Badge>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Failure mode</div>
            <div className="font-medium">{result.summary.failureMode}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Samples</div>
            <div className="text-2xl font-bold">{result.summary.sampleCount}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Healthy samples</div>
            <div className="text-2xl font-bold">{result.featureHints.sampleCount}</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5 text-sm">
          <div className="rounded border p-2">
            <span className="text-muted-foreground">Mean temp</span>
            <div className="font-medium">{result.featureHints.meanTemp}</div>
          </div>
          <div className="rounded border p-2">
            <span className="text-muted-foreground">Mean vibration</span>
            <div className="font-medium">{result.featureHints.meanVibration}</div>
          </div>
          <div className="rounded border p-2">
            <span className="text-muted-foreground">RMS vibration</span>
            <div className="font-medium">{result.featureHints.rmsVibration}</div>
          </div>
          <div className="rounded border p-2">
            <span className="text-muted-foreground">Pressure</span>
            <div className="font-medium">{result.featureHints.meanPressure}</div>
          </div>
          <div className="rounded border p-2">
            <span className="text-muted-foreground">Kurtosis</span>
            <div className="font-medium">{result.featureHints.kurtosis}</div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">RPM</th>
                <th className="p-2">Load</th>
                <th className="p-2">Oil temp</th>
                <th className="p-2">Vibration</th>
                <th className="p-2">Fuel</th>
                <th className="p-2">Sensor</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((sample) => (
                <tr key={sample.timestamp} className="border-t">
                  <td className="p-2">{new Date(sample.timestamp).toLocaleTimeString()}</td>
                  <td className="p-2">{sample.rpm}</td>
                  <td className="p-2">{sample.loadFactor}</td>
                  <td className="p-2">{sample.oilTemp}</td>
                  <td className="p-2">{sample.vibrationRms}</td>
                  <td className="p-2">{sample.fuelFlow}</td>
                  <td className="p-2">
                    {sample.sensorHealthy ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DecisionSupportTab() {
  const [equipmentId, setEquipmentId] = useState("");
  const [previousStatus, setPreviousStatus] = useState<PdmHealthStatus | "none">("none");
  const [operatingMode, setOperatingMode] = useState<OperationalContextOverride["operatingMode"]>("transit");
  const [loadFactor, setLoadFactor] = useState("0.72");
  const [weatherSeverity, setWeatherSeverity] = useState("0.2");
  const [seaState, setSeaState] = useState("3");
  const [scenario, setScenario] = useState<SyntheticTelemetryScenario>("bearing_wear");
  const [decisionResult, setDecisionResult] = useState<PdmDecisionSupportResult | null>(null);
  const [syntheticResult, setSyntheticResult] = useState<SyntheticTelemetryResult | null>(null);
  const decisionMutation = useEvaluatePdmDecisionSupport();
  const syntheticMutation = useGenerateSyntheticTelemetry();
  const { toast } = useToast();

  const contextOverride: OperationalContextOverride = {
    operatingMode,
    loadFactor: numberOrUndefined(loadFactor),
    weatherSeverity: numberOrUndefined(weatherSeverity),
    seaState: numberOrUndefined(seaState),
  };

  const runDecision = async () => {
    if (!equipmentId) {
      toast({ title: "Select equipment first", variant: "destructive" });
      return;
    }
    try {
      const result = await decisionMutation.mutateAsync({
        equipmentId,
        previousStatus: previousStatus === "none" ? null : previousStatus,
        minSequenceLength: 8,
        contextOverride,
      });
      setDecisionResult(result);
      toast({ title: "PdM decision support completed" });
    } catch (error: any) {
      toast({ title: "Decision support failed", description: error.message, variant: "destructive" });
    }
  };

  const generateScenario = async () => {
    if (!equipmentId) {
      toast({ title: "Select equipment first", variant: "destructive" });
      return;
    }
    try {
      const result = await syntheticMutation.mutateAsync({
        equipmentId,
        scenario,
        hours: 24,
        intervalMinutes: 15,
        loadFactor: numberOrUndefined(loadFactor),
        weatherSeverity: numberOrUndefined(weatherSeverity),
      });
      setSyntheticResult(result);
      toast({ title: "Synthetic telemetry generated" });
    } catch (error: any) {
      toast({ title: "Synthetic telemetry failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5" /> Hexagonal PdM Decision Support
          </CardTitle>
          <CardDescription>
            Adds a standardized status/RUL/probability contract, vessel operating context, synthetic
            telemetry scenarios, and recommendation safety checks without coupling UI code to model internals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Equipment</Label>
              <EquipmentSelector
                value={equipmentId}
                onValueChange={setEquipmentId}
                placeholder="Select equipment"
                data-testid="select-decision-equipment"
              />
            </div>
            <div className="space-y-2">
              <Label>Previous status</Label>
              <Select value={previousStatus} onValueChange={(value) => setPreviousStatus(value as PdmHealthStatus | "none")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unknown / first run</SelectItem>
                  <SelectItem value="optimal">Optimal</SelectItem>
                  <SelectItem value="watch">Watch</SelectItem>
                  <SelectItem value="degrading">Degrading</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operating mode</Label>
              <Select value={operatingMode} onValueChange={(value) => setOperatingMode(value as OperationalContextOverride["operatingMode"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="harbour">Harbour</SelectItem>
                  <SelectItem value="transit">Transit</SelectItem>
                  <SelectItem value="maneuvering">Maneuvering</SelectItem>
                  <SelectItem value="heavy_weather">Heavy weather</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Load factor</Label>
              <Input value={loadFactor} onChange={(event) => setLoadFactor(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Weather severity</Label>
              <Input value={weatherSeverity} onChange={(event) => setWeatherSeverity(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sea state</Label>
              <Input value={seaState} onChange={(event) => setSeaState(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Synthetic scenario</Label>
              <Select value={scenario} onValueChange={(value) => setScenario(value as SyntheticTelemetryScenario)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={runDecision} disabled={decisionMutation.isPending || !equipmentId}>
              {decisionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Decision Support
            </Button>
            <Button
              variant="outline"
              onClick={generateScenario}
              disabled={syntheticMutation.isPending || !equipmentId}
            >
              {syntheticMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Synthetic Scenario
            </Button>
          </div>
        </CardContent>
      </Card>

      {decisionResult && <DecisionResultCard result={decisionResult} />}
      {syntheticResult && <SyntheticTelemetryCard result={syntheticResult} />}
    </div>
  );
}
