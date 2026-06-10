import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useModels, useModelVersions } from "@/features/pdm/hooks/use-model-registry";
import { useModelDrift, useComputeDrift } from "@/features/pdm/hooks/use-model-monitoring";

export function DriftMonitoringTab() {
  const { data: models } = useModels();
  const [selectedModelId, setSelectedModelId] = useState("");
  const { data: versions } = useModelVersions(selectedModelId);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const { data: driftMetrics, isLoading } = useModelDrift(selectedVersionId);
  const computeMutation = useComputeDrift();
  const { toast } = useToast();

  const modelsList = Array.isArray(models) ? models : [];
  const versionsList = Array.isArray(versions) ? versions : [];

  const driftedCount = Array.isArray(driftMetrics)
    ? driftMetrics.filter((d: { driftDetected?: boolean }) => d.driftDetected).length
    : 0;
  const totalCount = Array.isArray(driftMetrics) ? driftMetrics.length : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-64">
          <Select
            value={selectedModelId}
            onValueChange={(v) => {
              setSelectedModelId(v);
              setSelectedVersionId("");
            }}
          >
            <SelectTrigger data-testid="select-drift-model">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {modelsList.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} ({m.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedModelId && (
          <div className="w-64">
            <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
              <SelectTrigger data-testid="input-model-version-id">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versionsList.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version} — {v.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          data-testid="button-compute-drift"
          onClick={() =>
            computeMutation
              .mutateAsync({ modelVersionId: selectedVersionId })
              .then(() => toast({ title: "Drift computed (normalized mean shift)" }))
              .catch(() => toast({ title: "Failed to compute drift", variant: "destructive" }))
          }
          disabled={!selectedVersionId || computeMutation.isPending}
        >
          {computeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Compute Drift
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading drift metrics...
        </div>
      )}

      {totalCount > 0 && (
        <>
          <div className="flex items-center gap-3">
            <Badge
              variant={driftedCount > 0 ? "destructive" : "default"}
              data-testid="badge-drift-summary"
            >
              {driftedCount}/{totalCount} features drifted
            </Badge>
            <span className="text-xs text-muted-foreground">
              Method: normalized mean shift (|μ_live - μ_train| / σ_train) &gt; 2.0
            </span>
          </div>
          {driftedCount > 0 && (
            <div
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
              data-testid="drift-recommendation"
            >
              <span className="font-semibold">What to do:</span> live inputs have shifted from
              what this version was trained on, so its accuracy degrades from here. If a single
              feature drifted, check that sensor's calibration first; if several drifted
              together, retrain on recent data (Training tab) and promote the new version.
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Drift Metrics</CardTitle>
              <CardDescription>Feature distribution shifts — training vs live</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Feature</th>
                      <th className="text-right p-2">Training μ</th>
                      <th className="text-right p-2">Training σ</th>
                      <th className="text-right p-2">Live μ</th>
                      <th className="text-right p-2">Live σ</th>
                      <th className="text-right p-2">Drift Score</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(driftMetrics as Array<Record<string, unknown> & { id: string; featureName: string; trainingMean?: number; trainingStd?: number; liveMean?: number; liveStd?: number; driftScore?: number; status?: string }>).map((d) => (
                      <tr
                        key={d.id}
                        className="border-b"
                        data-testid={`row-drift-${d.featureName}`}
                      >
                        <td className="p-2 font-medium">{d.featureName}</td>
                        <td className="p-2 text-right font-mono">{d.trainingMean?.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono text-muted-foreground">
                          {d.trainingStd?.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-mono">{d.liveMean?.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono text-muted-foreground">
                          {d.liveStd?.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-mono font-semibold">
                          {d.driftScore?.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant={d['driftDetected'] ? "destructive" : "default"}>
                            {d['driftDetected'] ? "DRIFT" : "OK"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
