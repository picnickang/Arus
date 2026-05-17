/**
 * ML Model Lineage Tracker
 * Records training provenance, artifact hashes, and prediction counts
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { LineageRecord, LineageDelta, ModelFamily, DeploymentStage } from "./types.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Governance:Lineage");

const LINEAGE_FILE = process.env.LINEAGE_FILE ?? "./checkpoints/lineage.jsonl";

/**
 * Compute SHA-256 hash of a file
 */
export async function sha256File(filePath: string): Promise<string> {
  try {
    const h = createHash("sha256");
    const content = await fs.readFile(filePath);
    h.update(content);
    return h.digest("hex");
  } catch (error) {
    logger.error(`[Lineage] Failed to hash file ${filePath}:`, undefined, error);
    throw error;
  }
}

/**
 * Compute SHA-256 hash of a string or object
 */
export function sha256(data: string | Record<string, any>): string {
  const h = createHash("sha256");
  const content =
    typeof data === "string"
      ? data
      : JSON.stringify(
          data,
          Object.keys(data).sort((a, b) => a.localeCompare(b))
        );
  h.update(content);
  return h.digest("hex");
}

/**
 * Append a lineage record to the JSONL file
 */
export async function appendLineage(rec: LineageRecord | LineageDelta): Promise<void> {
  try {
    await fs.mkdir(path.dirname(LINEAGE_FILE), { recursive: true });
    await fs.appendFile(LINEAGE_FILE, `${JSON.stringify(rec)}\n`, "utf8");
    logger.info(`[Lineage] Recorded: ${JSON.stringify(rec).substring(0, 100)}...`);
  } catch (error) {
    logger.error("[Lineage] Failed to append lineage:", undefined, error);
    throw error;
  }
}

/**
 * Record model training event with full lineage
 */
export async function recordTraining(
  opts: Omit<LineageRecord, "predictionCount">
): Promise<LineageRecord> {
  const record: LineageRecord = {
    ...opts,
    predictionCount: 0,
  };

  await appendLineage(record);
  logger.info(`[Lineage] Recorded training for model ${record.modelId} (${record.family}/${record.profile})`);

  return record;
}

/**
 * Increment prediction count for a model
 */
export async function incrementPredCount(modelId: string, orgId: string): Promise<void> {
  const delta: LineageDelta = {
    type: "predCount",
    modelId,
    orgId, // SECURITY: Include orgId in delta
    ts: new Date().toISOString(),
    inc: 1,
  };

  await appendLineage(delta);
}

/**
 * Record model promotion to a new stage
 */
export async function recordPromotion(params: {
  modelId: string;
  orgId: string; // SECURITY: Require orgId
  stage: DeploymentStage;
  promotedBy: string;
}): Promise<void> {
  const delta: LineageDelta = {
    type: "promotion",
    modelId: params.modelId,
    orgId: params.orgId, // SECURITY: Include orgId in delta
    stage: params.stage,
    promotedBy: params.promotedBy,
    ts: new Date().toISOString(),
  };

  await appendLineage(delta);
  logger.info(`[Lineage] Promoted model ${params.modelId} to ${params.stage} by ${params.promotedBy} (org: ${params.orgId})`);
}

/**
 * Read all lineage records and apply deltas
 */
export async function getLineageRecords(filters?: {
  orgId?: string;
  profile?: string;
  family?: ModelFamily;
  stage?: DeploymentStage;
  vesselId?: string;
  from?: Date;
  to?: Date;
}): Promise<LineageRecord[]> {
  try {
    const text = await fs.readFile(LINEAGE_FILE, "utf8");
    const rows = text.trim().split("\n").filter(Boolean).map((l: string) => JSON.parse(l));

    // Separate base records and deltas
    const baseRecords = rows.filter((r: any) => !r.type) as LineageRecord[];
    const deltas = rows.filter((r: any) => r.type) as LineageDelta[];

    // Apply deltas to base records
    const recordMap = new Map<string, LineageRecord>();
    baseRecords.forEach((rec) => recordMap.set(rec.modelId, { ...rec }));

    // SECURITY: Apply deltas with tenant isolation validation
    deltas.forEach((delta) => {
      const rec = recordMap.get(delta.modelId);
      if (!rec) {
        return;
      }

      // SECURITY: Ignore deltas from different organizations (prevent cross-tenant tampering)
      if (delta.orgId !== rec.orgId) {
        logger.warn(`[Lineage] SECURITY: Ignoring cross-tenant delta for model ${delta.modelId} (delta org: ${delta.orgId}, model org: ${rec.orgId})`);
        return;
      }

      if (delta.type === "predCount" && delta.inc) {
        rec.predictionCount += delta.inc;
      } else if (delta.type === "promotion" && delta.stage) {
        rec.promotion = {
          ...rec.promotion,
          stage: delta.stage,
          promotedAt: delta.ts,
          promotedBy: delta.promotedBy,
        };
      }
    });

    // Apply filters
    let results = Array.from(recordMap.values());

    // SECURITY: Filter by orgId first (tenant isolation)
    if (filters?.orgId) {
      results = results.filter((r) => r.orgId === filters.orgId);
    }

    if (filters?.profile) {
      results = results.filter((r) => r.profile === filters.profile);
    }

    if (filters?.family) {
      results = results.filter((r) => r.family === filters.family);
    }

    if (filters?.stage) {
      results = results.filter((r) => r.promotion.stage === filters.stage);
    }

    if (filters?.vesselId) {
      results = results.filter((r) => r.vesselId === filters.vesselId);
    }

    if (filters?.from) {
      results = results.filter((r) => new Date(r.createdAt) >= filters.from!);
    }

    if (filters?.to) {
      results = results.filter((r) => new Date(r.createdAt) <= filters.to!);
    }

    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: unknown) {
    const errorCode =
      error instanceof Error && "code" in error ? (error as { code: string }).code : undefined;
    if (errorCode === "ENOENT") {
      return [];
    }
    logger.error("[Lineage] Failed to read lineage records:", undefined, error);
    throw error;
  }
}

/**
 * Get lineage for a specific model
 * SECURITY: Requires orgId for tenant isolation
 */
export async function getModelLineage(
  modelId: string,
  orgId: string
): Promise<LineageRecord | null> {
  const records = await getLineageRecords({ orgId }); // SECURITY: Filter by orgId
  return records.find((r) => r.modelId === modelId) ?? null;
}

/**
 * Compare two models
 * SECURITY: Requires orgId for tenant isolation
 */
export async function compareModels(
  modelId1: string,
  modelId2: string,
  orgId: string
): Promise<{
  model1: LineageRecord | null;
  model2: LineageRecord | null;
  datasetDiff: any;
  hyperparameterDiff: any;
  metricsDiff: any;
}> {
  const model1 = await getModelLineage(modelId1, orgId); // SECURITY: Pass orgId
  const model2 = await getModelLineage(modelId2, orgId); // SECURITY: Pass orgId

  if (!model1 || !model2) {
    return {
      model1,
      model2,
      datasetDiff: null,
      hyperparameterDiff: null,
      metricsDiff: null,
    };
  }

  return {
    model1,
    model2,
    datasetDiff: {
      model1: model1.datasetMix,
      model2: model2.datasetMix,
      differences: model1.datasetMix.filter(
        (d1) => !model2.datasetMix.some((d2) => d2.name === d1.name && d2.weight === d1.weight)
      ),
    },
    hyperparameterDiff: {
      model1: model1.hyperparams,
      model2: model2.hyperparams,
      differences: Object.keys({ ...model1.hyperparams, ...model2.hyperparams }).reduce(
        (acc, key) => {
          if (model1.hyperparams[key] !== model2.hyperparams[key]) {
            acc[key] = { model1: model1.hyperparams[key], model2: model2.hyperparams[key] };
          }
          return acc;
        },
        {} as Record<string, any>
      ),
    },
    metricsDiff: {
      model1: model1.metrics,
      model2: model2.metrics,
      differences: Object.keys({ ...model1.metrics, ...model2.metrics }).reduce(
        (acc, key) => {
          if (model1.metrics[key] !== model2.metrics[key]) {
            acc[key] = {
              model1: model1.metrics[key],
              model2: model2.metrics[key],
              delta: (model2.metrics[key] || 0) - (model1.metrics[key] || 0),
            };
          }
          return acc;
        },
        {} as Record<string, any>
      ),
    },
  };
}
