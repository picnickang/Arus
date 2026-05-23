/**
 * Shift Templates Routes
 * CRUD operations for shift templates
 */

import type { Express, Response } from "express";
import { insertShiftTemplateSchema } from "@shared/schema";
import type { CrewExtensionsRoutesConfig, AuthenticatedRequest } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { dbCrewStorage } from "../../../db/crew/index.js";

export function registerShiftsRoutes(app: Express, config: CrewExtensionsRoutesConfig) {
  app.get(
    "/api/shifts",
    withErrorHandling("fetch shift templates", async (req: AuthenticatedRequest, res: Response) => {
      const { vessel_id } = req.query;
      const shifts = await dbCrewStorage.getShiftTemplates(vessel_id as string | undefined);
      const orgId = req.orgId;
      const filtered = orgId
        ? shifts.filter((s) => !(s as { orgId?: string }).orgId || (s as { orgId?: string }).orgId === orgId)
        : shifts;
      res.json(filtered);
    })
  );

  app.post(
    "/api/shifts",
    withErrorHandling("create shift template", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const shiftData = insertShiftTemplateSchema.parse({ ...req.body, orgId });
      const shift = await dbCrewStorage.createShiftTemplate(shiftData);
      res.json(shift);
    })
  );

  app.put(
    "/api/shifts/:id",
    withErrorHandling("update shift template", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const shiftData = insertShiftTemplateSchema.partial().parse(req.body);
      const { orgId: _discard, ...updates } = shiftData;
      const shift = await dbCrewStorage.updateShiftTemplate(req.params.id, updates, orgId);
      res.json(shift);
    })
  );

  app.delete(
    "/api/shifts/:id",
    withErrorHandling("delete shift template", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      await dbCrewStorage.deleteShiftTemplate(req.params.id, orgId);
      res.json({ success: true });
    })
  );
}
