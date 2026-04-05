import type { Express, Request, Response } from "express";
import { z } from "zod";
import { schematicLayoutService } from "../service";
import { withErrorHandling } from "../../../lib/route-utils";

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

export function registerSchematicLayoutRoutes(
  app: Express,
  rateLimit: {
    generalApiRateLimit: any;
    writeOperationRateLimit?: any;
  }
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimit;
  const writeLimit = writeOperationRateLimit || generalApiRateLimit;

  app.get("/api/vessels/:id/schematic-layout", generalApiRateLimit,
    withErrorHandling("fetch schematic layout", async (req: Request, res: Response) => {
      const layout = await schematicLayoutService.getVesselLayout(req.params.id);
      res.json(layout);
    })
  );

  app.put("/api/vessels/:id/schematic-layout", writeLimit,
    withErrorHandling("save schematic layout", async (req: Request, res: Response) => {
      const parsed = saveLayoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid layout", details: parsed.error.flatten() });
      }
      const layout = await schematicLayoutService.saveVesselLayout(req.params.id, parsed.data);
      res.json(layout);
    })
  );

  app.post("/api/vessels/:id/schematic-layout/zones", writeLimit,
    withErrorHandling("add schematic zone", async (req: Request, res: Response) => {
      const parsed = createZoneSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid zone data", details: parsed.error.flatten() });
      }
      const layout = await schematicLayoutService.addZone(req.params.id, parsed.data);
      res.status(201).json(layout);
    })
  );

  app.put("/api/vessels/:id/schematic-layout/zones/:zoneId", writeLimit,
    withErrorHandling("update schematic zone", async (req: Request, res: Response) => {
      const parsed = updateZoneSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid zone data", details: parsed.error.flatten() });
      }
      try {
        const layout = await schematicLayoutService.updateZone(req.params.id, req.params.zoneId, parsed.data);
        res.json(layout);
      } catch (e: any) {
        if (e.message?.includes("not found")) return res.status(404).json({ error: e.message });
        throw e;
      }
    })
  );

  app.delete("/api/vessels/:id/schematic-layout/zones/:zoneId", writeLimit,
    withErrorHandling("remove schematic zone", async (req: Request, res: Response) => {
      try {
        const layout = await schematicLayoutService.removeZone(req.params.id, req.params.zoneId);
        res.json(layout);
      } catch (e: any) {
        if (e.message?.includes("not found")) return res.status(404).json({ error: e.message });
        throw e;
      }
    })
  );

  app.post("/api/vessels/:id/schematic-layout/slots", writeLimit,
    withErrorHandling("add schematic slot", async (req: Request, res: Response) => {
      const parsed = createSlotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid slot data", details: parsed.error.flatten() });
      }
      try {
        const layout = await schematicLayoutService.addSlot(req.params.id, parsed.data);
        res.status(201).json(layout);
      } catch (e: any) {
        if (e.message?.includes("not found")) return res.status(404).json({ error: e.message });
        throw e;
      }
    })
  );

  app.put("/api/vessels/:id/schematic-layout/slots/:slotId", writeLimit,
    withErrorHandling("update schematic slot", async (req: Request, res: Response) => {
      const parsed = updateSlotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid slot data", details: parsed.error.flatten() });
      }
      try {
        const layout = await schematicLayoutService.updateSlot(req.params.id, req.params.slotId, parsed.data);
        res.json(layout);
      } catch (e: any) {
        if (e.message?.includes("not found")) return res.status(404).json({ error: e.message });
        throw e;
      }
    })
  );

  app.delete("/api/vessels/:id/schematic-layout/slots/:slotId", writeLimit,
    withErrorHandling("remove schematic slot", async (req: Request, res: Response) => {
      try {
        const layout = await schematicLayoutService.removeSlot(req.params.id, req.params.slotId);
        res.json(layout);
      } catch (e: any) {
        if (e.message?.includes("not found")) return res.status(404).json({ error: e.message });
        throw e;
      }
    })
  );

  app.put("/api/vessels/:id/schematic-layout/slots/:slotId/move", writeLimit,
    withErrorHandling("move schematic slot", async (req: Request, res: Response) => {
      const parsed = moveSlotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid move data", details: parsed.error.flatten() });
      }
      try {
        const layout = await schematicLayoutService.moveSlot(req.params.id, req.params.slotId, parsed.data);
        res.json(layout);
      } catch (e: any) {
        if (e.message?.includes("not found")) return res.status(404).json({ error: e.message });
        throw e;
      }
    })
  );

  app.post("/api/vessels/:id/schematic-layout/reset", writeLimit,
    withErrorHandling("reset schematic layout", async (req: Request, res: Response) => {
      const layout = await schematicLayoutService.resetToDefault(req.params.id);
      res.json(layout);
    })
  );
}
