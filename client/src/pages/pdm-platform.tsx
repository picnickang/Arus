import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Database, BarChart3, Box, Zap, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw, ArrowUp, ArrowDown, CheckCircle2, Play, Upload, FlaskConical, FileBox, Shield, Eye, CheckCheck, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLatestFeatures, useComputeFeatures } from "@/features/pdm/hooks/use-feature-store";
import { useFleetBaselines, useFleetComparison, useComputeBaselines } from "@/features/pdm/hooks/use-fleet-analytics";
import { useModels, useModelVersions, useActiveDeployment } from "@/features/pdm/hooks/use-model-registry";
import { useRunInference, usePredictionExplanations } from "@/features/pdm/hooks/use-inference";
import { useModelDrift, useComputeDrift } from "@/features/pdm/hooks/use-model-monitoring";
import { useTrainingDatasets, useTrainingRuns, useCreateDataset, useStartTrainingRun, usePromoteRun, useTrainingArtifacts } from "@/features/ml-ai/hooks/useTrainingPipeline";
import { usePredictionGovernance, useGovernanceDetail, useReviewPrediction, useApprovePrediction, useSuppressPrediction } from "@/features/pdm/hooks/usePredictionGovernance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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

function ArtifactsViewer({ modelVersionId }: { modelVersionId: string }) {
  const { data: artifacts, isLoading } = useTrainingArtifacts(modelVersionId);

  if (isLoading) return <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading artifacts...</div>;
  if (!Array.isArray(artifacts) || artifacts.length === 0) return <div className="text-sm text-muted-foreground py-2">No artifacts found.</div>;

  return (
    <div className="space-y-2">
      {artifacts.map((a: any) => (
        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-artifact-${a.id}`}>
          <div className="flex items-center gap-2">
            <FileBox className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{a.artifactType}</div>
              <div className="text-xs text-muted-foreground">{a.framework} / {a.format}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {a.sizeBytes && <span>{(a.sizeBytes / 1024).toFixed(1)} KB</span>}
            {a.checksum && <span className="font-mono text-xs">{a.checksum.substring(0, 12)}...</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrainingPipelineTab() {
  const { data: datasets, isLoading: datasetsLoading, error: datasetsError } = useTrainingDatasets();
  const { data: runs, isLoading: runsLoading, error: runsError } = useTrainingRuns();
  const createDatasetMutation = useCreateDataset();
  const startRunMutation = useStartTrainingRun();
  const promoteMutation = usePromoteRun();
  const { toast } = useToast();

  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [showStartRun, setShowStartRun] = useState(false);
  const [showPromote, setShowPromote] = useState<string | null>(null);
  const [expandedRunArtifact, setExpandedRunArtifact] = useState<string | null>(null);

  const [datasetForm, setDatasetForm] = useState({ name: "", sourceType: "telemetry", description: "", labelColumn: "", targetType: "failure_prediction", rowCount: "" });
  const [runForm, setRunForm] = useState({ datasetId: "", learningRate: "0.001", epochs: "100", batchSize: "32" });
  const [promoteForm, setPromoteForm] = useState({ modelId: "", version: "", changelog: "" });

  const handleCreateDataset = async () => {
    if (!datasetForm.name || !datasetForm.sourceType) return;
    try {
      await createDatasetMutation.mutateAsync({
        name: datasetForm.name,
        sourceType: datasetForm.sourceType,
        description: datasetForm.description || undefined,
        labelColumn: datasetForm.labelColumn || undefined,
        targetType: datasetForm.targetType || undefined,
        rowCount: datasetForm.rowCount ? parseInt(datasetForm.rowCount) : undefined,
      });
      toast({ title: "Dataset created successfully" });
      setShowCreateDataset(false);
      setDatasetForm({ name: "", sourceType: "telemetry", description: "", labelColumn: "", targetType: "failure_prediction", rowCount: "" });
    } catch {
      toast({ title: "Failed to create dataset", variant: "destructive" });
    }
  };

  const handleStartRun = async () => {
    if (!runForm.datasetId) return;
    try {
      await startRunMutation.mutateAsync({
        datasetId: runForm.datasetId,
        hyperparameters: {
          learningRate: parseFloat(runForm.learningRate),
          epochs: parseInt(runForm.epochs),
          batchSize: parseInt(runForm.batchSize),
        },
      });
      toast({ title: "Training run started" });
      setShowStartRun(false);
      setRunForm({ datasetId: "", learningRate: "0.001", epochs: "100", batchSize: "32" });
    } catch {
      toast({ title: "Failed to start training run", variant: "destructive" });
    }
  };

  const handlePromote = async (runId: string) => {
    if (!promoteForm.modelId || !promoteForm.version) return;
    try {
      await promoteMutation.mutateAsync({
        runId,
        modelId: promoteForm.modelId,
        version: promoteForm.version,
        changelog: promoteForm.changelog || undefined,
      });
      toast({ title: "Model version promoted successfully" });
      setShowPromote(null);
      setPromoteForm({ modelId: "", version: "", changelog: "" });
    } catch {
      toast({ title: "Failed to promote model version", variant: "destructive" });
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "completed": return "default" as const;
      case "running": return "secondary" as const;
      case "failed": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg" data-testid="text-datasets-title">Training Datasets</CardTitle>
              <CardDescription>Manage datasets for model training</CardDescription>
            </div>
            <Button data-testid="button-create-dataset" onClick={() => setShowCreateDataset(true)}>
              <Database className="w-4 h-4 mr-2" />
              New Dataset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {datasetsLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading datasets...</div>}
          {datasetsError && <div className="text-destructive text-sm" data-testid="text-datasets-error">Failed to load datasets</div>}
          {!datasetsLoading && Array.isArray(datasets) && datasets.length === 0 && (
            <div className="py-8 text-center text-muted-foreground" data-testid="text-datasets-empty">No datasets created yet. Click "New Dataset" to get started.</div>
          )}
          {Array.isArray(datasets) && datasets.length > 0 && (
            <div className="space-y-2">
              {datasets.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-dataset-${d.id}`}>
                  <div>
                    <div className="font-medium" data-testid={`text-dataset-name-${d.id}`}>{d.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {d.sourceType} {d.rowCount ? `| ${d.rowCount.toLocaleString()} rows` : ""} | Created {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant={statusVariant(d.status)} data-testid={`badge-dataset-status-${d.id}`}>{d.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg" data-testid="text-runs-title">Training Runs</CardTitle>
              <CardDescription>Track model training runs, metrics, and promotions</CardDescription>
            </div>
            <Button data-testid="button-start-run" onClick={() => setShowStartRun(true)}>
              <Play className="w-4 h-4 mr-2" />
              Start New Run
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {runsLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading runs...</div>}
          {runsError && <div className="text-destructive text-sm" data-testid="text-runs-error">Failed to load training runs</div>}
          {!runsLoading && Array.isArray(runs) && runs.length === 0 && (
            <div className="py-8 text-center text-muted-foreground" data-testid="text-runs-empty">No training runs yet. Start a new run to begin training.</div>
          )}
          {Array.isArray(runs) && runs.length > 0 && (
            <div className="space-y-3">
              {runs.map((r: any) => {
                const metrics = r.metrics as Record<string, number> | null;
                const hyperparams = r.hyperparameters as Record<string, unknown> | null;
                return (
                  <Card key={r.id} data-testid={`card-run-${r.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <div className="font-medium text-sm">Run {r.id.substring(0, 8)}...</div>
                          <div className="text-xs text-muted-foreground">
                            Dataset: {r.datasetId?.substring(0, 8)}...
                            {r.startedAt && ` | Started: ${new Date(r.startedAt).toLocaleString()}`}
                            {r.finishedAt && ` | Finished: ${new Date(r.finishedAt).toLocaleString()}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={statusVariant(r.status)} data-testid={`badge-run-status-${r.id}`}>{r.status}</Badge>
                          {r.status === "completed" && (
                            <Button size="sm" variant="outline" data-testid={`button-promote-${r.id}`} onClick={() => setShowPromote(r.id)}>
                              <Upload className="w-3 h-3 mr-1" />
                              Promote
                            </Button>
                          )}
                          {r.modelVersionId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`button-artifacts-${r.id}`}
                              onClick={() => setExpandedRunArtifact(expandedRunArtifact === r.modelVersionId ? null : r.modelVersionId)}
                            >
                              <FileBox className="w-3 h-3 mr-1" />
                              Artifacts
                            </Button>
                          )}
                        </div>
                      </div>

                      {metrics && Object.keys(metrics).length > 0 && (
                        <div className="flex items-center gap-3 flex-wrap">
                          {Object.entries(metrics).map(([key, val]) => (
                            <div key={key} className="text-xs px-2 py-1 rounded-md bg-muted">
                              <span className="text-muted-foreground">{key}:</span>{" "}
                              <span className="font-mono font-medium" data-testid={`text-metric-${key}-${r.id}`}>
                                {typeof val === "number" ? val.toFixed(4) : String(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {hyperparams && Object.keys(hyperparams).length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          {Object.entries(hyperparams).map(([key, val]) => (
                            <span key={key}>{key}: {String(val)}</span>
                          ))}
                        </div>
                      )}

                      {r.errorMessage && (
                        <div className="text-sm text-destructive" data-testid={`text-error-${r.id}`}>{r.errorMessage}</div>
                      )}

                      {expandedRunArtifact === r.modelVersionId && r.modelVersionId && (
                        <ArtifactsViewer modelVersionId={r.modelVersionId} />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDataset} onOpenChange={setShowCreateDataset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Training Dataset</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                data-testid="input-dataset-name"
                type="text"
                value={datasetForm.name}
                onChange={(e) => setDatasetForm({ ...datasetForm, name: e.target.value })}
                placeholder="e.g., Engine Telemetry Q4 2024"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Source Type</label>
              <input
                data-testid="input-dataset-source-type"
                type="text"
                value={datasetForm.sourceType}
                onChange={(e) => setDatasetForm({ ...datasetForm, sourceType: e.target.value })}
                placeholder="telemetry"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <input
                data-testid="input-dataset-description"
                type="text"
                value={datasetForm.description}
                onChange={(e) => setDatasetForm({ ...datasetForm, description: e.target.value })}
                placeholder="Optional description"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Label Column</label>
                <input
                  data-testid="input-dataset-label-column"
                  type="text"
                  value={datasetForm.labelColumn}
                  onChange={(e) => setDatasetForm({ ...datasetForm, labelColumn: e.target.value })}
                  placeholder="failure"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Row Count</label>
                <input
                  data-testid="input-dataset-row-count"
                  type="number"
                  value={datasetForm.rowCount}
                  onChange={(e) => setDatasetForm({ ...datasetForm, rowCount: e.target.value })}
                  placeholder="10000"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDataset(false)} data-testid="button-cancel-dataset">Cancel</Button>
            <Button onClick={handleCreateDataset} disabled={!datasetForm.name || !datasetForm.sourceType || createDatasetMutation.isPending} data-testid="button-submit-dataset">
              {createDatasetMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Dataset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showStartRun} onOpenChange={setShowStartRun}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Training Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Dataset ID</label>
              {Array.isArray(datasets) && datasets.length > 0 ? (
                <select
                  data-testid="select-run-dataset"
                  value={runForm.datasetId}
                  onChange={(e) => setRunForm({ ...runForm, datasetId: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                >
                  <option value="">Select a dataset</option>
                  {datasets.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                  ))}
                </select>
              ) : (
                <input
                  data-testid="input-run-dataset-id"
                  type="text"
                  value={runForm.datasetId}
                  onChange={(e) => setRunForm({ ...runForm, datasetId: e.target.value })}
                  placeholder="Enter dataset ID"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Learning Rate</label>
                <input
                  data-testid="input-run-learning-rate"
                  type="text"
                  value={runForm.learningRate}
                  onChange={(e) => setRunForm({ ...runForm, learningRate: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Epochs</label>
                <input
                  data-testid="input-run-epochs"
                  type="text"
                  value={runForm.epochs}
                  onChange={(e) => setRunForm({ ...runForm, epochs: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Batch Size</label>
                <input
                  data-testid="input-run-batch-size"
                  type="text"
                  value={runForm.batchSize}
                  onChange={(e) => setRunForm({ ...runForm, batchSize: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartRun(false)} data-testid="button-cancel-run">Cancel</Button>
            <Button onClick={handleStartRun} disabled={!runForm.datasetId || startRunMutation.isPending} data-testid="button-submit-run">
              {startRunMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Start Training
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPromote} onOpenChange={(open) => !open && setShowPromote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Model Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Model ID</label>
              <input
                data-testid="input-promote-model-id"
                type="text"
                value={promoteForm.modelId}
                onChange={(e) => setPromoteForm({ ...promoteForm, modelId: e.target.value })}
                placeholder="Target model ID"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Version</label>
              <input
                data-testid="input-promote-version"
                type="text"
                value={promoteForm.version}
                onChange={(e) => setPromoteForm({ ...promoteForm, version: e.target.value })}
                placeholder="e.g., 2.1.0"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Changelog</label>
              <input
                data-testid="input-promote-changelog"
                type="text"
                value={promoteForm.changelog}
                onChange={(e) => setPromoteForm({ ...promoteForm, changelog: e.target.value })}
                placeholder="Optional changelog notes"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromote(null)} data-testid="button-cancel-promote">Cancel</Button>
            <Button onClick={() => showPromote && handlePromote(showPromote)} disabled={!promoteForm.modelId || !promoteForm.version || promoteMutation.isPending} data-testid="button-submit-promote">
              {promoteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Promote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GovernanceTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPredictionId, setSelectedPredictionId] = useState<number | null>(null);
  const [suppressDialogOpen, setSuppressDialogOpen] = useState(false);
  const [suppressTargetId, setSuppressTargetId] = useState<number | null>(null);
  const [suppressReason, setSuppressReason] = useState("");
  const { toast } = useToast();

  const queryStatus = statusFilter === "all" ? undefined : statusFilter;
  const { data: predictions, isLoading } = usePredictionGovernance(queryStatus);
  const { data: detail } = useGovernanceDetail(selectedPredictionId);
  const reviewMutation = useReviewPrediction();
  const approveMutation = useApprovePrediction();
  const suppressMutation = useSuppressPrediction();

  const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "approved") return "default";
    if (status === "suppressed") return "destructive";
    if (status === "expired") return "outline";
    if (status === "reviewed") return "secondary";
    return "secondary";
  };

  const riskBadgeVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    if (level === "critical") return "destructive";
    if (level === "high") return "secondary";
    return "default";
  };

  const handleReview = async (id: number) => {
    try {
      await reviewMutation.mutateAsync({ id });
      toast({ title: "Prediction marked as reviewed" });
    } catch {
      toast({ title: "Failed to review prediction", variant: "destructive" });
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveMutation.mutateAsync({ id });
      toast({ title: "Prediction approved" });
    } catch {
      toast({ title: "Failed to approve prediction", variant: "destructive" });
    }
  };

  const handleSuppressOpen = (id: number) => {
    setSuppressTargetId(id);
    setSuppressReason("");
    setSuppressDialogOpen(true);
  };

  const handleSuppressConfirm = async () => {
    if (!suppressTargetId || !suppressReason.trim()) return;
    try {
      await suppressMutation.mutateAsync({ id: suppressTargetId, reason: suppressReason });
      toast({ title: "Prediction suppressed" });
      setSuppressDialogOpen(false);
      setSuppressTargetId(null);
      setSuppressReason("");
    } catch {
      toast({ title: "Failed to suppress prediction", variant: "destructive" });
    }
  };

  const predictionsList = Array.isArray(predictions) ? predictions : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-governance-status">
          <SelectTrigger className="w-48" data-testid="select-trigger-governance-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="select-item-all">All Statuses</SelectItem>
            <SelectItem value="pending" data-testid="select-item-pending">Pending</SelectItem>
            <SelectItem value="reviewed" data-testid="select-item-reviewed">Reviewed</SelectItem>
            <SelectItem value="approved" data-testid="select-item-approved">Approved</SelectItem>
            <SelectItem value="suppressed" data-testid="select-item-suppressed">Suppressed</SelectItem>
            <SelectItem value="expired" data-testid="select-item-expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground" data-testid="text-governance-count">
          {predictionsList.length} prediction{predictionsList.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading && <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading governance predictions...</div>}

      {!isLoading && predictionsList.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No predictions found for the selected filter.</CardContent></Card>
      )}

      <div className="grid gap-3">
        {predictionsList.map((p: any) => (
          <Card key={p.id} className={`cursor-pointer transition-colors ${selectedPredictionId === p.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedPredictionId(p.id)} data-testid={`card-governance-prediction-${p.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold" data-testid={`text-equipment-${p.id}`}>{p.equipmentId}</span>
                    <Badge variant={riskBadgeVariant(p.riskLevel)} data-testid={`badge-risk-${p.id}`}>{p.riskLevel}</Badge>
                    <Badge variant={statusBadgeVariant(p.reviewStatus || "pending")} data-testid={`badge-status-${p.id}`}>{p.reviewStatus || "pending"}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4 flex-wrap">
                    <span>Probability: {((p.failureProbability ?? 0) * 100).toFixed(1)}%</span>
                    {p.remainingUsefulLife != null && <span>RUL: {p.remainingUsefulLife}d</span>}
                    {p.predictionValidUntil && <span>Valid until: {new Date(p.predictionValidUntil).toLocaleDateString()}</span>}
                    {p.modelVersionId && <span>Model: {p.modelVersionId.slice(0, 8)}</span>}
                    {p.featureSetVersion && <span>Features: {p.featureSetVersion}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(!p.reviewStatus || p.reviewStatus === "pending") && (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleReview(p.id); }} disabled={reviewMutation.isPending} data-testid={`button-review-${p.id}`}>
                      <Eye className="w-4 h-4 mr-1" /> Review
                    </Button>
                  )}
                  {(p.reviewStatus === "pending" || p.reviewStatus === "reviewed") && (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleApprove(p.id); }} disabled={approveMutation.isPending} data-testid={`button-approve-${p.id}`}>
                      <CheckCheck className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  )}
                  {p.reviewStatus !== "suppressed" && (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSuppressOpen(p.id); }} data-testid={`button-suppress-${p.id}`}>
                      <XCircle className="w-4 h-4 mr-1" /> Suppress
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPredictionId && detail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg" data-testid="text-provenance-title">Provenance Details</CardTitle>
            <CardDescription>Full governance and provenance information for prediction #{selectedPredictionId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Equipment</div>
                <div className="font-medium" data-testid="text-provenance-equipment">{detail.equipmentId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Risk Level</div>
                <Badge variant={riskBadgeVariant(detail.riskLevel)} data-testid="text-provenance-risk">{detail.riskLevel}</Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Review Status</div>
                <Badge variant={statusBadgeVariant(detail.reviewStatus || "pending")} data-testid="text-provenance-status">{detail.reviewStatus || "pending"}</Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Failure Probability</div>
                <div className="font-medium">{((detail.failureProbability ?? 0) * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">RUL</div>
                <div className="font-medium">{detail.remainingUsefulLife != null ? `${detail.remainingUsefulLife} days` : "N/A"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Prediction Date</div>
                <div className="font-medium">{detail.predictionTimestamp ? new Date(detail.predictionTimestamp).toLocaleString() : "N/A"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Valid Until</div>
                <div className="font-medium" data-testid="text-provenance-valid-until">{detail.predictionValidUntil ? new Date(detail.predictionValidUntil).toLocaleString() : "No expiry"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Model Version</div>
                <div className="font-medium" data-testid="text-provenance-model-version">{detail.modelVersionId || "N/A"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Feature Set Version</div>
                <div className="font-medium" data-testid="text-provenance-feature-set">{detail.featureSetVersion || "N/A"}</div>
              </div>
              {detail.reviewedBy && (
                <div>
                  <div className="text-muted-foreground">Reviewed By</div>
                  <div className="font-medium">{detail.reviewedBy}</div>
                </div>
              )}
              {detail.reviewedAt && (
                <div>
                  <div className="text-muted-foreground">Reviewed At</div>
                  <div className="font-medium">{new Date(detail.reviewedAt).toLocaleString()}</div>
                </div>
              )}
              {detail.suppressionReason && (
                <div className="col-span-2 md:col-span-3">
                  <div className="text-muted-foreground">Suppression Reason</div>
                  <div className="font-medium">{detail.suppressionReason}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={suppressDialogOpen} onOpenChange={setSuppressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suppress Prediction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Provide a reason for suppressing prediction #{suppressTargetId}. This action will mark the prediction as suppressed and remove it from active monitoring.
            </div>
            <Textarea
              data-testid="input-suppress-reason"
              placeholder="Enter suppression reason..."
              value={suppressReason}
              onChange={(e) => setSuppressReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuppressDialogOpen(false)} data-testid="button-suppress-cancel">Cancel</Button>
            <Button onClick={handleSuppressConfirm} disabled={!suppressReason.trim() || suppressMutation.isPending} data-testid="button-suppress-confirm">
              {suppressMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Suppress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PdmPlatformPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-pdm-platform-title">PdM Platform</h1>
        <p className="text-muted-foreground">Feature Store, Fleet Analytics, Model Registry, Training Pipeline, Inference, Monitoring, and Governance</p>
      </div>

      <Tabs defaultValue="features" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="features" data-testid="tab-features"><Database className="w-4 h-4 mr-1" /> Features</TabsTrigger>
          <TabsTrigger value="fleet" data-testid="tab-fleet"><BarChart3 className="w-4 h-4 mr-1" /> Fleet</TabsTrigger>
          <TabsTrigger value="models" data-testid="tab-models"><Box className="w-4 h-4 mr-1" /> Models</TabsTrigger>
          <TabsTrigger value="training" data-testid="tab-training"><FlaskConical className="w-4 h-4 mr-1" /> Training</TabsTrigger>
          <TabsTrigger value="inference" data-testid="tab-inference"><Zap className="w-4 h-4 mr-1" /> Inference</TabsTrigger>
          <TabsTrigger value="drift" data-testid="tab-drift"><AlertTriangle className="w-4 h-4 mr-1" /> Drift</TabsTrigger>
          <TabsTrigger value="governance" data-testid="tab-governance"><Shield className="w-4 h-4 mr-1" /> Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="mt-4"><FeatureStoreTab /></TabsContent>
        <TabsContent value="fleet" className="mt-4"><FleetAnalyticsTab /></TabsContent>
        <TabsContent value="models" className="mt-4"><ModelRegistryTab /></TabsContent>
        <TabsContent value="training" className="mt-4"><TrainingPipelineTab /></TabsContent>
        <TabsContent value="inference" className="mt-4"><InferenceTab /></TabsContent>
        <TabsContent value="drift" className="mt-4"><DriftMonitoringTab /></TabsContent>
        <TabsContent value="governance" className="mt-4"><GovernanceTab /></TabsContent>
      </Tabs>
    </div>
  );
}
