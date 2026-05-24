/**
 * Deck Log Daily Routes
 *
 * Core CRUD operations for daily deck logs.
 */

import type { Express } from "express";
import { z } from "zod";
import { deckLogStorage } from "../../../repositories";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils";
import type { RateLimiters, DeckLogFilters } from "./types";

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

type CreateDeckLogInput = Parameters<typeof deckLogStorage.createDeckLogDaily>[0];
type UpdateDeckLogInput = Parameters<typeof deckLogStorage.updateDeckLogDaily>[1];

export function registerDeckLogDailyRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit, criticalOperationRateLimit } = rateLimit;

  app.get(
    "/api/logbook/deck/daily",
    withErrorHandling("get deck log daily entries", async (req, res) => {
      const orgId = req.orgId;
      const filters: DeckLogFilters = listQuerySchema.parse(req.query);

      const entries = await deckLogStorage.getDeckLogDaily(orgId, filters);
      return res.json(entries);
    })
  );

  app.get(
    "/api/logbook/deck/daily/:id",
    withErrorHandling("get deck log daily entry", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const entry = await deckLogStorage.getDeckLogDailyById(id, orgId);

      if (!entry) {
        return sendNotFound(res, "Deck log entry");
      }

      return res.json(entry);
    })
  );

  app.get(
    "/api/logbook/deck/daily/:id/complete",
    withErrorHandling("get complete deck log", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const complete = await deckLogStorage.getDeckLogComplete(id, orgId);

      if (!complete) {
        return sendNotFound(res, "Deck log entry");
      }

      return res.json(complete);
    })
  );

  app.get(
    "/api/logbook/deck/vessel/:vesselId/date/:logDate",
    withErrorHandling("get deck log by date", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, logDate } = vesselDateParamSchema.parse(req.params);

      let entry = await deckLogStorage.getDeckLogDailyByDate(vesselId, logDate, orgId);

      if (!entry) {
        entry = await deckLogStorage.createDeckLogDaily({
          orgId,
          vesselId,
          logDate,
          status: "draft",
        } as CreateDeckLogInput);
      }

      const complete = await deckLogStorage.getDeckLogComplete(entry.id, orgId);
      return res.json(complete);
    })
  );

  app.post(
    "/api/logbook/deck/daily",
    writeOperationRateLimit,
    withErrorHandling("create deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const body = createBodySchema.parse(req.body) as {
        vesselId: string;
        logDate: string;
      } & Record<string, unknown>;

      const existing = await deckLogStorage.getDeckLogDailyByDate(body.vesselId, body.logDate, orgId);

      if (existing) {
        return res.status(409).json({
          error: "Deck log already exists for this vessel and date",
          existingId: existing.id,
        });
      }

      const entry = await deckLogStorage.createDeckLogDaily({
        ...body,
        orgId,
      } as CreateDeckLogInput);

      sendCreated(res, entry);
      return undefined;
    })
  );

  app.patch(
    "/api/logbook/deck/daily/:id",
    writeOperationRateLimit,
    withErrorHandling("update deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const body = updateBodySchema.parse(req.body);
      const entry = await deckLogStorage.updateDeckLogDaily(id, body as UpdateDeckLogInput, orgId);
      return res.json(entry);
    })
  );

  app.post(
    "/api/logbook/deck/daily/:id/sign",
    writeOperationRateLimit,
    withErrorHandling("sign deck log", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const parsed = signBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Signature details required" });
      }

      const entry = await deckLogStorage.signDeckLogDaily(id, parsed.data, orgId);

      return res.json(entry);
    })
  );

  app.delete(
    "/api/logbook/deck/daily/:id",
    criticalOperationRateLimit,
    withErrorHandling("delete deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      await deckLogStorage.deleteDeckLogDaily(id, orgId);
      sendDeleted(res);
    })
  );

  app.post(
    "/api/logbook/deck/daily/:id/lock",
    writeOperationRateLimit,
    withErrorHandling("lock deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const parsed = lockBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "lockedByUserId and lockedByUserName required" });
      }

      const locked = await deckLogStorage.lockDeckLogDaily(id, parsed.data, orgId);
      return res.json(locked);
    })
  );

  app.post(
    "/api/logbook/deck/daily/:id/unlock",
    writeOperationRateLimit,
    withErrorHandling("unlock deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const unlocked = await deckLogStorage.unlockDeckLogDaily(id, orgId);
      return res.json(unlocked);
    })
  );

  app.get(
    "/api/logbook/deck/days",
    withErrorHandling("get deck log days", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, from, to } = daysQuerySchema.parse(req.query);

      const entries = await deckLogStorage.getDeckLogDaily(orgId, {
        vesselId,
        startDate: from,
        endDate: to,
      });
      return res.json(entries);
    })
  );

  app.post(
    "/api/logbook/deck/days/ensure",
    writeOperationRateLimit,
    withErrorHandling("ensure deck log day", async (req, res) => {
      const orgId = req.orgId;
      const parsed = ensureBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "vesselId and date required" });
      }
      const { vesselId, date } = parsed.data;

      let entry = await deckLogStorage.getDeckLogDailyByDate(vesselId, date, orgId);

      if (!entry) {
        entry = await deckLogStorage.createDeckLogDaily({
          orgId,
          vesselId,
          logDate: date,
          status: "open",
        } as CreateDeckLogInput);
      }

      return res.json(entry);
    })
  );

  return 12;
}
