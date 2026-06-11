/**
 * System Admin Routes - Maintenance Windows
 * Scheduled maintenance window management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils.js";
import { dbSystemAdminStorage } from "../../../db/system-admin/index.js";

export function registerWindowsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
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
      const windows = await dbSystemAdminStorage.getMaintenanceWindows(
        orgId as string,
        status as string
      );
      res.json(windows);
    })
  );

  app.get(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_MAINTENANCE_WINDOW"),
    withErrorHandling("fetch maintenance window", async (req: Request, res: Response) => {
      const { id = "" } = req.params;
      const { orgId } = req.query;
      const window = await dbSystemAdminStorage.getMaintenanceWindow(id, orgId as string);
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
      const window = await dbSystemAdminStorage.createMaintenanceWindow(validatedData);
      sendCreated(res, window);
    })
  );

  app.put(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_MAINTENANCE_WINDOW"),
    withErrorHandling("update maintenance window", async (req: Request, res: Response) => {
      const { id = "" } = req.params;
      const validatedData = (insertMaintenanceWindowSchema as object as import("zod").AnyZodObject)
        .partial()
        .parse(req.body);
      const window = await dbSystemAdminStorage.updateMaintenanceWindow(id, validatedData);
      res.json(window);
    })
  );

  app.delete(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_MAINTENANCE_WINDOW"),
    withErrorHandling("delete maintenance window", async (req: Request, res: Response) => {
      const { id = "" } = req.params;
      await dbSystemAdminStorage.deleteMaintenanceWindow(id);
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
      const windows = await dbSystemAdminStorage.getActiveMaintenanceWindows(orgId as string);
      res.json(windows);
    })
  );
}
