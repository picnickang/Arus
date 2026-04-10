/**
 * Crew Leave Routes
 * CRUD operations for crew leave management
 */

import type { Express, Request, Response } from "express";
import { insertCrewLeaveSchema } from "@shared/schema";
import type { CrewExtensionsRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { dbCrewStorage } from "../../../db/crew/index.js";

export function registerLeaveRoutes(app: Express, config: CrewExtensionsRoutesConfig) {

  app.get("/api/crew/leave",
    withErrorHandling("fetch crew leave", async (req: Request, res: Response) => {
      const { crew_id, start_date, end_date } = req.query;
      const orgId = (req as any).orgId;
      let leaves = await dbCrewStorage.getCrewLeave(
        crew_id as string | undefined,
        orgId
      );
      if (start_date) {
        const startMs = new Date(start_date as string).getTime();
        leaves = leaves.filter((l: any) => new Date(l.startDate).getTime() >= startMs);
      }
      if (end_date) {
        const endMs = new Date(end_date as string).getTime();
        leaves = leaves.filter((l: any) => new Date(l.endDate).getTime() <= endMs);
      }
      res.json(leaves);
    })
  );

  app.post("/api/crew/leave",
    withErrorHandling("create crew leave", async (req: Request, res: Response) => {
      const leaveData = insertCrewLeaveSchema.parse(req.body);
      const leave = await dbCrewStorage.createCrewLeave(leaveData);
      res.json(leave);
    })
  );

  app.put("/api/crew/leave/:id",
    withErrorHandling("update crew leave", async (req: Request, res: Response) => {
      const orgId = (req as any).orgId;
      const leaveData = insertCrewLeaveSchema.partial().parse(req.body);
      const leave = await dbCrewStorage.updateCrewLeave(req.params.id, leaveData, orgId);
      res.json(leave);
    })
  );

  app.delete("/api/crew/leave/:id",
    withErrorHandling("delete crew leave", async (req: Request, res: Response) => {
      const orgId = (req as any).orgId;
      await dbCrewStorage.deleteCrewLeave(req.params.id, orgId);
      res.json({ success: true });
    })
  );
}
