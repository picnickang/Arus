/**
 * STCW Rest Admin Routes
 *
 * Data management and clear operations.
 */

import { Express, Request, Response } from "express";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies } from "./types";

export function registerAdminRoutes(app: Express, deps: StcwRestDependencies): void {
  const { storage } = deps;

  app.delete("/api/work-orders/clear",
    withErrorHandling("clear work orders", async (_req: Request, res: Response) => {
      await storage.clearAllWorkOrders();
      res.json({
        ok: true,
        message: "All work orders cleared successfully",
      });
    })
  );

  app.delete("/api/maintenance/schedules/clear",
    withErrorHandling("clear maintenance schedules", async (_req: Request, res: Response) => {
      await storage.clearAllMaintenanceSchedules();
      res.json({
        ok: true,
        message: "All maintenance schedules cleared successfully",
      });
    })
  );
}
