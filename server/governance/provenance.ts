/**
 * Event Provenance Service
 * Tamper-evident chain hashing for predictions, alerts, and critical events
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProvenanceEvent, ProvenanceVerificationResult } from "./types.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Governance:Provenance");

const PROV_FILE = process.env['PROVENANCE_FILE'] ?? "./checkpoints/provenance.jsonl";

/**
 * Compute SHA-256 hash of a string
 */
function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Get the hash of the last provenance event
 */
async function lastHash(): Promise<string | null> {
  try {
    const text = await fs.readFile(PROV_FILE, "utf8");
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      return null;
    }

    const lastLine = lines[lines.length - 1];
    if (!lastLine) return null;
    const last = JSON.parse(lastLine);
    return last.hash as string;
  } catch (error: unknown) {
    const errorCode =
      error instanceof Error && "code" in error ? (error as { code: string }).code : undefined;
    if (errorCode === "ENOENT") {
      return null;
    }
    logger.error("[Provenance] Error reading last hash:", undefined, error);
    return null;
  }
}

/**
 * Append a provenance event with chain hashing
 */
export async function appendProvenance(
  event: Omit<ProvenanceEvent, "ts" | "prevHash" | "hash">
): Promise<ProvenanceEvent> {
  try {
    await fs.mkdir(path.dirname(PROV_FILE), { recursive: true });

    const prev = await lastHash();
    const payload: ProvenanceEvent = {
      ...event,
      ts: new Date().toISOString(),
      prevHash: prev,
    };

    // Compute hash of the payload (excluding hash field)
    const hash = sha256(JSON.stringify(payload));
    const row: ProvenanceEvent = { ...payload, hash };

    await fs.appendFile(PROV_FILE, `${JSON.stringify(row)}\n`, "utf8");

    logger.info(`[Provenance] Recorded ${event.type} event (hash: ${hash.substring(0, 8)}...)`);

    return row;
  } catch (error) {
    logger.error("[Provenance] Failed to append provenance:", undefined, error);
    throw error;
  }
}

/**
 * Record a prediction event
 */
export async function recordPrediction(params: {
  modelId: string;
  vesselId?: string;
  equipmentId?: string;
  profile: string;
  anomalyScore: number;
  contributors?: Array<{ sensor: string; weight: number }>;
  rawSliceHash: string;
  engine: "tfjs" | "onnx" | "xgboost" | "rf";
  orgId: string;
  userId?: string;
}): Promise<ProvenanceEvent> {
  return appendProvenance({
    type: "prediction",
    ...params,
  });
}

/**
 * Record an alert event
 */
export async function recordAlert(params: {
  alertId: string;
  vesselId?: string;
  equipmentId?: string;
  severity: string;
  source: "anomaly" | "rule" | "operator";
  orgId: string;
  userId?: string;
}): Promise<ProvenanceEvent> {
  return appendProvenance({
    type: "alert",
    ...params,
  });
}

/**
 * Record an anomaly detection event
 */
export async function recordAnomaly(params: {
  equipmentId: string;
  vesselId?: string;
  anomalyScore: number;
  contributors?: Array<{ sensor: string; weight: number }>;
  modelId?: string;
  orgId: string;
}): Promise<ProvenanceEvent> {
  return appendProvenance({
    type: "anomaly",
    ...params,
  });
}

/**
 * Record a work order creation event
 */
export async function recordWorkOrder(params: {
  workOrderId: string;
  linkedAlertId?: string;
  vesselId?: string;
  equipmentId?: string;
  orgId: string;
  userId?: string;
}): Promise<ProvenanceEvent> {
  return appendProvenance({
    type: "work_order",
    ...params,
  });
}

/**
 * Record a model training event
 */
export async function recordTraining(params: {
  modelId: string;
  checkpointHash: string;
  datasetHash: string;
  orgId: string;
  userId?: string;
}): Promise<ProvenanceEvent> {
  return appendProvenance({
    type: "training",
    ...params,
  });
}

/**
 * Record a RUL prediction event (ML Governance)
 *
 * Captures RUL predictions with data status for governance transparency.
 * CRITICAL: dataStatus differentiates "no data" from "low risk"
 * - Allows auditors to verify predictions were based on actual telemetry
 * - Prevents false low-risk assessments when equipment has no data
 * - Enables regulatory compliance for ISM/Class/Flag requirements
 */
export async function recordRulPrediction(params: {
  equipmentId: string;
  vesselId?: string;
  remainingDays: number;
  riskLevel: string;
  confidenceScore: number;
  dataStatus: "sufficient_data" | "limited_data" | "no_data" | "stale_data";
  dataStatusReason?: string;
  predictionMethod?: string;
  modelId?: string;
  orgId: string;
  userId?: string;
}): Promise<ProvenanceEvent> {
  // Log data quality warnings for governance visibility
  if (params.dataStatus !== "sufficient_data") {
    logger.warn(`[Provenance] RUL prediction with ${params.dataStatus}: equipment ${params.equipmentId} - ${params.dataStatusReason}`);
  }

  return appendProvenance({
    type: "rul_prediction",
    ...params,
  });
}

/**
 * Record an engineer override event (ML Governance)
 *
 * Captures when an engineer overrides an ML prediction, including:
 * - Original prediction details for audit trail
 * - Override type and justification
 * - Engineer credentials at time of override
 *
 * CRITICAL: This is immutable for regulatory compliance (ISM/Class/Flag)
 */
export async function recordEngineerOverride(params: {
  overrideId: string;
  predictionId?: string;
  equipmentId: string;
  vesselId?: string;
  workOrderId?: string;
  overrideType: "defer" | "escalate" | "dismiss" | "modify";
  originalRiskLevel: string;
  newRiskLevel?: string;
  originalConfidence?: number;
  justification: string;
  engineerId: string;
  engineerName: string;
  engineerCertifications?: string[];
  originalPrediction?: Record<string, unknown>;
  modelId?: string;
  orgId: string;
}): Promise<ProvenanceEvent> {
  logger.info(`[Provenance] Recording engineer override: ${params.overrideType} by ${params.engineerName}`);

  return appendProvenance({
    type: "engineer_override",
    ...params,
  });
}

/**
 * Record an engineer override outcome update event (ML Governance lifecycle)
 *
 * Tracks the lifecycle of an override decision:
 * - pending → validated (decision was correct)
 * - pending → failure_prevented (override prevented a failure)
 * - pending → failure_occurred (override was wrong, failure happened)
 *
 * CRITICAL: This is immutable for regulatory compliance (ISM/Class/Flag)
 */
export async function recordOverrideOutcome(params: {
  overrideId: string;
  equipmentId: string;
  vesselId?: string;
  originalOverrideType: "defer" | "escalate" | "dismiss" | "modify";
  outcomeStatus: "pending" | "validated" | "failure_prevented" | "failure_occurred";
  outcomeNotes?: string;
  outcomeRecordedBy: string;
  engineerId: string;
  engineerName: string;
  orgId: string;
}): Promise<ProvenanceEvent> {
  logger.info(`[Provenance] Recording override outcome: ${params.outcomeStatus} for override ${params.overrideId}`);

  return appendProvenance({
    type: "override_outcome",
    ...params,
  });
}

/**
 * Get engineer override events for compliance reporting
 */
export async function getEngineerOverrides(filters?: {
  equipmentId?: string;
  vesselId?: string;
  engineerId?: string;
  overrideType?: string;
  from?: Date;
  to?: Date;
  orgId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: ProvenanceEvent[]; total: number }> {
  const result = await getProvenanceEvents({
    type: "engineer_override",
    ...filters,
  });

  // Additional filtering for engineer override-specific fields
  let events = result.events;

  if (filters?.engineerId) {
    events = events.filter((e) => e.engineerId === filters.engineerId);
  }

  if (filters?.overrideType) {
    events = events.filter((e) => e.overrideType === filters.overrideType);
  }

  return { events, total: events.length };
}

/**
 * Get provenance events with filters
 */
export async function getProvenanceEvents(filters?: {
  type?: ProvenanceEvent["type"];
  vesselId?: string;
  equipmentId?: string;
  modelId?: string;
  from?: Date;
  to?: Date;
  orgId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: ProvenanceEvent[]; total: number }> {
  try {
    const text = await fs.readFile(PROV_FILE, "utf8");
    let events = text.trim().split("\n").filter(Boolean).map((l: string) => JSON.parse(l)) as ProvenanceEvent[];

    // Apply filters
    if (filters?.type) {
      events = events.filter((e) => e.type === filters.type);
    }

    if (filters?.vesselId) {
      events = events.filter((e) => e.vesselId === filters.vesselId);
    }

    if (filters?.equipmentId) {
      events = events.filter((e) => e.equipmentId === filters.equipmentId);
    }

    if (filters?.modelId) {
      events = events.filter((e) => e.modelId === filters.modelId);
    }

    if (filters?.from) {
      events = events.filter((e) => new Date(e.ts) >= filters.from!);
    }

    if (filters?.to) {
      events = events.filter((e) => new Date(e.ts) <= filters.to!);
    }

    if (filters?.orgId) {
      events = events.filter((e) => e.orgId === filters.orgId);
    }

    const total = events.length;

    // Apply pagination
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 100;
    events = events.slice(offset, offset + limit);

    return { events, total };
  } catch (error: unknown) {
    const errorCode =
      error instanceof Error && "code" in error ? (error as { code: string }).code : undefined;
    if (errorCode === "ENOENT") {
      return { events: [], total: 0 };
    }
    logger.error("[Provenance] Failed to read provenance events:", undefined, error);
    throw error;
  }
}

/**
 * Verify the provenance chain integrity
 */
export async function verifyChain(
  orgId?: string,
  from?: Date,
  to?: Date
): Promise<ProvenanceVerificationResult> {
  try {
    const { events } = await getProvenanceEvents({ orgId, from, to, limit: 100000 });

    if (events.length === 0) {
      return {
        ok: true,
        totalEvents: 0,
      };
    }

    const errors: Array<{ index: number; eventId: string; reason: string }> = [];

    // Verify first event
    const firstEvent = events[0];
    if (firstEvent && firstEvent.prevHash !== null) {
      errors.push({
        index: 0,
        eventId: firstEvent.hash || "unknown",
        reason: "First event should have prevHash=null",
      });
    }

    // Verify chain integrity
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;

      // Verify hash
      const copy = { ...event };
      const expectedHash = copy.hash;
      delete (copy as { hash?: string }).hash;
      const computedHash = sha256(JSON.stringify(copy));

      if (computedHash !== expectedHash) {
        errors.push({
          index: i,
          eventId: expectedHash || "unknown",
          reason: `Hash mismatch: expected ${expectedHash?.substring(0, 8)}... but computed ${computedHash.substring(0, 8)}...`,
        });
      }

      // Verify chain link (except for first event)
      if (i > 0) {
        const prevEvent = events[i - 1];
        if (prevEvent && event.prevHash !== prevEvent.hash) {
          errors.push({
            index: i,
            eventId: expectedHash || "unknown",
            reason: `Chain break: prevHash ${event.prevHash?.substring(0, 8)}... doesn't match previous hash ${prevEvent.hash?.substring(0, 8)}...`,
          });
        }
      }
    }

    const firstError = errors[0];
    const lastEvent = events[events.length - 1];
    return {
      ok: errors.length === 0,
      totalEvents: events.length,
      brokenAt: firstError ? firstError.index : undefined,
      errors: errors.length > 0 ? errors : undefined,
      lastHash: lastEvent ? lastEvent.hash : undefined,
    };
  } catch (error) {
    logger.error("[Provenance] Failed to verify chain:", undefined, error);
    throw error;
  }
}
