import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Play, Upload, FileBox } from "lucide-react";
import {
  useTrainingDatasets,
  useTrainingRuns,
} from "@/features/ml-ai/hooks/useTrainingPipeline";
import { useModels } from "@/features/pdm/hooks/use-model-registry";
import { ArtifactsViewer } from "./ArtifactsViewer";
import {
  CreateDatasetDialog,
  StartRunDialog,
  PromoteDialog,
} from "./TrainingPipelineDialogs";

const statusVariant = (status: string) => {
  switch (status) {
    case "completed":
      return "default" as const;
    case "running":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

export function TrainingPipelineTab() {
  const {
    data: datasets,
    isLoading: datasetsLoading,
    error: datasetsError,
  } = useTrainingDatasets();
  const { data: runs, isLoading: runsLoading, error: runsError } = useTrainingRuns();
  const { data: models } = useModels();

  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [showStartRun, setShowStartRun] = useState(false);
  const [showPromote, setShowPromote] = useState<string | null>(null);
  const [expandedRunArtifact, setExpandedRunArtifact] = useState<string | null>(null);

  const datasetsList = Array.isArray(datasets) ? datasets : [];
  const modelsList = Array.isArray(models) ? models : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg" data-testid="text-datasets-title">
                Training Datasets
              </CardTitle>
              <CardDescription>Manage datasets for model training</CardDescription>
            </div>
            <Button data-testid="button-create-dataset" onClick={() => setShowCreateDataset(true)}>
              <Database className="w-4 h-4 mr-2" />
              New Dataset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {datasetsLoading && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading datasets...
            </div>
          )}
          {datasetsError && (
            <div className="text-destructive text-sm" data-testid="text-datasets-error">
              Failed to load datasets
            </div>
          )}
          {!datasetsLoading && !datasetsError && Array.isArray(datasets) && datasets.length === 0 && (
            <div
              className="py-8 text-center text-muted-foreground"
              data-testid="text-datasets-empty"
            >
              No datasets created yet. Click "New Dataset" to get started.
            </div>
          )}
          {Array.isArray(datasets) && datasets.length > 0 && (
            <div className="space-y-2">
              {datasetsList.map((d: any) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`row-dataset-${d.id}`}
                >
                  <div>
                    <div className="font-medium" data-testid={`text-dataset-name-${d.id}`}>
                      {d.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {d.sourceType} {d.rowCount ? `| ${d.rowCount.toLocaleString()} rows` : ""} |
                      Created {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge
                    variant={statusVariant(d.status)}
                    data-testid={`badge-dataset-status-${d.id}`}
                  >
                    {d.status}
                  </Badge>
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
              <CardTitle className="text-lg" data-testid="text-runs-title">
                Training Runs
              </CardTitle>
              <CardDescription>Track model training runs, metrics, and promotions</CardDescription>
            </div>
            <Button data-testid="button-start-run" onClick={() => setShowStartRun(true)}>
              <Play className="w-4 h-4 mr-2" />
              Start New Run
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {runsLoading && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading runs...
            </div>
          )}
          {runsError && (
            <div className="text-destructive text-sm" data-testid="text-runs-error">
              Failed to load training runs
            </div>
          )}
          {!runsLoading && Array.isArray(runs) && runs.length === 0 && (
            <div className="py-8 text-center text-muted-foreground" data-testid="text-runs-empty">
              No training runs yet. Start a new run to begin training.
            </div>
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
                            {r.finishedAt &&
                              ` | Finished: ${new Date(r.finishedAt).toLocaleString()}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={statusVariant(r.status)}
                            data-testid={`badge-run-status-${r.id}`}
                          >
                            {r.status}
                          </Badge>
                          {r.status === "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-promote-${r.id}`}
                              onClick={() => setShowPromote(r.id)}
                            >
                              <Upload className="w-3 h-3 mr-1" />
                              Promote
                            </Button>
                          )}
                          {r.modelVersionId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`button-artifacts-${r.id}`}
                              onClick={() =>
                                setExpandedRunArtifact(
                                  expandedRunArtifact === r.modelVersionId ? null : r.modelVersionId
                                )
                              }
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
                              <span
                                className="font-mono font-medium"
                                data-testid={`text-metric-${key}-${r.id}`}
                              >
                                {typeof val === "number" ? val.toFixed(4) : String(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {hyperparams && Object.keys(hyperparams).length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          {Object.entries(hyperparams).map(([key, val]) => (
                            <span key={key}>
                              {key}: {String(val)}
                            </span>
                          ))}
                        </div>
                      )}

                      {r.errorMessage && (
                        <div
                          className="text-sm text-destructive"
                          data-testid={`text-error-${r.id}`}
                        >
                          {r.errorMessage}
                        </div>
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

      <CreateDatasetDialog open={showCreateDataset} onOpenChange={setShowCreateDataset} />
      <StartRunDialog
        open={showStartRun}
        onOpenChange={setShowStartRun}
        datasets={datasetsList}
      />
      <PromoteDialog
        runId={showPromote}
        onClose={() => setShowPromote(null)}
        models={modelsList}
      />
    </div>
  );
}
