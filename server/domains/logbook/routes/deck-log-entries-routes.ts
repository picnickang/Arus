/**
 * Deck Log Entries Routes
 *
 * Hourly entries, watches, and events for deck logs.
 */

import type { Express } from "express";
import { deckLogStorage } from "../../../repositories";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils";
import type { RateLimiters, EventFilters } from "./types";

export function registerDeckLogEntriesRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit } = rateLimit;

  app.get(
    "/api/logbook/deck/daily/:dailyLogId/hourly",
    withErrorHandling("get deck log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = await deckLogStorage.getDeckLogHourly(req.params.dailyLogId, orgId);
      res.json(entries);
    })
  );

  app.put(
    "/api/logbook/deck/hourly",
    writeOperationRateLimit,
    withErrorHandling("save deck log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      const entry = await deckLogStorage.upsertDeckLogHourly({
        ...req.body,
        orgId,
      });
      res.json(entry);
    })
  );

  app.put(
    "/api/logbook/deck/hourly/bulk",
    writeOperationRateLimit,
    withErrorHandling("bulk save deck log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = req.body.entries as Array<any>;

      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: "entries array required" });
        return;
      }

      const withOrgId = entries.map((e) => ({ ...e, orgId }));
      const results = await deckLogStorage.bulkUpsertDeckLogHourly(withOrgId);
      res.json(results);
    })
  );

  app.delete(
    "/api/logbook/deck/hourly/:id",
    writeOperationRateLimit,
    withErrorHandling("delete deck log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      await deckLogStorage.deleteDeckLogHourly(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/logbook/deck/daily/:dailyLogId/watches",
    withErrorHandling("get deck log watch assignments", async (req, res) => {
      const orgId = req.orgId;
      const watches = await deckLogStorage.getDeckLogWatch(req.params.dailyLogId, orgId);
      res.json(watches);
    })
  );

  app.put(
    "/api/logbook/deck/watch",
    writeOperationRateLimit,
    withErrorHandling("save deck log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      const watch = await deckLogStorage.upsertDeckLogWatch({
        ...req.body,
        orgId,
      });
      res.json(watch);
    })
  );

  app.delete(
    "/api/logbook/deck/watch/:id",
    writeOperationRateLimit,
    withErrorHandling("delete deck log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      await deckLogStorage.deleteDeckLogWatch(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/logbook/deck/daily/:dayId/events",
    withErrorHandling("get deck log events", async (req, res) => {
      const orgId = req.orgId;
      const { dayId } = req.params;
      const filters: EventFilters = {
        eventType: req.query.eventType as string | undefined,
        source: req.query.source as string | undefined,
        startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
        endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
      };

      const events = await deckLogStorage.getDeckLogEvents(dayId, orgId, filters);
      res.json(events);
    })
  );

  app.get(
    "/api/logbook/deck/events/:id",
    withErrorHandling("get deck log event", async (req, res) => {
      const orgId = req.orgId;
      const event = await deckLogStorage.getDeckLogEventById(req.params.id, orgId);

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

      const day = await deckLogStorage.getDeckLogDailyById(req.body.dayId, orgId);
      if (!day) {
        sendNotFound(res, "Deck log day");
        return;
      }

      if (day.status === "locked") {
        res.status(403).json({ error: "Cannot add events to a locked deck log" });
        return;
      }

      const event = await deckLogStorage.createDeckLogEvent({
        ...req.body,
        orgId,
      });
      sendCreated(res, event);
    })
  );

  app.patch(
    "/api/logbook/deck/events/:id",
    writeOperationRateLimit,
    withErrorHandling("update deck log event", async (req, res) => {
      const orgId = req.orgId;

      const existingEvent = await deckLogStorage.getDeckLogEventById(req.params.id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }

      const day = await deckLogStorage.getDeckLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === "locked") {
        res.status(403).json({ error: "Cannot modify events in a locked deck log" });
        return;
      }

      const event = await deckLogStorage.updateDeckLogEvent(req.params.id, req.body, orgId);
      res.json(event);
    })
  );

  app.delete(
    "/api/logbook/deck/events/:id",
    writeOperationRateLimit,
    withErrorHandling("delete deck log event", async (req, res) => {
      const orgId = req.orgId;

      const existingEvent = await deckLogStorage.getDeckLogEventById(req.params.id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }

      const day = await deckLogStorage.getDeckLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === "locked") {
        res.status(403).json({ error: "Cannot delete events from a locked deck log" });
        return;
      }

      await deckLogStorage.deleteDeckLogEvent(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  return 13;
}
