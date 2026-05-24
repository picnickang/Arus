/**
 * Engine Log Daily Routes
 *
 * Core CRUD operations for daily engine logs.
 */

import type { Express } from "express";
import { z } from "zod";
import { engineLogStorage } from "../../../repositories";
import type { RateLimiters, EngineLogFilters } from "./types";
import { validateUUID } from "../../../utils/validation";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils";

const idParamSchema = z.object({ id: z.string().min(1) });
const vesselDateParamSchema = z.object({
  vesselId: z.string().min(1),
  logDate: z.string().min(1),
});
const listQuerySchema = z.object({
  vesselId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
});
const daysQuerySchema = z.object({
  vesselId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
const createBodySchema = z
  .object({
    vesselId: z.string().min(1),
    logDate: z.string().min(1),
  })
  .and(z.record(z.unknown()));
const updateBodySchema = z.record(z.unknown());
const signBodySchema = z.object({
  signedByCrewId: z.string().min(1),
  signedByName: z.string().min(1),
  signedByRank: z.string().min(1),
});
const lockBodySchema = z.object({
  lockedByUserId: z.string().min(1),
  lockedByUserName: z.string().min(1),
});
const ensureBodySchema = z.object({
  vesselId: z.string().min(1),
  date: z.string().min(1),
});

type CreateEngineLogInput = Parameters<typeof engineLogStorage.createEngineLogDaily>[0];
type UpdateEngineLogInput = Parameters<typeof engineLogStorage.updateEngineLogDaily>[1];

export function registerEngineLogDailyRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit, criticalOperationRateLimit } = rateLimit;

  app.get(
    "/api/logbook/engine/daily",
    withErrorHandling("get engine log daily entries", async (req, res) => {
      const orgId = req.orgId;
      const filters: EngineLogFilters = listQuerySchema.parse(req.query);

      const entries = await engineLogStorage.getEngineLogDaily(orgId, filters);
      return res.json(entries);
    })
  );

  app.get(
    "/api/logbook/engine/daily/:id",
    withErrorHandling("get engine log daily entry", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      if (!validateUUID(id, res)) {
        return;
      }

      const entry = await engineLogStorage.getEngineLogDailyById(id, orgId);
      if (!entry) {
        return sendNotFound(res, "Engine log entry");
      }

      return res.json(entry);
    })
  );

  app.get(
    "/api/logbook/engine/daily/:id/complete",
    withErrorHandling("get complete engine log", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      if (!validateUUID(id, res)) {
        return;
      }

      const complete = await engineLogStorage.getEngineLogComplete(id, orgId);
      if (!complete) {
        return sendNotFound(res, "Engine log entry");
      }

      return res.json(complete);
    })
  );

  app.get(
    "/api/logbook/engine/vessel/:vesselId/date/:logDate",
    withErrorHandling("get engine log by date", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, logDate } = vesselDateParamSchema.parse(req.params);

      let entry = await engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId);

      if (!entry) {
        entry = await engineLogStorage.createEngineLogDaily({
          orgId,
          vesselId,
          logDate,
          status: "open",
        } as CreateEngineLogInput);
      }

      const complete = await engineLogStorage.getEngineLogComplete(entry.id, orgId);
      return res.json(complete);
    })
  );

  app.post(
    "/api/logbook/engine/daily",
    writeOperationRateLimit,
    withErrorHandling("create engine log daily", async (req, res) => {
      const orgId = req.orgId;
      const body = createBodySchema.parse(req.body) as {
        vesselId: string;
        logDate: string;
      } & Record<string, unknown>;

      const existing = await engineLogStorage.getEngineLogDailyByDate(
        body.vesselId,
        body.logDate,
        orgId
      );

      if (existing) {
        return res.status(409).json({
          error: "Engine log already exists for this vessel and date",
          existingId: existing.id,
        });
      }

      const entry = await engineLogStorage.createEngineLogDaily({
        ...body,
        orgId,
      } as CreateEngineLogInput);

      sendCreated(res, entry);
      return undefined;
    })
  );

  app.patch(
    "/api/logbook/engine/daily/:id",
    writeOperationRateLimit,
    withErrorHandling("update engine log daily", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      if (!validateUUID(id, res)) {
        return;
      }
      const body = updateBodySchema.parse(req.body);

      const entry = await engineLogStorage.updateEngineLogDaily(
        id,
        body as UpdateEngineLogInput,
        orgId
      );
      return res.json(entry);
    })
  );

  app.post(
    "/api/logbook/engine/daily/:id/sign",
    writeOperationRateLimit,
    withErrorHandling("sign engine log", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      if (!validateUUID(id, res)) {
        return;
      }

      const parsed = signBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Signature details required" });
      }

      const entry = await engineLogStorage.signEngineLogDaily(id, parsed.data, orgId);
      return res.json(entry);
    })
  );

  app.delete(
    "/api/logbook/engine/daily/:id",
    criticalOperationRateLimit,
    withErrorHandling("delete engine log daily", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      await engineLogStorage.deleteEngineLogDaily(id, orgId);
      sendDeleted(res);
    })
  );

  app.post(
    "/api/logbook/engine/daily/:id/lock",
    writeOperationRateLimit,
    withErrorHandling("lock engine log", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      if (!validateUUID(id, res)) {
        return;
      }

      const parsed = lockBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "lockedByUserId and lockedByUserName required" });
      }

      try {
        const locked = await engineLogStorage.lockEngineLogDaily(id, parsed.data, orgId);
        return res.json(locked);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("already locked")) {
          return res.status(409).json({ error: message });
        }
        throw error;
      }
    })
  );

  app.post(
    "/api/logbook/engine/daily/:id/unlock",
    writeOperationRateLimit,
    withErrorHandling("unlock engine log", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const unlocked = await engineLogStorage.unlockEngineLogDaily(id, orgId);
      return res.json(unlocked);
    })
  );

  app.get(
    "/api/logbook/engine/days",
    withErrorHandling("get engine log days", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, from, to } = daysQuerySchema.parse(req.query);

      const entries = await engineLogStorage.getEngineLogDaily(orgId, {
        vesselId,
        startDate: from,
        endDate: to,
      });
      return res.json(entries);
    })
  );

  app.post(
    "/api/logbook/engine/days/ensure",
    writeOperationRateLimit,
    withErrorHandling("ensure engine log day", async (req, res) => {
      const orgId = req.orgId;
      const parsed = ensureBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "vesselId and date required" });
      }
      const { vesselId, date } = parsed.data;

      let entry = await engineLogStorage.getEngineLogDailyByDate(vesselId, date, orgId);

      if (!entry) {
        entry = await engineLogStorage.createEngineLogDaily({
          orgId,
          vesselId,
          logDate: date,
          status: "open",
        } as CreateEngineLogInput);
      }

      return res.json(entry);
    })
  );

  return 13;
}
