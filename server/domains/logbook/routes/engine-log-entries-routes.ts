/**
 * Engine Log Entries Routes
 *
 * Hourly entries, generators, watches, and events for engine logs.
 */

import type { Express } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { engineLogStorage } from "../../../repositories";
import type { RateLimiters, EventFilters } from "./types";
import { validateUUID } from "../../../utils/validation";
import {
  withErrorHandling,
  sendNotFound,
  sendDeleted,
  sendCreated,
} from "../../../lib/route-utils";

const idParamSchema = z.object({ id: z.string().min(1) });
const dailyLogIdParamSchema = z.object({ dailyLogId: z.string().min(1) });
const dayIdParamSchema = z.object({ dayId: z.string().min(1) });
const bodyRecordSchema = jsonRecordSchema;
const bulkEntriesBodySchema = z.object({ entries: z.array(jsonRecordSchema) });
const eventsQuerySchema = z.object({
  eventType: z.string().optional(),
  source: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});
const eventCreateBodySchema = z
  .object({ dayId: z.string().min(1) })
  .and(jsonRecordSchema);

type EngineLogHourlyInput = Parameters<typeof engineLogStorage.upsertEngineLogHourly>[0];
type EngineLogHourlyBulkInput = Parameters<typeof engineLogStorage.bulkUpsertEngineLogHourly>[0];
type EngineLogGeneratorInput = Parameters<typeof engineLogStorage.upsertEngineLogGenerator>[0];
type EngineLogGeneratorBulkInput = Parameters<
  typeof engineLogStorage.bulkUpsertEngineLogGenerator
>[0];
type EngineLogWatchInput = Parameters<typeof engineLogStorage.upsertEngineLogWatch>[0];
type EngineLogEventInput = Parameters<typeof engineLogStorage.createEngineLogEvent>[0];
type EngineLogEventUpdate = Parameters<typeof engineLogStorage.updateEngineLogEvent>[1];

export function registerEngineLogEntriesRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit } = rateLimit;

  app.get(
    "/api/logbook/engine/daily/:dailyLogId/hourly",
    withErrorHandling("get engine log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const { dailyLogId } = dailyLogIdParamSchema.parse(req.params);
      const entries = await engineLogStorage.getEngineLogHourly(dailyLogId, orgId);
      res.json(entries);
    })
  );

  app.put(
    "/api/logbook/engine/hourly",
    writeOperationRateLimit,
    withErrorHandling("save engine log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      const body = bodyRecordSchema.parse(req.body);
      const entry = await engineLogStorage.upsertEngineLogHourly({
        ...body,
        orgId,
      } as EngineLogHourlyInput);
      res.json(entry);
    })
  );

  app.put(
    "/api/logbook/engine/hourly/bulk",
    writeOperationRateLimit,
    withErrorHandling("save engine log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const parsed = bulkEntriesBodySchema.safeParse(req.body);
      if (!parsed.success || parsed.data.entries.length === 0) {
        res.status(400).json({ error: "entries array required" });
        return;
      }
      const withOrgId = parsed.data.entries.map((e) => ({ ...e, orgId }));
      const results = await engineLogStorage.bulkUpsertEngineLogHourly(
        withOrgId as EngineLogHourlyBulkInput
      );
      res.json(results);
    })
  );

  app.delete(
    "/api/logbook/engine/hourly/:id",
    writeOperationRateLimit,
    withErrorHandling("delete engine log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      await engineLogStorage.deleteEngineLogHourly(id, orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/logbook/engine/daily/:dailyLogId/generators",
    withErrorHandling("get engine log generator entries", async (req, res) => {
      const orgId = req.orgId;
      const { dailyLogId } = dailyLogIdParamSchema.parse(req.params);
      const entries = await engineLogStorage.getEngineLogGenerator(dailyLogId, orgId);
      res.json(entries);
    })
  );

  app.put(
    "/api/logbook/engine/generator",
    writeOperationRateLimit,
    withErrorHandling("save engine log generator entry", async (req, res) => {
      const orgId = req.orgId;
      const body = bodyRecordSchema.parse(req.body);
      const entry = await engineLogStorage.upsertEngineLogGenerator({
        ...body,
        orgId,
      } as EngineLogGeneratorInput);
      res.json(entry);
    })
  );

  app.put(
    "/api/logbook/engine/generator/bulk",
    writeOperationRateLimit,
    withErrorHandling("save engine log generator entries", async (req, res) => {
      const orgId = req.orgId;
      const parsed = bulkEntriesBodySchema.safeParse(req.body);
      if (!parsed.success || parsed.data.entries.length === 0) {
        res.status(400).json({ error: "entries array required" });
        return;
      }
      const withOrgId = parsed.data.entries.map((e) => ({ ...e, orgId }));
      const results = await engineLogStorage.bulkUpsertEngineLogGenerator(
        withOrgId as EngineLogGeneratorBulkInput
      );
      res.json(results);
    })
  );

  app.delete(
    "/api/logbook/engine/generator/:id",
    writeOperationRateLimit,
    withErrorHandling("delete engine log generator entry", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      await engineLogStorage.deleteEngineLogGenerator(id, orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/logbook/engine/daily/:dailyLogId/watches",
    withErrorHandling("get engine log watches", async (req, res) => {
      const orgId = req.orgId;
      const { dailyLogId } = dailyLogIdParamSchema.parse(req.params);
      const watches = await engineLogStorage.getEngineLogWatch(dailyLogId, orgId);
      res.json(watches);
    })
  );

  app.put(
    "/api/logbook/engine/watch",
    writeOperationRateLimit,
    withErrorHandling("save engine log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      const body = bodyRecordSchema.parse(req.body);
      const watch = await engineLogStorage.upsertEngineLogWatch({
        ...body,
        orgId,
      } as EngineLogWatchInput);
      res.json(watch);
    })
  );

  app.delete(
    "/api/logbook/engine/watch/:id",
    writeOperationRateLimit,
    withErrorHandling("delete engine log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      await engineLogStorage.deleteEngineLogWatch(id, orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/logbook/engine/daily/:dayId/events",
    withErrorHandling("get engine log events", async (req, res) => {
      const orgId = req.orgId;
      const { dayId } = dayIdParamSchema.parse(req.params);
      const query = eventsQuerySchema.parse(req.query);
      const filters: EventFilters = {
        eventType: query.eventType,
        source: query.source,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
      };

      const events = await engineLogStorage.getEngineLogEvents(dayId, orgId, filters);
      res.json(events);
    })
  );

  app.get(
    "/api/logbook/engine/events/:id",
    withErrorHandling("get engine log event", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const event = await engineLogStorage.getEngineLogEventById(id, orgId);

      if (!event) {
        sendNotFound(res, "Event");
        return;
      }

      res.json(event);
    })
  );

  app.post(
    "/api/logbook/engine/events",
    writeOperationRateLimit,
    withErrorHandling("create engine log event", async (req, res) => {
      const orgId = req.orgId;
      const body = eventCreateBodySchema.parse(req.body) as { dayId: string } & Record<
        string,
        unknown
      >;

      const day = await engineLogStorage.getEngineLogDailyById(body.dayId, orgId);
      if (!day) {
        sendNotFound(res, "Engine log day");
        return;
      }

      if (day.status === "locked") {
        res.status(403).json({ error: "Cannot add events to a locked engine log" });
        return;
      }

      const event = await engineLogStorage.createEngineLogEvent({
        ...body,
        orgId,
      } as EngineLogEventInput);
      sendCreated(res, event);
    })
  );

  app.patch(
    "/api/logbook/engine/events/:id",
    writeOperationRateLimit,
    withErrorHandling("update engine log event", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      if (!validateUUID(id, res)) {
        return;
      }
      const body = bodyRecordSchema.parse(req.body);

      const existingEvent = await engineLogStorage.getEngineLogEventById(id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }

      const day = await engineLogStorage.getEngineLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === "locked") {
        res.status(403).json({ error: "Cannot modify events in a locked engine log" });
        return;
      }

      const event = await engineLogStorage.updateEngineLogEvent(
        id,
        body as EngineLogEventUpdate,
        orgId
      );
      res.json(event);
    })
  );

  app.delete(
    "/api/logbook/engine/events/:id",
    writeOperationRateLimit,
    withErrorHandling("delete engine log event", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);

      const existingEvent = await engineLogStorage.getEngineLogEventById(id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }

      const day = await engineLogStorage.getEngineLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === "locked") {
        res.status(403).json({ error: "Cannot delete events from a locked engine log" });
        return;
      }

      await engineLogStorage.deleteEngineLogEvent(id, orgId);
      sendDeleted(res);
    })
  );

  return 17;
}
