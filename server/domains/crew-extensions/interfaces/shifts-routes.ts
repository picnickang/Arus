/**
 * Shift Templates Routes
 * CRUD operations for shift templates
 */

import type { Express, Request, Response } from "express";
import { insertShiftTemplateSchema } from "@shared/schema";
import type { CrewExtensionsRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";

export function registerShiftsRoutes(app: Express, config: CrewExtensionsRoutesConfig) {
  const { storage } = config;

  app.get("/api/shifts",
    withErrorHandling("fetch shift templates", async (req: Request, res: Response) => {
      const { vessel_id } = req.query;
      const shifts = await storage.getShiftTemplates(vessel_id as string | undefined);
      res.json(shifts);
    })
  );

  app.post("/api/shifts",
    withErrorHandling("create shift template", async (req: Request, res: Response) => {
      const shiftData = insertShiftTemplateSchema.parse(req.body);
      const shift = await storage.createShiftTemplate(shiftData);
      res.json(shift);
    })
  );

  app.put("/api/shifts/:id",
    withErrorHandling("update shift template", async (req: Request, res: Response) => {
      const shiftData = insertShiftTemplateSchema.partial().parse(req.body);
      const { orgId, ...updates } = shiftData;
      const shift = await storage.updateShiftTemplate(req.params.id, updates, orgId);
      res.json(shift);
    })
  );

  app.delete("/api/shifts/:id",
    withErrorHandling("delete shift template", async (req: Request, res: Response) => {
      const orgId = req.query.orgId as string | undefined ?? req.body?.orgId;
      await storage.deleteShiftTemplate(req.params.id, orgId);
      res.json({ success: true });
    })
  );
}
