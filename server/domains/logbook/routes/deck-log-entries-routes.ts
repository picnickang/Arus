/**
 * Deck Log Entries Routes
 *
 * Hourly entries, watches, and events for deck logs.
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
import type { RateLimiters, EventFilters } from "./types";

const idParamSchema = z.object({ id: z.string().min(1) });
const dailyLogIdParamSchema = z.object({ dailyLogId: z.string().min(1) });
const dayIdParamSchema = z.object({ dayId: z.string().min(1) });
const bodyRecordSchema = z.record(z.unknown());
const bulkEntriesBodySchema = z.object({ entries: z.array(z.record(z.unknown())) });
const eventsQuerySchema = z.object({
  eventType: z.string().optional(),
  source: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});
const eventCreateBodySchema = z
  .object({ dayId: z.string().min(1) })
  .and(z.record(z.unknown()));

type DeckLogHourlyInput = Parameters<typeof deckLogStorage.upsertDeckLogHourly>[0];
type DeckLogHourlyBulkInput = Parameters<typeof deckLogStorage.bulkUpsertDeckLogHourly>[0];
type DeckLogWatchInput = Parameters<typeof deckLogStorage.upsertDeckLogWatch>[0];
type DeckLogEventInput = Parameters<typeof deckLogStorage.createDeckLogEvent>[0];
type DeckLogEventUpdate = Parameters<typeof deckLogStorage.updateDeckLogEvent>[1];

export function registerDeckLogEntriesRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit } = rateLimit;

  app.get(
    "/api/logbook/deck/daily/:dailyLogId/hourly",
    withErrorHandling("get deck log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const { dailyLogId } = dailyLogIdParamSchema.parse(req.params);
      const entries = await deckLogStorage.getDeckLogHourly(dailyLogId, orgId);
      res.json(entries);
    })
  );

  app.put(
    "/api/logbook/deck/hourly",
    writeOperationRateLimit,
    withErrorHandling("save deck log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      const body = bodyRecordSchema.parse(req.body);
      const entry = await deckLogStorage.upsertDeckLogHourly({
        ...body,
        orgId,
      } as DeckLogHourlyInput);
      res.json(entry);
    })
  );

  app.put(
    "/api/logbook/deck/hourly/bulk",
    writeOperationRateLimit,
    withErrorHandling("bulk save deck log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const parsed = bulkEntriesBodySchema.safeParse(req.body);
      if (!parsed.success || parsed.data.entries.length === 0) {
        res.status(400).json({ error: "entries array required" });
        return;
      }
      const withOrgId = parsed.data.entries.map((e) => ({ ...e, orgId }));
      const results = await deckLogStorage.bulkUpsertDeckLogHourly(
        withOrgId as DeckLogHourlyBulkInput
      );
      res.json(results);
    })
  );

  app.delete(
    "/api/logbook/deck/hourly/:id",
    writeOperationRateLimit,
    withErrorHandling("delete deck log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      await deckLogStorage.deleteDeckLogHourly(id, orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/logbook/deck/daily/:dailyLogId/watches",
    withErrorHandling("get deck log watch assignments", async (req, res) => {
      const orgId = req.orgId;
      const { dailyLogId } = dailyLogIdParamSchema.parse(req.params);
      const watches = await deckLogStorage.getDeckLogWatch(dailyLogId, orgId);
      res.json(watches);
    })
  );

  app.put(
    "/api/logbook/deck/watch",
    writeOperationRateLimit,
    withErrorHandling("save deck log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      const body = bodyRecordSchema.parse(req.body);
      const watch = await deckLogStorage.upsertDeckLogWatch({
        ...body,
        orgId,
      } as DeckLogWatchInput);
      res.json(watch);
    })
  );

  app.delete(
    "/api/logbook/deck/watch/:id",
    writeOperationRateLimit,
    withErrorHandling("delete deck log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      await deckLogStorage.deleteDeckLogWatch(id, orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/logbook/deck/daily/:dayId/events",
    withErrorHandling("get deck log events", async (req, res) => {
      const orgId = req.orgId;
      const { dayId } = dayIdParamSchema.parse(req.params);
      const query = eventsQuerySchema.parse(req.query);
      const filters: EventFilters = {
        eventType: query.eventType,
        source: query.source,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
      };

      const events = await deckLogStorage.getDeckLogEvents(dayId, orgId, filters);
      res.json(events);
    })
  );

  app.get(
    "/api/logbook/deck/events/:id",
    withErrorHandling("get deck log event", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const event = await deckLogStorage.getDeckLogEventById(id, orgId);

      if (!event) {
        sendNotFound(res, "Event");
        return;
      }

      res.json(event);
    })
  );

  app.post(
    "/api/logbook/deck/events",
    writeOperationRateLimit,
    withErrorHandling("create deck log event", async (req, res) => {
      const orgId = req.orgId;
      const body = eventCreateBodySchema.parse(req.body) as { dayId: string } & Record<
        string,
        unknown
      >;

      const day = await deckLogStorage.getDeckLogDailyById(body.dayId, orgId);
      if (!day) {
        sendNotFound(res, "Deck log day");
        return;
      }

      if (day.status === "locked") {
        res.status(403).json({ error: "Cannot add events to a locked deck log" });
        return;
      }

      const event = await deckLogStorage.createDeckLogEvent({
        ...body,
        orgId,
      } as DeckLogEventInput);
      sendCreated(res, event);
    })
  );

  app.patch(
    "/api/logbook/deck/events/:id",
    writeOperationRateLimit,
    withErrorHandling("update deck log event", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const body = bodyRecordSchema.parse(req.body);

      const existingEvent = await deckLogStorage.getDeckLogEventById(id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }

      const day = await deckLogStorage.getDeckLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === "locked") {
        res.status(403).json({ error: "Cannot modify events in a locked deck log" });
        return;
      }

      const event = await deckLogStorage.updateDeckLogEvent(id, body as DeckLogEventUpdate, orgId);
      res.json(event);
    })
  );

  app.delete(
    "/api/logbook/deck/events/:id",
    writeOperationRateLimit,
    withErrorHandling("delete deck log event", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);

      const existingEvent = await deckLogStorage.getDeckLogEventById(id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }

      const day = await deckLogStorage.getDeckLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === "locked") {
        res.status(403).json({ error: "Cannot delete events from a locked deck log" });
        return;
      }

      await deckLogStorage.deleteDeckLogEvent(id, orgId);
      sendDeleted(res);
    })
  );

  return 13;
}
