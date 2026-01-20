/**
 * Crew Leave Routes
 * CRUD operations for crew leave management
 */

import type { Express, Request, Response } from "express";
import { insertCrewLeaveSchema } from "@shared/schema";
import type { CrewExtensionsRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";

export function registerLeaveRoutes(app: Express, config: CrewExtensionsRoutesConfig) {
  const { storage } = config;

  app.get("/api/crew/leave",
    withErrorHandling("fetch crew leave", async (req: Request, res: Response) => {
      const { crew_id, start_date, end_date } = req.query;
      const leaves = await storage.getCrewLeave(
        crew_id as string | undefined,
        start_date ? new Date(start_date as string) : undefined,
        end_date ? new Date(end_date as string) : undefined
      );
      res.json(leaves);
    })
  );

  app.post("/api/crew/leave",
    withErrorHandling("create crew leave", async (req: Request, res: Response) => {
      const leaveData = insertCrewLeaveSchema.parse(req.body);
      const leave = await storage.createCrewLeave(leaveData);
      res.json(leave);
    })
  );

  app.put("/api/crew/leave/:id",
    withErrorHandling("update crew leave", async (req: Request, res: Response) => {
      const leaveData = insertCrewLeaveSchema.partial().parse(req.body);
      const leave = await storage.updateCrewLeave(req.params.id, leaveData);
      res.json(leave);
    })
  );

  app.delete("/api/crew/leave/:id",
    withErrorHandling("delete crew leave", async (req: Request, res: Response) => {
      await storage.deleteCrewLeave(req.params.id);
      res.json({ success: true });
    })
  );
}
