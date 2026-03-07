import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import {
  trainingDatasets,
  trainingRuns,
  modelArtifacts,
  type TrainingDataset,
  type InsertTrainingDataset,
  type TrainingRun,
  type InsertTrainingRun,
  type ModelArtifact,
  type InsertModelArtifact,
} from "@shared/schema";
import type {
  ITrainingDatasetStorage,
  ITrainingRunStorage,
  IModelArtifactStorage,
  ITrainingRunnerPort,
} from "./ports";

export class TrainingDatasetAdapter implements ITrainingDatasetStorage {
  async create(data: InsertTrainingDataset): Promise<TrainingDataset> {
    const [result] = await db.insert(trainingDatasets).values(data).returning();
    return result;
  }

  async getById(orgId: string, id: string): Promise<TrainingDataset | null> {
    const [result] = await db
      .select()
      .from(trainingDatasets)
      .where(and(eq(trainingDatasets.orgId, orgId), eq(trainingDatasets.id, id)));
    return result ?? null;
  }

  async list(orgId: string, status?: string): Promise<TrainingDataset[]> {
    const conditions = [eq(trainingDatasets.orgId, orgId)];
    if (status) conditions.push(eq(trainingDatasets.status, status));
    return db
      .select()
      .from(trainingDatasets)
      .where(and(...conditions))
      .orderBy(desc(trainingDatasets.createdAt));
  }

  async updateStatus(orgId: string, id: string, status: string): Promise<TrainingDataset | null> {
    const [result] = await db
      .update(trainingDatasets)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(trainingDatasets.orgId, orgId), eq(trainingDatasets.id, id)))
      .returning();
    return result ?? null;
  }
}

export class TrainingRunAdapter implements ITrainingRunStorage {
  async create(data: InsertTrainingRun): Promise<TrainingRun> {
    const [result] = await db.insert(trainingRuns).values(data).returning();
    return result;
  }

  async getById(orgId: string, id: string): Promise<TrainingRun | null> {
    const [result] = await db
      .select()
      .from(trainingRuns)
      .where(and(eq(trainingRuns.orgId, orgId), eq(trainingRuns.id, id)));
    return result ?? null;
  }

  async list(orgId: string, filters?: { status?: string; datasetId?: string }): Promise<TrainingRun[]> {
    const conditions = [eq(trainingRuns.orgId, orgId)];
    if (filters?.status) conditions.push(eq(trainingRuns.status, filters.status));
    if (filters?.datasetId) conditions.push(eq(trainingRuns.datasetId, filters.datasetId));
    return db
      .select()
      .from(trainingRuns)
      .where(and(...conditions))
      .orderBy(desc(trainingRuns.createdAt));
  }

  async update(orgId: string, id: string, data: Partial<TrainingRun>): Promise<TrainingRun | null> {
    const [result] = await db
      .update(trainingRuns)
      .set(data)
      .where(and(eq(trainingRuns.orgId, orgId), eq(trainingRuns.id, id)))
      .returning();
    return result ?? null;
  }
}

export class ModelArtifactAdapter implements IModelArtifactStorage {
  async create(data: InsertModelArtifact): Promise<ModelArtifact> {
    const [result] = await db.insert(modelArtifacts).values(data).returning();
    return result;
  }

  async getById(orgId: string, id: string): Promise<ModelArtifact | null> {
    const [result] = await db
      .select()
      .from(modelArtifacts)
      .where(and(eq(modelArtifacts.orgId, orgId), eq(modelArtifacts.id, id)));
    return result ?? null;
  }

  async listByModelVersion(orgId: string, modelVersionId: string): Promise<ModelArtifact[]> {
    return db
      .select()
      .from(modelArtifacts)
      .where(and(eq(modelArtifacts.orgId, orgId), eq(modelArtifacts.modelVersionId, modelVersionId)))
      .orderBy(desc(modelArtifacts.createdAt));
  }

  async linkToModelVersion(orgId: string, artifactId: string, modelVersionId: string): Promise<void> {
    await db
      .update(modelArtifacts)
      .set({ modelVersionId })
      .where(and(eq(modelArtifacts.orgId, orgId), eq(modelArtifacts.id, artifactId)));
  }
}

export class StubTrainingRunner implements ITrainingRunnerPort {
  async execute(
    datasetId: string,
    config: Record<string, unknown>,
    hyperparameters: Record<string, unknown>
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const lr = (hyperparameters.learningRate as number) ?? 0.001;
    const epochs = (hyperparameters.epochs as number) ?? 10;

    return {
      metrics: {
        accuracy: 0.85 + Math.random() * 0.1,
        precision: 0.82 + Math.random() * 0.1,
        recall: 0.80 + Math.random() * 0.1,
        f1Score: 0.81 + Math.random() * 0.1,
        loss: 0.3 - Math.random() * 0.15,
        trainingDurationMs: 500 + Math.floor(Math.random() * 2000),
      },
      artifactUri: `artifacts/stub/${datasetId}/${Date.now()}/model.bin`,
      framework: (config.framework as string) ?? "stub-framework",
      format: "binary",
    };
  }
}
