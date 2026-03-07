import type {
  TrainingDataset,
  InsertTrainingDataset,
  TrainingRun,
  InsertTrainingRun,
  ModelArtifact,
  InsertModelArtifact,
} from "@shared/schema";

export interface ITrainingDatasetStorage {
  create(data: InsertTrainingDataset): Promise<TrainingDataset>;
  getById(orgId: string, id: string): Promise<TrainingDataset | null>;
  list(orgId: string, status?: string): Promise<TrainingDataset[]>;
  updateStatus(orgId: string, id: string, status: string): Promise<TrainingDataset | null>;
}

export interface ITrainingRunStorage {
  create(data: InsertTrainingRun): Promise<TrainingRun>;
  getById(orgId: string, id: string): Promise<TrainingRun | null>;
  list(orgId: string, filters?: { status?: string; datasetId?: string }): Promise<TrainingRun[]>;
  update(orgId: string, id: string, data: Partial<TrainingRun>): Promise<TrainingRun | null>;
}

export interface IModelArtifactStorage {
  create(data: InsertModelArtifact): Promise<ModelArtifact>;
  getById(orgId: string, id: string): Promise<ModelArtifact | null>;
  listByModelVersion(orgId: string, modelVersionId: string): Promise<ModelArtifact[]>;
  linkToModelVersion(orgId: string, artifactId: string, modelVersionId: string): Promise<void>;
}

export interface ITrainingRunnerPort {
  execute(
    datasetId: string,
    config: Record<string, unknown>,
    hyperparameters: Record<string, unknown>
  ): Promise<{
    metrics: Record<string, number>;
    artifactUri: string;
    framework: string;
    format: string;
  }>;
}
