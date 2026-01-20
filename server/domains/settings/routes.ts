import { Express, Request, Response, RequestHandler } from "express";
import { insertSettingsSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendDeleted, sendCreated } from "../../lib/route-utils";
import { getOpenAIApiKey, type SettingsAccessor } from "../../openai/client";

interface SettingsConfig {
  storage: any;
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

export function registerSettingsRoutes(app: Express, config: SettingsConfig) {
  const { storage, requireOrgId, writeOperationRateLimit } = config;

  // System settings
  app.get("/api/settings", requireOrgId,
    withErrorHandling("fetch settings", async (_req: Request, res: Response) => {
      const settings = await storage.getSettings();
      res.json(settings);
    })
  );

  app.put("/api/settings", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update settings", async (req: Request, res: Response) => {
      const settingsData = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateSettings(settingsData);
      res.json(settings);
    })
  );

  app.get("/api/settings/validate-openai-key", requireOrgId, writeOperationRateLimit,
    withErrorHandling("validate OpenAI API key", async (_req: Request, res: Response) => {
      try {
        // Use injected storage instance to avoid circular dependency and respect tenant isolation
        const settingsAccessor: SettingsAccessor = async () => storage.getSettings();
        const apiKey = await getOpenAIApiKey(settingsAccessor);
        
        if (!apiKey) {
          res.json({
            valid: false,
            status: 'not_configured',
            message: 'No OpenAI API key configured',
            source: null,
          });
          return;
        }

        const keySource = apiKey.startsWith('sk-') ? 'user_configured' : 'ai_integrations';

        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey, timeout: 10000 });
        
        await client.models.list();
        
        res.json({
          valid: true,
          status: 'active',
          message: 'API key is valid and working',
          source: keySource,
        });
      } catch (error: any) {
        const errorMessage = error?.message?.toLowerCase() || '';
        
        if (errorMessage.includes('invalid_api_key') || errorMessage.includes('authentication')) {
          res.json({
            valid: false,
            status: 'invalid',
            message: 'API key is invalid or expired',
            source: 'unknown',
          });
        } else if (errorMessage.includes('rate_limit')) {
          res.json({
            valid: true,
            status: 'rate_limited',
            message: 'API key is valid but rate limited',
            source: 'unknown',
          });
        } else {
          res.json({
            valid: false,
            status: 'error',
            message: `Validation failed: ${error.message}`,
            source: 'unknown',
          });
        }
      }
    })
  );

  // Context events (for AI/ML context)
  app.get("/api/context/events", requireOrgId,
    withErrorHandling("fetch context events", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const { equipmentId, eventType, limit } = req.query;
      const events = await storage.getContextEvents?.({
        orgId,
        equipmentId: equipmentId as string,
        eventType: eventType as string,
        limit: limit ? Number.parseInt(limit as string) : 100,
      });
      res.json(events ?? []);
    })
  );

  app.post("/api/context/events", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create context event", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const event = await storage.createContextEvent?.({ ...req.body, orgId });
      sendCreated(res, event || req.body);
    })
  );

  app.delete("/api/context/events/:id", requireOrgId, writeOperationRateLimit,
    withErrorHandling("delete context event", async (req: Request, res: Response) => {
      await storage.deleteContextEvent?.(req.params.id);
      sendDeleted(res);
    })
  );

  // Development utilities (only in non-production)
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/dev/debug", requireOrgId,
      withErrorHandling("fetch debug info", async (_req: Request, res: Response) => {
        const debug = {
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          uptime: process.uptime(),
        };
        res.json(debug);
      })
    );

    app.post("/api/dev/reset-cache", requireOrgId,
      withErrorHandling("reset cache", async (_req: Request, res: Response) => {
        res.json({ message: "Cache reset successfully", timestamp: new Date().toISOString() });
      })
    );

    app.get("/api/dev/config", requireOrgId,
      withErrorHandling("fetch config", async (_req: Request, res: Response) => {
        const configData = {
          database: process.env.DATABASE_URL ? "postgresql" : "sqlite",
          redis: !!process.env.REDIS_URL,
          environment: process.env.NODE_ENV,
        };
        res.json(configData);
      })
    );
  }

  // Fleet management
  app.get("/api/fleet/summary", requireOrgId,
    withErrorHandling("fetch fleet summary", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vessels = await storage.getVessels(orgId);
      const equipment = await storage.getEquipmentRegistry(orgId);

      const summary = {
        vesselCount: vessels.length,
        equipmentCount: equipment.length,
        activeVessels: vessels.filter((v: any) => v.status === "active").length,
        timestamp: new Date().toISOString(),
      };

      res.json(summary);
    })
  );

  app.get("/api/fleet/status", requireOrgId,
    withErrorHandling("fetch fleet status", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vessels = await storage.getVessels(orgId);

      const status = vessels.map((vessel: any) => ({
        id: vessel.id,
        name: vessel.name,
        status: vessel.status || "unknown",
        lastUpdate: vessel.updatedAt,
      }));

      res.json(status);
    })
  );

  // Telemetry replay (for debugging/analysis)
  app.get("/api/replay/sessions", requireOrgId,
    withErrorHandling("fetch replay sessions", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const sessions = await storage.getReplaySessions?.(orgId);
      res.json(sessions ?? []);
    })
  );

  app.post("/api/replay/sessions", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create replay session", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const session = await storage.createReplaySession?.({ ...req.body, orgId });
      sendCreated(res, session || req.body);
    })
  );
}
