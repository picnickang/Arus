import type {
  TrainingDataset,
  InsertTrainingDataset,
  TrainingRun,
  ModelArtifact,
  ModelVersion,
} from "@shared/schema";
import type {
  ITrainingDatasetStorage,
  ITrainingRunStorage,
  IModelArtifactStorage,
  ITrainingRunnerPort,
} from "./ports";
import {
  TrainingDatasetAdapter,
  TrainingRunAdapter,
  ModelArtifactAdapter,
  StubTrainingRunner,
} from "./adapter";
import { ModelRegistryAdapter } from "../model-registry/adapter";
import { logger } from "../../../utils/logger";

export class TrainingPipelineService {
  private datasets: ITrainingDatasetStorage;
  private runs: ITrainingRunStorage;
  private artifacts: IModelArtifactStorage;
  private runner: ITrainingRunnerPort;
  private registry: ModelRegistryAdapter;

  constructor(
    datasets?: ITrainingDatasetStorage,
    runs?: ITrainingRunStorage,
    artifacts?: IModelArtifactStorage,
    runner?: ITrainingRunnerPort
  ) {
    this.datasets = datasets ?? new TrainingDatasetAdapter();
    this.runs = runs ?? new TrainingRunAdapter();
    this.artifacts = artifacts ?? new ModelArtifactAdapter();
    this.runner = runner ?? new StubTrainingRunner();
    this.registry = new ModelRegistryAdapter();
  }

  async createDataset(data: InsertTrainingDataset): Promise<TrainingDataset> {
    const result = await this.datasets.create(data);
    logger.info("[TrainingPipeline]", "Dataset created", {
      id: result.id,
      name: result.name,
      orgId: result.orgId,
    });
    return result;
  }

  async listDatasets(orgId: string, status?: string): Promise<TrainingDataset[]> {
    return this.datasets.list(orgId, status);
  }

  async getDataset(orgId: string, id: string): Promise<TrainingDataset | null> {
    return this.datasets.getById(orgId, id);
  }

  async startTrainingRun(
    orgId: string,
    datasetId: string,
    config: Record<string, unknown>,
    hyperparameters: Record<string, unknown>,
    initiatedBy?: string
  ): Promise<TrainingRun> {
    const dataset = await this.datasets.getById(orgId, datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    const run = await this.runs.create({
      orgId,
      datasetId,
      status: "running",
      config,
      hyperparameters,
      startedAt: new Date(),
      initiatedBy: initiatedBy ?? "system",
    });

    logger.info("[TrainingPipeline]", "Training run started", { runId: run.id, datasetId, orgId });

    this.executeRunAsync(orgId, run.id, datasetId, config, hyperparameters);

    return run;
  }

  private async executeRunAsync(
    orgId: string,
    runId: string,
    datasetId: string,
    config: Record<string, unknown>,
    hyperparameters: Record<string, unknown>
  ): Promise<void> {
    try {
      const result = await this.runner.execute(datasetId, config, hyperparameters);

      const artifact = await this.artifacts.create({
        orgId,
        artifactType: "trained-model",
        storageUri: result.artifactUri,
        framework: result.framework,
        format: result.format,
        sizeBytes: Math.floor(Math.random() * 10000000),
      });

      await this.runs.update(orgId, runId, {
        status: "completed",
        metrics: result.metrics,
        artifactId: artifact.id,
        finishedAt: new Date(),
      });

      logger.info("[TrainingPipeline]", "Training run completed", {
        runId,
        artifactId: artifact.id,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runs.update(orgId, runId, {
        status: "failed",
        errorMessage: message,
        finishedAt: new Date(),
      });
      logger.error("[TrainingPipeline]", "Training run failed", { runId, error: message });
    }
  }

  async getRunStatus(orgId: string, runId: string): Promise<TrainingRun | null> {
    return this.runs.getById(orgId, runId);
  }

  async listRuns(
    orgId: string,
    filters?: { status?: string; datasetId?: string }
  ): Promise<TrainingRun[]> {
    return this.runs.list(orgId, filters);
  }

  async promoteModelVersion(
    orgId: string,
    runId: string,
    modelId: string,
    version: string,
    changelog?: string
  ): Promise<ModelVersion> {
    const run = await this.runs.getById(orgId, runId);
    if (!run) {
      throw new Error(`Training run ${runId} not found`);
    }
    if (run.status !== "completed") {
      throw new Error(`Training run ${runId} is not completed (status: ${run.status})`);
    }

    const metrics =
      run.metrics && typeof run.metrics === "object"
        ? (run.metrics as Record<string, unknown>)
        : {};
    const metricStr = (key: string): string | undefined => {
      const v = metrics[key];
      return typeof v === "number" || typeof v === "string" ? String(v) : undefined;
    };

    const modelVersion = await this.registry.createVersion({
      orgId,
      modelId,
      version,
      status: "staging",
      accuracy: metricStr("accuracy"),
      precision: metricStr("precision"),
      recall: metricStr("recall"),
      f1Score: metricStr("f1Score"),
      hyperparameters: run.hyperparameters as Record<string, unknown>,
      changelog: changelog ?? `Promoted from training run ${runId}`,
    });

    await this.runs.update(orgId, runId, { modelVersionId: modelVersion.id });

    if (run.artifactId) {
      await this.artifacts.linkToModelVersion(orgId, run.artifactId, modelVersion.id);
    }

    logger.info("[TrainingPipeline]", "Model version promoted", {
      runId,
      modelId,
      modelVersionId: modelVersion.id,
      version,
    });

    return modelVersion;
  }

  async listArtifacts(orgId: string, modelVersionId: string): Promise<ModelArtifact[]> {
    return this.artifacts.listByModelVersion(orgId, modelVersionId);
  }
}
