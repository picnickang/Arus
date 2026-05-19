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
import { db } from "../../../db";
import { equipmentFeatures } from "@shared/schema";
import type { EquipmentFeature } from "@shared/schema";

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
