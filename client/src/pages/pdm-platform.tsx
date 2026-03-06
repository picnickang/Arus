import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Database, BarChart3, Box, Zap, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw, ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLatestFeatures, useComputeFeatures } from "@/features/pdm/hooks/use-feature-store";
import { useFleetBaselines, useFleetComparison, useComputeBaselines } from "@/features/pdm/hooks/use-fleet-analytics";
import { useModels, useModelVersions, useActiveDeployment } from "@/features/pdm/hooks/use-model-registry";
import { useRunInference, usePredictionExplanations } from "@/features/pdm/hooks/use-inference";
import { useModelDrift, useComputeDrift } from "@/features/pdm/hooks/use-model-monitoring";

function FeatureStoreTab() {
  const [equipmentId, setEquipmentId] = useState("");
  const { data: features, isLoading, refetch } = useLatestFeatures(equipmentId);
  const computeMutation = useComputeFeatures();
  const { toast } = useToast();

  const handleCompute = async () => {
    if (!equipmentId) return;
    try {
      await computeMutation.mutateAsync({ equipmentId });
      toast({ title: "Features computed successfully" });
      refetch();
    } catch {
      toast({ title: "Failed to compute features", variant: "destructive" });
    }
  };

  const hasFeatures = features && !features.message;
  const sampleCount = hasFeatures ? features.sampleCount : 0;
  const dataSource = sampleCount > 0 ? "telemetry" : "stub";

  const featureEntries = hasFeatures ? [
    { name: "Mean Temperature", value: features.meanTemp, unit: "°C" },
    { name: "Std Temperature", value: features.stdTemp, unit: "°C" },
    { name: "Mean Vibration", value: features.meanVibration, unit: "mm/s" },
    { name: "Std Vibration", value: features.stdVibration, unit: "mm/s" },
    { name: "Mean Pressure", value: features.meanPressure, unit: "bar" },
    { name: "Std Pressure", value: features.stdPressure, unit: "bar" },
    { name: "RMS Vibration", value: features.rmsVibration, unit: "mm/s" },
    { name: "Peak-to-Peak", value: features.peakToPeak, unit: "mm/s" },
    { name: "Kurtosis", value: features.kurtosis, unit: "" },
    { name: "Skewness", value: features.skewness, unit: "" },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="input-equipment-id-features"
          type="text"
          placeholder="Enter equipment ID"
          value={equipmentId}
          onChange={(e) => setEquipmentId(e.target.value)}
          className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button data-testid="button-compute-features" onClick={handleCompute} disabled={!equipmentId || computeMutation.isPending}>
          {computeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Compute Features
        </Button>
      </div>

      {isLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading features...</div>}

      {featureEntries.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle data-testid="text-features-title" className="text-lg">Latest Equipment Features</CardTitle>
                <CardDescription>Window: {features.windowMinutes ?? 60} min | Samples: {sampleCount}</CardDescription>
              </div>
              <Badge
                data-testid="badge-data-source"
                variant={dataSource === "telemetry" ? "default" : "secondary"}
              >
                {dataSource === "telemetry" ? "Live Telemetry" : "Estimated"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {featureEntries.map((f) => (
                <div key={f.name} className="p-3 rounded-lg border bg-muted/50">
                  <div className="text-xs text-muted-foreground">{f.name}</div>
                  <div className="text-lg font-semibold" data-testid={`text-feature-${f.name.toLowerCase().replace(/\s/g, '-')}`}>
                    {f.value != null ? Number(f.value).toFixed(2) : "—"} <span className="text-xs text-muted-foreground">{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {equipmentId && !isLoading && featureEntries.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No features computed yet. Click "Compute Features" to start.</CardContent></Card>
      )}
    </div>
  );
}

function FleetAnalyticsTab() {
  const [equipmentType, setEquipmentType] = useState("engine");
  const [equipmentId, setEquipmentId] = useState("");
  const { data: baselines, isLoading: baselinesLoading } = useFleetBaselines(equipmentType);
  const { data: comparison, isLoading: comparisonLoading } = useFleetComparison(equipmentId, equipmentType);
  const computeMutation = useComputeBaselines();
  const { toast } = useToast();

  const statusColor = (status: string) => status === "critical" ? "destructive" : status === "warning" ? "secondary" : "default";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input data-testid="input-equipment-type" type="text" placeholder="Equipment type" value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <Button data-testid="button-compute-baselines" onClick={() => computeMutation.mutateAsync(equipmentType).then(() => toast({ title: "Baselines computed from feature records" })).catch(() => toast({ title: "Failed to compute baselines", variant: "destructive" }))} disabled={!equipmentType || computeMutation.isPending}>
          {computeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Compute Baselines
        </Button>
        <input data-testid="input-equipment-id-compare" type="text" placeholder="Equipment ID for comparison" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>

      {baselinesLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading baselines...</div>}

      {Array.isArray(baselines) && baselines.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Fleet Baselines: {equipmentType}</CardTitle><CardDescription>{baselines[0]?.sampleSize ?? 0} source records</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-2">Feature</th><th className="text-right p-2">Mean</th><th className="text-right p-2">Std Dev</th><th className="text-right p-2">P5</th><th className="text-right p-2">P95</th><th className="text-right p-2">Samples</th></tr></thead>
                <tbody>{baselines.map((b: any) => (
                  <tr key={b.id} className="border-b" data-testid={`row-baseline-${b.featureName}`}>
                    <td className="p-2 font-medium">{b.featureName}</td>
                    <td className="p-2 text-right">{b.mean?.toFixed(2)}</td>
                    <td className="p-2 text-right">{b.stddev?.toFixed(2)}</td>
                    <td className="p-2 text-right">{b.p5?.toFixed(2)}</td>
                    <td className="p-2 text-right">{b.p95?.toFixed(2)}</td>
                    <td className="p-2 text-right">{b.sampleSize}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {Array.isArray(comparison) && comparison.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Fleet Comparison</CardTitle><CardDescription>Equipment vs fleet average with z-scores and percentiles</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {comparison.map((c: any) => (
                <div key={c.featureName} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-comparison-${c.featureName}`}>
                  <div className="font-medium w-32">{c.featureName}</div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <span className="font-mono">{c.equipmentValue?.toFixed(2)}</span>
                    <span className="text-muted-foreground">Fleet: {c.fleetMean?.toFixed(2)} ± {c.fleetStddev?.toFixed(2)}</span>
                    <span className="font-mono">Z: {c.zScore?.toFixed(2)}</span>
                    <span className="text-muted-foreground">P{c.percentile?.toFixed(0)}</span>
                    <span className="flex items-center gap-1">
                      {c.aboveFleetAvg ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />}
                      <span className="text-xs">{c.aboveFleetAvg ? "Above" : "Below"}</span>
                    </span>
                    <Badge variant={statusColor(c.status)}>{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ModelRegistryTab() {
  const { data: models, isLoading } = useModels();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const { data: versions } = useModelVersions(selectedModelId ?? "");
  const { data: deployment } = useActiveDeployment(selectedModelId ?? "");

  return (
    <div className="space-y-4">
      {isLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading models...</div>}

      {Array.isArray(models) && models.length > 0 ? (
        <div className="grid gap-3">
          {models.map((m: any) => (
            <Card key={m.id} className={`cursor-pointer transition-colors ${selectedModelId === m.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedModelId(m.id)} data-testid={`card-model-${m.id}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-sm text-muted-foreground">{m.type} • {m.equipmentType || "all"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.status === "deployed" ? "default" : "secondary"}>{m.status}</Badge>
                  {m.accuracy && <span className="text-sm">Acc: {parseFloat(m.accuracy).toFixed(1)}%</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No models registered yet.</CardContent></Card>
      ) : null}

      {selectedModelId && Array.isArray(versions) && versions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Versions</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-version-${v.id}`}>
                  <div>
                    <span className="font-medium">v{v.version}</span>
                    <span className="text-sm text-muted-foreground ml-2">{v.artifactPath || "no artifact"}</span>
                    {v.trainingDataPoints && <span className="text-xs text-muted-foreground ml-2">({v.trainingDataPoints} training pts)</span>}
                  </div>
                  <Badge variant={v.status === "production" ? "default" : "secondary"}>{v.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedModelId && deployment && !deployment.message && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Active Deployment</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Target:</span> {deployment.deploymentTarget}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge>{deployment.deploymentStatus}</Badge></div>
              <div><span className="text-muted-foreground">Traffic:</span> {deployment.trafficPercentage}%</div>
              <div><span className="text-muted-foreground">Deployed:</span> {new Date(deployment.deployedAt).toLocaleDateString()}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InferenceTab() {
  const [equipmentId, setEquipmentId] = useState("");
  const [lastPredictionId, setLastPredictionId] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const inferenceMutation = useRunInference();
  const { data: explanations } = usePredictionExplanations(lastPredictionId);
  const { toast } = useToast();

  const handleInference = async () => {
    if (!equipmentId) return;
    try {
      const result = await inferenceMutation.mutateAsync({ equipmentId });
      setLastResult(result);
      if (result.inferenceRun?.predictionId) setLastPredictionId(result.inferenceRun.predictionId);
      toast({ title: "Inference completed" });
    } catch {
      toast({ title: "Inference failed", variant: "destructive" });
    }
  };

  const riskColor = (level: string) => level === "critical" ? "destructive" : level === "high" ? "secondary" : "default";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input data-testid="input-equipment-id-inference" type="text" placeholder="Equipment ID" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <Button data-testid="button-run-inference" onClick={handleInference} disabled={!equipmentId || inferenceMutation.isPending}>
          {inferenceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          Run Inference
        </Button>
      </div>

      {lastResult?.prediction && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Prediction Result</CardTitle>
              <Badge variant="outline" className="text-xs">
                {lastResult.inferenceRun?.status === "completed" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : null}
                {lastResult.inferenceRun?.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Failure Probability</div>
                <div className="text-2xl font-bold" data-testid="text-failure-probability">{(lastResult.prediction.failureProbability * 100).toFixed(1)}%</div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Risk Level</div>
                <Badge variant={riskColor(lastResult.prediction.riskLevel)} data-testid="text-risk-level" className="mt-1">{lastResult.prediction.riskLevel}</Badge>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Remaining Useful Life</div>
                <div className="text-2xl font-bold" data-testid="text-rul">{lastResult.prediction.remainingUsefulLife}d</div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="text-xs text-muted-foreground">Latency</div>
                <div className="text-2xl font-bold">{lastResult.inferenceRun?.latencyMs}ms</div>
              </div>
            </div>
            {lastResult.prediction.recommendations?.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Recommendations:</div>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {lastResult.prediction.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {Array.isArray(explanations) && explanations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Prediction Explanations</CardTitle><CardDescription>Feature contributions to prediction — normalized importance with deviation direction</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {explanations.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 p-2 rounded border" data-testid={`row-explanation-${e.featureName}`}>
                  <div className="w-32 font-medium text-sm">{e.featureName}</div>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${e.importance * 100}%` }} />
                  </div>
                  <div className="text-sm text-right w-16">{(e.importance * 100).toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground w-24 text-right">
                    {e.featureValue?.toFixed(2)} <span className="text-xs">/ {e.baselineValue?.toFixed(2)}</span>
                  </div>
                  {e.direction === "increasing" ? <TrendingUp className="w-4 h-4 text-red-500" /> : e.direction === "decreasing" ? <TrendingDown className="w-4 h-4 text-blue-500" /> : <Minus className="w-4 h-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DriftMonitoringTab() {
  const [modelVersionId, setModelVersionId] = useState("");
  const { data: driftMetrics, isLoading } = useModelDrift(modelVersionId);
  const computeMutation = useComputeDrift();
  const { toast } = useToast();

  const driftedCount = Array.isArray(driftMetrics) ? driftMetrics.filter((d: any) => d.driftDetected).length : 0;
  const totalCount = Array.isArray(driftMetrics) ? driftMetrics.length : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input data-testid="input-model-version-id" type="text" placeholder="Model Version ID" value={modelVersionId} onChange={(e) => setModelVersionId(e.target.value)} className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <Button data-testid="button-compute-drift" onClick={() => computeMutation.mutateAsync({ modelVersionId }).then(() => toast({ title: "Drift computed (normalized mean shift)" })).catch(() => toast({ title: "Failed to compute drift", variant: "destructive" }))} disabled={!modelVersionId || computeMutation.isPending}>
          {computeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Compute Drift
        </Button>
      </div>

      {isLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading drift metrics...</div>}

      {totalCount > 0 && (
        <>
          <div className="flex items-center gap-3">
            <Badge variant={driftedCount > 0 ? "destructive" : "default"} data-testid="badge-drift-summary">
              {driftedCount}/{totalCount} features drifted
            </Badge>
            <span className="text-xs text-muted-foreground">Method: normalized mean shift (|μ_live - μ_train| / σ_train) &gt; 2.0</span>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-lg">Drift Metrics</CardTitle><CardDescription>Feature distribution shifts — training vs live</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">Feature</th><th className="text-right p-2">Training μ</th><th className="text-right p-2">Training σ</th><th className="text-right p-2">Live μ</th><th className="text-right p-2">Live σ</th><th className="text-right p-2">Drift Score</th><th className="text-center p-2">Status</th></tr></thead>
                  <tbody>{driftMetrics.map((d: any) => (
                    <tr key={d.id} className="border-b" data-testid={`row-drift-${d.featureName}`}>
                      <td className="p-2 font-medium">{d.featureName}</td>
                      <td className="p-2 text-right font-mono">{d.trainingMean?.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-muted-foreground">{d.trainingStd?.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{d.liveMean?.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-muted-foreground">{d.liveStd?.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-semibold">{d.driftScore?.toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <Badge variant={d.driftDetected ? "destructive" : "default"}>{d.driftDetected ? "DRIFT" : "OK"}</Badge>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function PdmPlatformPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-pdm-platform-title">PdM Platform</h1>
        <p className="text-muted-foreground">Feature Store, Fleet Analytics, Model Registry, Inference, and Monitoring</p>
      </div>

      <Tabs defaultValue="features" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="features" data-testid="tab-features"><Database className="w-4 h-4 mr-1" /> Features</TabsTrigger>
          <TabsTrigger value="fleet" data-testid="tab-fleet"><BarChart3 className="w-4 h-4 mr-1" /> Fleet</TabsTrigger>
          <TabsTrigger value="models" data-testid="tab-models"><Box className="w-4 h-4 mr-1" /> Models</TabsTrigger>
          <TabsTrigger value="inference" data-testid="tab-inference"><Zap className="w-4 h-4 mr-1" /> Inference</TabsTrigger>
          <TabsTrigger value="drift" data-testid="tab-drift"><AlertTriangle className="w-4 h-4 mr-1" /> Drift</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="mt-4"><FeatureStoreTab /></TabsContent>
        <TabsContent value="fleet" className="mt-4"><FleetAnalyticsTab /></TabsContent>
        <TabsContent value="models" className="mt-4"><ModelRegistryTab /></TabsContent>
        <TabsContent value="inference" className="mt-4"><InferenceTab /></TabsContent>
        <TabsContent value="drift" className="mt-4"><DriftMonitoringTab /></TabsContent>
      </Tabs>
    </div>
  );
}
