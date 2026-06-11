import { Express, Request, Response, RequestHandler } from "express";
import { insertSettingsSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendDeleted, sendCreated } from "../../lib/route-utils";
import { dbSystemAdminStorage } from "../../db/system-admin/index.js";
import { vesselService } from "../../services/domains/vessel-service";
import { dbEquipmentStorage } from "../../db/equipment/index.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

interface SettingsConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

export function registerSettingsRoutes(app: Express, config: SettingsConfig) {
  const { requireOrgId, writeOperationRateLimit } = config;

  app.get(
    "/api/settings",
    requireOrgId,
    withErrorHandling("fetch settings", async (_req: Request, res: Response) => {
      const settings = await dbSystemAdminStorage.getSettings();
      res.json(settings);
    })
  );

  app.put(
    "/api/settings",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update settings", async (req: Request, res: Response) => {
      const settingsData = insertSettingsSchema.partial().parse(req.body);
      const settings = await dbSystemAdminStorage.updateSettings(settingsData);
      res.json(settings);
    })
  );

  app.get(
    "/api/settings/validate-openai-key",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("validate OpenAI API key", async (_req: Request, res: Response) => {
      try {
        const settings = await dbSystemAdminStorage.getSettings();
        const dbKey = settings?.openaiApiKey || null;
        const envKey =
          process.env["OPENAI_API_KEY"] || process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] || null;
        const effectiveKey = dbKey || envKey;

        const source = dbKey ? "user_configured" : envKey ? "environment" : null;

        if (!effectiveKey) {
          res.json({
            valid: false,
            status: "not_configured",
            message: "No OpenAI API key configured",
            source: null,
            hasDbKey: false,
            hasEnvKey: false,
          });
          return;
        }

        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: effectiveKey, timeout: 10000 });

        await client.models.list();

        res.json({
          valid: true,
          status: "active",
          message: "API key is valid and working",
          source,
          hasDbKey: !!dbKey,
          hasEnvKey: !!envKey,
        });
      } catch (error: unknown) {
        const settings = await dbSystemAdminStorage.getSettings();
        const dbKey = settings?.openaiApiKey || null;
        const envKey =
          process.env["OPENAI_API_KEY"] || process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] || null;
        const source = dbKey ? "user_configured" : envKey ? "environment" : null;
        const rawMessage = error instanceof Error ? error.message : String(error ?? "");
        const errorMessage = rawMessage.toLowerCase();

        if (
          errorMessage.includes("invalid_api_key") ||
          errorMessage.includes("authentication") ||
          errorMessage.includes("401")
        ) {
          res.json({
            valid: false,
            status: "invalid",
            message: "API key is invalid or expired",
            source,
            hasDbKey: !!dbKey,
            hasEnvKey: !!envKey,
          });
        } else if (errorMessage.includes("rate_limit")) {
          res.json({
            valid: true,
            status: "rate_limited",
            message: "API key is valid but rate limited",
            source,
            hasDbKey: !!dbKey,
            hasEnvKey: !!envKey,
          });
        } else {
          res.json({
            valid: false,
            status: "error",
            message: `Validation failed: ${rawMessage}`,
            source,
            hasDbKey: !!dbKey,
            hasEnvKey: !!envKey,
          });
        }
      }
    })
  );

  app.get(
    "/api/context/events",
    requireOrgId,
    withErrorHandling("fetch context events", async (_req: Request, res: Response) => {
      res.json([]);
    })
  );

  app.post(
    "/api/context/events",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create context event", async (req: Request, res: Response) => {
      sendCreated(res, req.body);
    })
  );

  app.delete(
    "/api/context/events/:id",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("delete context event", async (_req: Request, res: Response) => {
      sendDeleted(res);
    })
  );

  if (process.env["NODE_ENV"] !== "production") {
    app.get(
      "/api/dev/debug",
      requireOrgId,
      withErrorHandling("fetch debug info", async (_req: Request, res: Response) => {
        const debug = {
          environment: process.env["NODE_ENV"],
          timestamp: new Date().toISOString(),
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          uptime: process.uptime(),
        };
        res.json(debug);
      })
    );

    app.post(
      "/api/dev/reset-cache",
      requireOrgId,
      withErrorHandling("reset cache", async (_req: Request, res: Response) => {
        res.json({ message: "Cache reset successfully", timestamp: new Date().toISOString() });
      })
    );

    app.get(
      "/api/dev/config",
      requireOrgId,
      withErrorHandling("fetch config", async (_req: Request, res: Response) => {
        const configData = {
          database: process.env["DATABASE_URL"] ? "postgresql" : "sqlite",
          redis: !!process.env["REDIS_URL"],
          environment: process.env["NODE_ENV"],
        };
        res.json(configData);
      })
    );
  }

  app.get(
    "/api/fleet/summary",
    requireOrgId,
    withErrorHandling("fetch fleet summary", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const vessels = await vesselService.getVessels(orgId);
      const equipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);

      const summary = {
        vesselCount: vessels.length,
        equipmentCount: equipment.length,
        activeVessels: vessels.filter((v) => v.active === true).length,
        timestamp: new Date().toISOString(),
      };

      res.json(summary);
    })
  );

  app.get(
    "/api/fleet/status",
    requireOrgId,
    withErrorHandling("fetch fleet status", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const vessels = await vesselService.getVessels(orgId);

      const status = vessels.map((vessel) => ({
        id: vessel.id,
        name: vessel.name,
        status: vessel.onlineStatus || "unknown",
        lastUpdate: vessel.updatedAt,
      }));

      res.json(status);
    })
  );

  app.get(
    "/api/replay/sessions",
    requireOrgId,
    withErrorHandling("fetch replay sessions", async (_req: Request, res: Response) => {
      res.json([]);
    })
  );

  app.post(
    "/api/replay/sessions",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create replay session", async (req: Request, res: Response) => {
      sendCreated(res, req.body);
    })
  );
}
