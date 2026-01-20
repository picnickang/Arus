/**
 * Engine Log Entries Routes
 * 
 * Hourly entries, generators, watches, and events for engine logs.
 */

import type { Express } from "express";
import { storage } from "../../../storage";
import type { RateLimiters, EventFilters } from "./types";
import { validateUUID } from "../../../utils/validation";
import { withErrorHandling, sendNotFound, sendDeleted, sendCreated } from "../../../lib/route-utils";

export function registerEngineLogEntriesRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit } = rateLimit;

  app.get("/api/logbook/engine/daily/:dailyLogId/hourly",
    withErrorHandling("get engine log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = await storage.getEngineLogHourly(req.params.dailyLogId, orgId);
      res.json(entries);
    })
  );

  app.put("/api/logbook/engine/hourly", writeOperationRateLimit,
    withErrorHandling("save engine log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      const entry = await storage.upsertEngineLogHourly({
        ...req.body,
        orgId,
      });
      res.json(entry);
    })
  );

  app.put("/api/logbook/engine/hourly/bulk", writeOperationRateLimit,
    withErrorHandling("save engine log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = req.body.entries as Array<any>;
      
      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: "entries array required" });
        return;
      }
      
      const withOrgId = entries.map(e => ({ ...e, orgId }));
      const results = await storage.bulkUpsertEngineLogHourly(withOrgId);
      res.json(results);
    })
  );

  app.delete("/api/logbook/engine/hourly/:id", writeOperationRateLimit,
    withErrorHandling("delete engine log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteEngineLogHourly(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get("/api/logbook/engine/daily/:dailyLogId/generators",
    withErrorHandling("get engine log generator entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = await storage.getEngineLogGenerator(req.params.dailyLogId, orgId);
      res.json(entries);
    })
  );

  app.put("/api/logbook/engine/generator", writeOperationRateLimit,
    withErrorHandling("save engine log generator entry", async (req, res) => {
      const orgId = req.orgId;
      const entry = await storage.upsertEngineLogGenerator({
        ...req.body,
        orgId,
      });
      res.json(entry);
    })
  );

  app.put("/api/logbook/engine/generator/bulk", writeOperationRateLimit,
    withErrorHandling("save engine log generator entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = req.body.entries as Array<any>;
      
      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: "entries array required" });
        return;
      }
      
      const withOrgId = entries.map(e => ({ ...e, orgId }));
      const results = await storage.bulkUpsertEngineLogGenerator(withOrgId);
      res.json(results);
    })
  );

  app.delete("/api/logbook/engine/generator/:id", writeOperationRateLimit,
    withErrorHandling("delete engine log generator entry", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteEngineLogGenerator(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get("/api/logbook/engine/daily/:dailyLogId/watches",
    withErrorHandling("get engine log watches", async (req, res) => {
      const orgId = req.orgId;
      const watches = await storage.getEngineLogWatch(req.params.dailyLogId, orgId);
      res.json(watches);
    })
  );

  app.put("/api/logbook/engine/watch", writeOperationRateLimit,
    withErrorHandling("save engine log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      const watch = await storage.upsertEngineLogWatch({
        ...req.body,
        orgId,
      });
      res.json(watch);
    })
  );

  app.delete("/api/logbook/engine/watch/:id", writeOperationRateLimit,
    withErrorHandling("delete engine log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteEngineLogWatch(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get("/api/logbook/engine/daily/:dayId/events",
    withErrorHandling("get engine log events", async (req, res) => {
      const orgId = req.orgId;
      const { dayId } = req.params;
      const filters: EventFilters = {
        eventType: req.query.eventType as string | undefined,
        source: req.query.source as string | undefined,
        startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
        endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
      };
      
      const events = await storage.getEngineLogEvents(dayId, orgId, filters);
      res.json(events);
    })
  );

  app.get("/api/logbook/engine/events/:id",
    withErrorHandling("get engine log event", async (req, res) => {
      const orgId = req.orgId;
      const event = await storage.getEngineLogEventById(req.params.id, orgId);
      
      if (!event) {
        sendNotFound(res, "Event");
        return;
      }
      
      res.json(event);
    })
  );

  app.post("/api/logbook/engine/events", writeOperationRateLimit,
    withErrorHandling("create engine log event", async (req, res) => {
      const orgId = req.orgId;
      
      const day = await storage.getEngineLogDailyById(req.body.dayId, orgId);
      if (!day) {
        sendNotFound(res, "Engine log day");
        return;
      }

      if (day.status === 'locked') {
        res.status(403).json({ error: "Cannot add events to a locked engine log" });
        return;
      }
      
      const event = await storage.createEngineLogEvent({
        ...req.body,
        orgId,
      });
      sendCreated(res, event);
    })
  );

  app.patch("/api/logbook/engine/events/:id", writeOperationRateLimit,
    withErrorHandling("update engine log event", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const existingEvent = await storage.getEngineLogEventById(id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }
      
      const day = await storage.getEngineLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === 'locked') {
        res.status(403).json({ error: "Cannot modify events in a locked engine log" });
        return;
      }
      
      const event = await storage.updateEngineLogEvent(id, req.body, orgId);
      res.json(event);
    })
  );

  app.delete("/api/logbook/engine/events/:id", writeOperationRateLimit,
    withErrorHandling("delete engine log event", async (req, res) => {
      const orgId = req.orgId;
      
      const existingEvent = await storage.getEngineLogEventById(req.params.id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }
      
      const day = await storage.getEngineLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === 'locked') {
        res.status(403).json({ error: "Cannot delete events from a locked engine log" });
        return;
      }
      
      await storage.deleteEngineLogEvent(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  return 17;
}
