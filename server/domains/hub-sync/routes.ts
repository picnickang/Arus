import type { Express, Request, Response } from "express";
import { z } from "zod";
import { hubSyncService } from "./service";
import { insertReplayIncomingSchema, insertSheetVersionSchema, insertOptimizerConfigurationSchema } from "@shared/schema-runtime";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { withErrorHandling, handleApiError, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

export function registerHubSyncRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimiters;

  // ===== REPLAY HELPER ENDPOINTS =====
  app.post("/api/replay", generalApiRateLimit,
    withErrorHandling("log replay request", async (req: Request, res: Response) => {
      const validatedData = insertReplayIncomingSchema.parse(req.body);
      const request = await hubSyncService.logReplayRequest(validatedData);
      res.status(201).json(request);
    })
  );

  app.get("/api/replay/history", generalApiRateLimit,
    withErrorHandling("get replay history", async (req: Request, res: Response) => {
      const replayHistoryQuerySchema = z.object({
        deviceId: z.string().optional(),
        endpoint: z.string().optional(),
      });

      const validatedQuery = replayHistoryQuerySchema.parse(req.query);
      const history = await hubSyncService.getReplayHistory(
        validatedQuery.deviceId,
        validatedQuery.endpoint
      );
      res.json(history);
    })
  );

  // ===== SHEET LOCKING ENDPOINTS =====
  app.post("/api/sheets/lock", generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const { sheetKey, holder, token, expiresAt } = req.body;

      if (!sheetKey || !holder || !token || !expiresAt) {
        return res.status(400).json({
          error: "Missing required fields: sheetKey, holder, token, expiresAt",
        });
      }

      const lock = await hubSyncService.acquireSheetLock(sheetKey, holder, token, new Date(expiresAt));
      res.status(201).json(lock);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already locked")) {
        return res.status(409).json({ error: error.message });
      }
      handleApiError(res, error, "acquire sheet lock");
    }
  });

  app.delete("/api/sheets/lock", generalApiRateLimit,
    withErrorHandling("release sheet lock", async (req: Request, res: Response) => {
      const { sheetKey, token } = req.body;

      if (!sheetKey || !token) {
        res.status(400).json({
          error: "Missing required fields: sheetKey, token",
        });
        return;
      }

      await hubSyncService.releaseSheetLock(sheetKey, token);
      res.json({ ok: true, message: "Sheet lock released successfully" });
    })
  );

  app.get("/api/sheets/lock/:sheetKey", generalApiRateLimit,
    withErrorHandling("get sheet lock", async (req: Request, res: Response) => {
      const lock = await hubSyncService.getSheetLock(req.params.sheetKey);
      if (!lock) {
        return sendNotFound(res, "Sheet lock");
      }
      res.json(lock);
    })
  );

  app.get("/api/sheets/lock/:sheetKey/status", generalApiRateLimit,
    withErrorHandling("check sheet lock status", async (req: Request, res: Response) => {
      const isLocked = await hubSyncService.isSheetLocked(req.params.sheetKey);
      res.json({ sheetKey: req.params.sheetKey, isLocked });
    })
  );

  // ===== SHEET VERSIONING ENDPOINTS =====
  app.get("/api/sheets/version/:sheetKey", generalApiRateLimit,
    withErrorHandling("get sheet version", async (req: Request, res: Response) => {
      const version = await hubSyncService.getSheetVersion(req.params.sheetKey);
      if (!version) {
        return sendNotFound(res, "Sheet version");
      }
      res.json(version);
    })
  );

  app.post("/api/sheets/version/:sheetKey/increment", generalApiRateLimit,
    withErrorHandling("increment sheet version", async (req: Request, res: Response) => {
      const { modifiedBy } = req.body;

      if (!modifiedBy) {
        res.status(400).json({
          error: "Missing required field: modifiedBy",
        });
        return;
      }

      const version = await hubSyncService.incrementSheetVersion(req.params.sheetKey, modifiedBy);
      res.json(version);
    })
  );

  app.post("/api/sheets/version", generalApiRateLimit,
    withErrorHandling("set sheet version", async (req: Request, res: Response) => {
      const validatedData = insertSheetVersionSchema.parse(req.body);
      const version = await hubSyncService.setSheetVersion(validatedData);
      res.json(version);
    })
  );

  // ===== OPTIMIZATION TOOLS API =====
  app.get("/api/optimization/configurations", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch optimizer configurations", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || (req.query.orgId as string);
      const configs = await hubSyncService.getOptimizerConfigurations(orgId);
      res.json(configs);
    })
  );

  app.post("/api/optimization/configurations", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create optimizer configuration", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || req.body.orgId;
      const configData = {
        ...req.body,
        orgId,
        config: JSON.stringify(req.body.config ?? {}),
      };

      const validatedConfig = insertOptimizerConfigurationSchema.parse(configData);
      const config = await hubSyncService.createOptimizerConfiguration(validatedConfig);
      res.status(201).json(config);
    })
  );

  app.delete("/api/optimization/configurations/:id", writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await hubSyncService.deleteOptimizerConfiguration(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return sendNotFound(res, "Optimizer configuration");
      }
      handleApiError(res, error, "delete optimizer configuration");
    }
  });

  app.get("/api/optimization/results", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch optimization results", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || (req.query.orgId as string);
      const results = await hubSyncService.getOptimizationResults(orgId);
      res.json(results);
    })
  );

  app.post("/api/optimization/run", writeOperationRateLimit,
    withErrorHandling("start optimization run", async (req: Request, res: Response) => {
      const runOptimizationSchema = z.object({
        configId: z.string().uuid("Configuration ID must be a valid UUID"),
        equipmentScope: z.array(z.string()).optional(),
        timeHorizon: z.number().int().min(1).max(365).optional(),
      });

      const validatedData = runOptimizationSchema.parse(req.body);
      const { configId, equipmentScope, timeHorizon } = validatedData;

      const orgId = (req as AuthenticatedRequest).orgId || (req.query.orgId as string);
      const result = await hubSyncService.runOptimization(configId, equipmentScope, timeHorizon, orgId);
      res.json(result);
    })
  );

  app.delete("/api/optimization/cancel/:id", writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await hubSyncService.cancelOptimization(id);
      res.json({ message: "Optimization cancelled successfully", result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found")) {
        return res.status(404).json({ message });
      }
      if (message.includes("Cannot cancel")) {
        return res.status(400).json({ message });
      }
      handleApiError(res, error, "cancel optimization");
    }
  });

  app.post("/api/optimization/:id/apply", writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await hubSyncService.applyOptimizationToProduction(id);
      res.json({ message: "Optimization applied to production successfully", result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found")) {
        return res.status(404).json({ message });
      }
      if (message.includes("Cannot apply") || message.includes("already applied")) {
        return res.status(400).json({ message });
      }
      handleApiError(res, error, "apply optimization to production");
    }
  });

  app.get("/api/optimization/:id/download", generalApiRateLimit,
    withErrorHandling("download optimization result", async (req: Request, res: Response) => {
      const { id } = req.params;
      const result = await hubSyncService.getOptimizationResult(id);
      if (!result) {
        return sendNotFound(res, "Optimization result");
      }

      const filename = `optimization-${id}-${new Date().toISOString().split("T")[0]}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      res.json(result);
    })
  );

  app.delete("/api/optimization/results/:id", writeOperationRateLimit,
    withErrorHandling("delete optimization result", async (req: Request, res: Response) => {
      const { id } = req.params;
      await hubSyncService.deleteOptimizationResult(id);
      res.status(204).send();
    })
  );

  app.delete("/api/optimization/results", requireOrgId, writeOperationRateLimit,
    withErrorHandling("delete all optimization results", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || (req.query.orgId as string);
      const deletedCount = await hubSyncService.deleteAllOptimizationResults(orgId);
      res.json({
        message: "All optimization results deleted successfully",
        deletedCount,
      });
    })
  );

  // ===== SHIFT TEMPLATES =====
  app.get("/api/shift-templates", generalApiRateLimit,
    withErrorHandling("get shift templates", async (req: Request, res: Response) => {
      const { orgId } = req.query;
      const templates = await hubSyncService.getShiftTemplates(orgId as string);
      res.json(templates);
    })
  );

  app.post("/api/shift-templates", writeOperationRateLimit,
    withErrorHandling("create shift template", async (req: Request, res: Response) => {
      const template = await hubSyncService.createShiftTemplate(req.body);
      res.json(template);
    })
  );

  app.delete("/api/shift-templates/:id", writeOperationRateLimit,
    withErrorHandling("delete shift template", async (req: Request, res: Response) => {
      await hubSyncService.deleteShiftTemplate(req.params.id);
      res.json({
        ok: true,
        message: "Shift template deleted successfully",
      });
    })
  );

  logger.info("HubSyncRoutes", "Registered (replay: 2, sheets: 7, optimization: 10, templates: 3)");
}
