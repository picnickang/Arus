/**
 * PdM Services - Alert Operations
 * Recording and retrieving PdM alerts
 */

import { eq, sql } from "drizzle-orm";
import { pdmAlerts, PdmAlert } from "../../shared/schema.js";
import { recordAlert as recordProvenanceAlert } from "../governance/provenance.js";
import type { AlertRecord } from "./types.js";

/**
 * Record PdM alert to database
 */
export async function recordAlert(db: any, orgId: string, alert: AlertRecord): Promise<void> {
  console.log(
    `[PdM Service] Recording ${alert.severity} alert for ${alert.assetClass} ${alert.assetId}`
  );

  const featuresWithScores = Object.entries(alert.scores);

  if (featuresWithScores.length === 0) {
    console.warn(`[PdM Service] No scores available for ${alert.assetId}, skipping alert`);
    return;
  }

  const [primaryFeature, primaryScore] = featuresWithScores.reduce((worst, [feat, score]) => {
    return Math.abs(score) > Math.abs(worst[1]) ? [feat, score] : worst;
  }, featuresWithScores[0]);

  const primaryValue = alert.features[primaryFeature];

  const insertResult = await db
    .insert(pdmAlerts)
    .values({
      orgId,
      vesselName: alert.vesselName,
      assetId: alert.assetId,
      assetClass: alert.assetClass,
      feature: primaryFeature,
      value: primaryValue,
      scoreZ: primaryScore,
      severity: alert.severity,
      explain: alert.explanation,
    })
    .returning({ id: pdmAlerts.id });

  try {
    const alertId = insertResult[0]?.id?.toString() || `alert_${Date.now()}`;
    await recordProvenanceAlert({
      orgId,
      alertId,
      vesselId: alert.vesselName,
      equipmentId: alert.assetId,
      severity: alert.severity,
      source: "rule",
    });
  } catch (error) {
    console.warn(`[Provenance] Failed to record alert event for ${alert.assetId}:`, error);
  }
}

/**
 * Get recent PdM alerts for organization
 */
export async function getRecentAlerts(db: any, orgId: string, limit: number = 200): Promise<PdmAlert[]> {
  return db
    .select()
    .from(pdmAlerts)
    .where(eq(pdmAlerts.orgId, orgId))
    .orderBy(sql`${pdmAlerts.at} DESC`)
    .limit(limit);
}
