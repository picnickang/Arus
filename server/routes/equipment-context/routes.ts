/**
 * Equipment Context Routes - Route handlers
 */

import type { Express } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { equipment } from "@shared/schema-runtime";
import { logger } from "../../utils/logger.js";
import { generalApiRateLimit } from "../../config/rate-limits";
import { contextQuerySchema } from "./types";
import { buildEquipmentContext } from "./context-builder";
import { handleEquipmentSummary } from "./summary-handler";

export function registerEquipmentContextRoutes(app: Express) {
  app.get("/api/context/equipment/:equipmentId", generalApiRateLimit, async (req, res) => {
    try {
      const { equipmentId } = req.params;
      const queryResult = contextQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        return res.status(400).json({
          error: "Invalid query parameters",
          details: queryResult.error.issues,
        });
      }

      const options = queryResult.data;
      const orgId = options.orgId;

      const [equipmentRecord] = await db
        .select()
        .from(equipment)
        .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
        .limit(1);

      if (!equipmentRecord) {
        return res.status(404).json({ error: "Equipment not found or access denied" });
      }

      const timeframeStart = new Date();
      timeframeStart.setDate(timeframeStart.getDate() - options.timeframeDays);

      const context = await buildEquipmentContext(
        equipmentId,
        orgId,
        equipmentRecord,
        timeframeStart,
        options
      );

      logger.info("Equipment context generated", undefined, {
        equipmentId,
        orgId,
        dataCompleteness: context.metadata.dataCompleteness,
      });

      return res.json(context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error("Failed to generate equipment context", {
        error: errorMessage,
        stack: errorStack,
        equipmentId: req.params['equipmentId'],
      });
      return res
        .status(500)
        .json({ error: "Failed to generate equipment context", details: errorMessage });
    }
  });

  app.get(
    "/api/context/equipment/:equipmentId/summary",
    generalApiRateLimit,
    handleEquipmentSummary
  );
}
