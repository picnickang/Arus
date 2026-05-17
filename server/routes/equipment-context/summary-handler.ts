/**
 * Equipment Summary Handler - Lightweight equipment summary endpoint
 */

import { Request, Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  equipment,
  alertNotifications,
  failurePredictions,
  pdmScoreLogs,
  actionableInsights,
} from "@shared/schema-runtime";
import { logger } from "../../utils/logger.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export async function handleEquipmentSummary(req: Request, res: Response) {
  try {
    const { equipmentId } = req.params;
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "orgId is required" });
    }

    const equipmentResults = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .limit(1);
    const equipmentRecord = equipmentResults[0];

    if (!equipmentRecord) {
      return res.status(404).json({ error: "Equipment not found or access denied" });
    }

    let alertCount = 0;
    let insightCount = 0;
    let pdmScore: number | null = null;
    let latestPrediction: any = null;

    try {
      const alertResult = await db
        .select({ id: alertNotifications.id })
        .from(alertNotifications)
        .where(
          and(
            eq(alertNotifications.equipmentId, equipmentId),
            eq(alertNotifications.orgId, orgId),
            eq(alertNotifications.acknowledged, false)
          )
        );
      alertCount = alertResult.length;
    } catch (e) {
      logger.warn("Summary alert query failed", {
        equipmentId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const insightResult = await db
        .select({ id: actionableInsights.id })
        .from(actionableInsights)
        .where(
          and(
            eq(actionableInsights.equipmentId, equipmentId),
            eq(actionableInsights.orgId, orgId),
            eq(actionableInsights.resolved, false)
          )
        );
      insightCount = insightResult.length;
    } catch (e) {
      logger.warn("Summary insight query failed", {
        equipmentId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const pdmResult = await db
        .select({ healthIdx: pdmScoreLogs.healthIdx })
        .from(pdmScoreLogs)
        .where(eq(pdmScoreLogs.equipmentId, equipmentId))
        .orderBy(sql`${pdmScoreLogs.ts} DESC`)
        .limit(1);
      pdmScore = pdmResult[0]?.healthIdx ?? null;
    } catch (e) {
      logger.warn("Summary PDM score query failed", {
        equipmentId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const predResult = await db
        .select({
          remainingUsefulLife: failurePredictions.remainingUsefulLife,
          failureProbability: failurePredictions.failureProbability,
        })
        .from(failurePredictions)
        .where(eq(failurePredictions.equipmentId, equipmentId))
        .orderBy(sql`${failurePredictions.predictionTimestamp} DESC`)
        .limit(1);
      latestPrediction = predResult[0] ?? null;
    } catch (e) {
      logger.warn("Summary prediction query failed", {
        equipmentId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    res.json({
      equipment: equipmentRecord,
      summary: {
        activeAlerts: alertCount,
        activeInsights: insightCount,
        pdmScore,
        rul: latestPrediction?.remainingUsefulLife ?? null,
        failureProbability: latestPrediction?.failureProbability ?? null,
        healthStatus:
          pdmScore !== null
            ? pdmScore >= 80
              ? "healthy"
              : pdmScore >= 60
                ? "warning"
                : "critical"
            : "unknown",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to generate equipment summary", {
      message: err.message,
      stack: err.stack,
      equipmentId: req.params.equipmentId,
      orgId: DEFAULT_ORG_ID,
    });
    res.status(500).json({ error: "Failed to generate equipment summary" });
  }
}
