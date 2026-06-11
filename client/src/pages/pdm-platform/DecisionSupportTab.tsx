import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Beaker, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EquipmentSelector } from "@/components/shared/EquipmentSelector";
import { DecisionResultCard, STATUS_LABELS, statusVariant } from "./DecisionResultCard";
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

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
          Generates deterministic test telemetry for feature-store, drift, and PdM inference smoke
          tests.
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
  const [operatingMode, setOperatingMode] =
    useState<OperationalContextOverride["operatingMode"]>("transit");
  const [loadFactor, setLoadFactor] = useState("0.72");
  const [weatherSeverity, setWeatherSeverity] = useState("0.2");
  const [seaState, setSeaState] = useState("3");
  const [scenario, setScenario] = useState<SyntheticTelemetryScenario>("bearing_wear");
  const [decisionResult, setDecisionResult] = useState<PdmDecisionSupportResult | null>(null);
  const [syntheticResult, setSyntheticResult] = useState<SyntheticTelemetryResult | null>(null);
  const decisionMutation = useEvaluatePdmDecisionSupport();
  const syntheticMutation = useGenerateSyntheticTelemetry();
  const { toast } = useToast();

  const loadFactorNum = numberOrUndefined(loadFactor);
  const weatherSeverityNum = numberOrUndefined(weatherSeverity);
  const seaStateNum = numberOrUndefined(seaState);
  const contextOverride: OperationalContextOverride = {
    ...(operatingMode !== undefined && { operatingMode }),
    ...(loadFactorNum !== undefined && { loadFactor: loadFactorNum }),
    ...(weatherSeverityNum !== undefined && { weatherSeverity: weatherSeverityNum }),
    ...(seaStateNum !== undefined && { seaState: seaStateNum }),
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Decision support failed", description: message, variant: "destructive" });
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
        ...(loadFactorNum !== undefined && { loadFactor: loadFactorNum }),
        ...(weatherSeverityNum !== undefined && { weatherSeverity: weatherSeverityNum }),
      });
      setSyntheticResult(result);
      toast({ title: "Synthetic telemetry generated" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Synthetic telemetry failed", description: message, variant: "destructive" });
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
            telemetry scenarios, and recommendation safety checks without coupling UI code to model
            internals.
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
              <Select
                value={previousStatus}
                onValueChange={(value) => setPreviousStatus(value as PdmHealthStatus | "none")}
              >
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
              <Select
                value={operatingMode}
                onValueChange={(value) =>
                  setOperatingMode(value as OperationalContextOverride["operatingMode"])
                }
              >
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
              <Input
                value={weatherSeverity}
                onChange={(event) => setWeatherSeverity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sea state</Label>
              <Input value={seaState} onChange={(event) => setSeaState(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Synthetic scenario</Label>
              <Select
                value={scenario}
                onValueChange={(value) => setScenario(value as SyntheticTelemetryScenario)}
              >
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
