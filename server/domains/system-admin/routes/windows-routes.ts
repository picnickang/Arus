/**
 * System Admin Routes - Maintenance Windows
 * Scheduled maintenance window management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";

export function registerWindowsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertMaintenanceWindowSchema,
  } = deps;

  app.get(
    "/api/admin/maintenance-windows",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_MAINTENANCE_WINDOWS"),
    withErrorHandling("fetch maintenance windows", async (req: Request, res: Response) => {
      const { orgId, status } = req.query;
      const windows = await storage.getMaintenanceWindows(orgId as string, status as string);
      res.json(windows);
    })
  );

  app.get(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_MAINTENANCE_WINDOW"),
    withErrorHandling("fetch maintenance window", async (req: Request, res: Response) => {
      const { id } = req.params;
      const { orgId } = req.query;
      const window = await storage.getMaintenanceWindow(id, orgId as string);
      if (!window) {
        return sendNotFound(res, "Maintenance window");
      }
      res.json(window);
    })
  );

  app.post(
    "/api/admin/maintenance-windows",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_MAINTENANCE_WINDOW"),
    withErrorHandling("create maintenance window", async (req: Request, res: Response) => {
      const validatedData = insertMaintenanceWindowSchema.parse(req.body);
      const window = await storage.createMaintenanceWindow(validatedData);
      sendCreated(res, window);
    })
  );

  app.put(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_MAINTENANCE_WINDOW"),
    withErrorHandling("update maintenance window", async (req: Request, res: Response) => {
      const { id } = req.params;
      const validatedData = insertMaintenanceWindowSchema.partial().parse(req.body);
      const window = await storage.updateMaintenanceWindow(id, validatedData);
      res.json(window);
    })
  );

  app.delete(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_MAINTENANCE_WINDOW"),
    withErrorHandling("delete maintenance window", async (req: Request, res: Response) => {
      const { id } = req.params;
      await storage.deleteMaintenanceWindow(id);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/admin/maintenance-windows/active",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_ACTIVE_MAINTENANCE_WINDOWS"),
    withErrorHandling("fetch active maintenance windows", async (req: Request, res: Response) => {
      const { orgId } = req.query;
      const windows = await storage.getActiveMaintenanceWindows(orgId as string);
      res.json(windows);
    })
  );
}
