import type { Express, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { requireOrgId } from "../../../middleware/auth";
import { schematicLayoutService } from "../service";
import { withErrorHandling } from "../../../lib/route-utils";
import { dbEquipmentStorage } from "../../../db/equipment";

const createZoneSchema = z.object({
  label: z.string().min(1).max(100),
  order: z.number().int().min(0).optional(),
});

const updateZoneSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
});

const createSlotSchema = z.object({
  label: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  typeMatch: z.array(z.string().min(1)).min(1),
  zoneId: z.string().min(1),
});

const updateSlotSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  typeMatch: z.array(z.string().min(1)).optional(),
});

const moveSlotSchema = z.object({
  targetZoneId: z.string().min(1),
});

const removeSlotBodySchema = z.object({
  force: z.boolean().optional(),
});

const saveLayoutSchema = z.object({
  zones: z.array(z.object({
    zoneId: z.string().min(1),
    label: z.string().min(1),
    order: z.number().int().min(0),
    slotIds: z.array(z.string()),
  })),
  slots: z.array(z.object({
    slotId: z.string().min(1),
    label: z.string().min(1),
    category: z.string().min(1),
    typeMatch: z.array(z.string()),
  })),
});

function domainError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export function registerSchematicLayoutRoutes(
  app: Express,
  rateLimit: {
    generalApiRateLimit: RateLimitRequestHandler;
    writeOperationRateLimit?: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimit;
  const writeLimit = writeOperationRateLimit || generalApiRateLimit;

  app.get("/api/vessels/:id/schematic-layout", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch schematic layout", async (req: AuthenticatedRequest, res: Response) => {
      const layout = await schematicLayoutService.getVesselLayout(req.params.id, req.orgId);
      res.json(layout);
    })
  );

  app.put("/api/vessels/:id/schematic-layout", requireOrgId, writeLimit,
    withErrorHandling("save schematic layout", async (req: AuthenticatedRequest, res: Response) => {
      const parsed = saveLayoutSchema.safeParse(req.body);
      if (!parsed.success) {
        throw domainError(`Invalid layout: ${  parsed.error.flatten().fieldErrors}`, 400);
      }
      const layout = await schematicLayoutService.saveVesselLayout(req.params.id, req.orgId, parsed.data);
      res.json(layout);
    })
  );

  app.post("/api/vessels/:id/schematic-layout/zones", requireOrgId, writeLimit,
    withErrorHandling("add schematic zone", async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createZoneSchema.safeParse(req.body);
      if (!parsed.success) {
        throw domainError(`Invalid zone data: ${  parsed.error.flatten().fieldErrors}`, 400);
      }
      const layout = await schematicLayoutService.addZone(req.params.id, req.orgId, parsed.data);
      res.status(201).json(layout);
    })
  );

  app.put("/api/vessels/:id/schematic-layout/zones/:zoneId", requireOrgId, writeLimit,
    withErrorHandling("update schematic zone", async (req: AuthenticatedRequest, res: Response) => {
      const parsed = updateZoneSchema.safeParse(req.body);
      if (!parsed.success) {
        throw domainError(`Invalid zone data: ${  parsed.error.flatten().fieldErrors}`, 400);
      }
      const layout = await schematicLayoutService.updateZone(req.params.id, req.orgId, req.params.zoneId, parsed.data);
      res.json(layout);
    })
  );

  app.delete("/api/vessels/:id/schematic-layout/zones/:zoneId", requireOrgId, writeLimit,
    withErrorHandling("remove schematic zone", async (req: AuthenticatedRequest, res: Response) => {
      const layout = await schematicLayoutService.removeZone(req.params.id, req.orgId, req.params.zoneId);
      res.json(layout);
    })
  );

  app.post("/api/vessels/:id/schematic-layout/slots", requireOrgId, writeLimit,
    withErrorHandling("add schematic slot", async (req: AuthenticatedRequest, res: Response) => {
      const parsed = createSlotSchema.safeParse(req.body);
      if (!parsed.success) {
        throw domainError(`Invalid slot data: ${  parsed.error.flatten().fieldErrors}`, 400);
      }
      const layout = await schematicLayoutService.addSlot(req.params.id, req.orgId, parsed.data);
      res.status(201).json(layout);
    })
  );

  app.put("/api/vessels/:id/schematic-layout/slots/:slotId", requireOrgId, writeLimit,
    withErrorHandling("update schematic slot", async (req: AuthenticatedRequest, res: Response) => {
      const parsed = updateSlotSchema.safeParse(req.body);
      if (!parsed.success) {
        throw domainError(`Invalid slot data: ${  parsed.error.flatten().fieldErrors}`, 400);
      }
      const layout = await schematicLayoutService.updateSlot(req.params.id, req.orgId, req.params.slotId, parsed.data);
      res.json(layout);
    })
  );

  app.delete("/api/vessels/:id/schematic-layout/slots/:slotId", requireOrgId, writeLimit,
    withErrorHandling("remove schematic slot", async (req: AuthenticatedRequest, res: Response) => {
      const parsed = removeSlotBodySchema.safeParse(req.body);
      const force = parsed.success ? parsed.data.force === true : false;

      const currentLayout = await schematicLayoutService.getVesselLayout(req.params.id, req.orgId);
      const slot = currentLayout.slots.find(s => s.slotId === req.params.slotId);
      let hasEquipment = false;
      if (slot) {
        const vesselEquipment = await dbEquipmentStorage.getEquipmentByVessel(req.params.id, req.orgId);
        hasEquipment = vesselEquipment.some(eq => {
          const typeLower = (eq.type || "").toLowerCase();
          const nameLower = (eq.name || "").toLowerCase();
          return slot.typeMatch.some(t => typeLower.includes(t) || nameLower.includes(t));
        });
      }

      const layout = await schematicLayoutService.removeSlot(
        req.params.id, req.orgId, req.params.slotId, { force, hasEquipment }
      );
      res.json(layout);
    })
  );

  app.put("/api/vessels/:id/schematic-layout/slots/:slotId/move", requireOrgId, writeLimit,
    withErrorHandling("move schematic slot", async (req: AuthenticatedRequest, res: Response) => {
      const parsed = moveSlotSchema.safeParse(req.body);
      if (!parsed.success) {
        throw domainError(`Invalid move data: ${  parsed.error.flatten().fieldErrors}`, 400);
      }
      const layout = await schematicLayoutService.moveSlot(req.params.id, req.orgId, req.params.slotId, parsed.data);
      res.json(layout);
    })
  );

  app.post("/api/vessels/:id/schematic-layout/reset", requireOrgId, writeLimit,
    withErrorHandling("reset schematic layout", async (req: AuthenticatedRequest, res: Response) => {
      const layout = await schematicLayoutService.resetToDefault(req.params.id, req.orgId);
      res.json(layout);
    })
  );
}
