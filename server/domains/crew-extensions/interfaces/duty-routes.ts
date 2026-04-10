/**
 * Crew Duty Routes
 * Toggle duty status for crew members
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { CrewExtensionsRoutesConfig } from "./types.js";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import { dbCrewStorage } from "../../../db/crew/index.js";

const crewIdSchema = z.object({ id: z.string().uuid("Invalid crew ID format") });

export function registerDutyRoutes(app: Express, config: CrewExtensionsRoutesConfig) {
  const { crewOperationRateLimit } = config;

  app.get("/api/crew/:id/toggle-duty",
    withErrorHandling("toggle duty status", async (req: Request, res: Response) => {
      const { id } = crewIdSchema.parse(req.params);
      const orgId = (req as any).orgId;
      const crew = await dbCrewStorage.getCrewMember(id, orgId);
      if (!crew) {
        return sendNotFound(res, "Crew member");
      }
      const updatedCrew = await dbCrewStorage.updateCrewMember(id, { onDuty: !crew.onDuty }, orgId);
      res.json(updatedCrew);
    })
  );

  app.post("/api/crew/:id/toggle-duty", crewOperationRateLimit,
    withErrorHandling("toggle duty status", async (req: Request, res: Response) => {
      const { id } = crewIdSchema.parse(req.params);
      const orgId = (req as any).orgId;
      const crew = await dbCrewStorage.getCrewMember(id, orgId);
      if (!crew) {
        return sendNotFound(res, "Crew member");
      }
      const newDutyStatus = !crew.onDuty;
      const updatedCrew = await dbCrewStorage.updateCrewMember(id, { onDuty: newDutyStatus }, orgId);
      res.json({
        success: true,
        crew: updatedCrew,
        message: `${crew.name} is now ${newDutyStatus ? "on duty" : "off duty"}`
      });
    })
  );
}
