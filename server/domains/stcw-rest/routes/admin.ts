/**
 * STCW Rest Admin Routes
 *
 * Data management and clear operations.
 */

import { Express, Request, Response } from "express";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies } from "./types";
import { dbWorkOrderStorage } from "../../../db/workorders/index.js";
import { dbMaintenanceStorage } from "../../../db/maintenance/index.js";

export function registerAdminRoutes(app: Express, deps: StcwRestDependencies): void {
  app.delete("/api/work-orders/clear",
    withErrorHandling("clear work orders", async (_req: Request, res: Response) => {
      await dbWorkOrderStorage.clearAllWorkOrders();
      res.json({
        ok: true,
        message: "All work orders cleared successfully",
      });
    })
  );

  app.delete("/api/maintenance/schedules/clear",
    withErrorHandling("clear maintenance schedules", async (_req: Request, res: Response) => {
      await dbMaintenanceStorage.clearAllMaintenanceSchedules();
      res.json({
        ok: true,
        message: "All maintenance schedules cleared successfully",
      });
    })
  );
}
