/**
 * System Admin Routes - Integration Configs
 * External integration configuration management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";

export function registerIntegrationsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertIntegrationConfigSchema,
  } = deps;

  app.get(
    "/api/admin/integrations",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_INTEGRATION_CONFIGS"),
    withErrorHandling("fetch integration configs", async (req: Request, res: Response) => {
      const { orgId, type } = req.query;
      const integrations = await storage.getIntegrationConfigs(orgId as string, type as string);
      res.json(integrations);
    })
  );

  app.get(
    "/api/admin/integrations/:id",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_INTEGRATION_CONFIG"),
    withErrorHandling("fetch integration config", async (req: Request, res: Response) => {
      const { id } = req.params;
      const { orgId } = req.query;
      const integration = await storage.getIntegrationConfig(id, orgId as string);
      if (!integration) {
        return sendNotFound(res, "Integration config");
      }
      res.json(integration);
    })
  );

  app.post(
    "/api/admin/integrations",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_INTEGRATION_CONFIG"),
    withErrorHandling("create integration config", async (req: Request, res: Response) => {
      const validatedData = insertIntegrationConfigSchema.parse(req.body);
      const integration = await storage.createIntegrationConfig(validatedData);
      sendCreated(res, integration);
    })
  );

  app.put(
    "/api/admin/integrations/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_INTEGRATION_CONFIG"),
    withErrorHandling("update integration config", async (req: Request, res: Response) => {
      const { id } = req.params;
      const validatedData = insertIntegrationConfigSchema.partial().parse(req.body);
      const integration = await storage.updateIntegrationConfig(id, validatedData);
      res.json(integration);
    })
  );

  app.delete(
    "/api/admin/integrations/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_INTEGRATION_CONFIG"),
    withErrorHandling("delete integration config", async (req: Request, res: Response) => {
      const { id } = req.params;
      await storage.deleteIntegrationConfig(id);
      sendDeleted(res);
    })
  );

  app.patch(
    "/api/admin/integrations/:id/health",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_INTEGRATION_HEALTH"),
    withErrorHandling("update integration health", async (req: Request, res: Response) => {
      const { id } = req.params;
      const { healthStatus, errorMessage } = req.body;
      const integration = await storage.updateIntegrationHealth(id, healthStatus, errorMessage);
      res.json(integration);
    })
  );
}
