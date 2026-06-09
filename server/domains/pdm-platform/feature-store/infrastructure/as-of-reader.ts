/**
 * Push A1 — Point-in-time feature reader.
 *
 * The `failurePredictions` table already carries `featureSnapshotId`
 * pointing at the exact `equipment_features` row used to produce the
 * prediction (Wave 3, Prediction Lineage). This module adds an explicit
 * "as-of" reader so trainers and back-testers can re-load that exact
 * feature vector for a stored prediction without depending on a
 * "latest features" shortcut.
 *
 * The function is intentionally thin: it is the only place that knows
 * how to translate a `(orgId, snapshotId)` pair into a typed
 * `EquipmentFeature`, so future migrations to a versioned feature store
 * have a single rewrite point.
 */

import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "../../../../db";
import { equipmentFeatures, failurePredictions } from "@shared/schema-runtime";
import type { EquipmentFeature } from "@shared/schema-runtime";

export async function getFeaturesBySnapshotId(
  orgId: string,
  snapshotId: string
): Promise<EquipmentFeature | null> {
  const [row] = await db
    .select()
    .from(equipmentFeatures)
    .where(and(eq(equipmentFeatures.orgId, orgId), eq(equipmentFeatures.id, snapshotId)))
    .limit(1);
  return row ?? null;
}

/**
 * Returns the most recent feature row whose `timestamp <= asOf`. Used by
 * back-testers to reconstruct what the model would have seen at an
 * arbitrary historical instant, regardless of whether a snapshot was
 * persisted at that exact moment.
 */
/**
 * Push A1 — Single-call reproducibility helper. Given a stored
 * prediction id, resolves the exact `equipment_features` row that
 * produced it via `failure_predictions.feature_snapshot_id`. Returns
 * null when either the prediction or its snapshot is missing.
 * Powers the "what features did this prediction see?" audit path
 * without the caller having to walk two tables.
 */
export async function getFeaturesByPredictionId(
  orgId: string,
  predictionId: number
): Promise<EquipmentFeature | null> {
  const [pred] = await db
    .select({ snapshotId: failurePredictions.featureSnapshotId })
    .from(failurePredictions)
    .where(and(eq(failurePredictions.id, predictionId), eq(failurePredictions.orgId, orgId)))
    .limit(1);
  if (!pred?.snapshotId) {
    return null;
  }
  return getFeaturesBySnapshotId(orgId, pred.snapshotId);
}

export async function getFeaturesAsOf(
  orgId: string,
  equipmentId: string,
  asOf: Date
): Promise<EquipmentFeature | null> {
  const [row] = await db
    .select()
    .from(equipmentFeatures)
    .where(
      and(
        eq(equipmentFeatures.orgId, orgId),
        eq(equipmentFeatures.equipmentId, equipmentId),
        lte(equipmentFeatures.timestamp, asOf)
      )
    )
    .orderBy(desc(equipmentFeatures.timestamp))
    .limit(1);
  return row ?? null;
}
