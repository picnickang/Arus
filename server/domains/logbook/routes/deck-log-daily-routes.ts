/**
 * Deck Log Daily Routes
 * 
 * Core CRUD operations for daily deck logs.
 */

import type { Express } from "express";
import { storage } from "../../../storage";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";
import type { RateLimiters, DeckLogFilters, SignatureDetails, LockDetails } from "./types";

export function registerDeckLogDailyRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit, criticalOperationRateLimit } = rateLimit;

  app.get("/api/logbook/deck/daily",
    withErrorHandling("get deck log daily entries", async (req, res) => {
      const orgId = req.orgId;
      const filters: DeckLogFilters = {
        vesselId: req.query.vesselId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as string | undefined,
      };
      
      const entries = await storage.getDeckLogDaily(orgId, filters);
      res.json(entries);
    })
  );

  app.get("/api/logbook/deck/daily/:id",
    withErrorHandling("get deck log daily entry", async (req, res) => {
      const orgId = req.orgId;
      const entry = await storage.getDeckLogDailyById(req.params.id, orgId);
      
      if (!entry) {
        return sendNotFound(res, "Deck log entry");
      }
      
      res.json(entry);
    })
  );

  app.get("/api/logbook/deck/daily/:id/complete",
    withErrorHandling("get complete deck log", async (req, res) => {
      const orgId = req.orgId;
      const complete = await storage.getDeckLogComplete(req.params.id, orgId);
      
      if (!complete) {
        return sendNotFound(res, "Deck log entry");
      }
      
      res.json(complete);
    })
  );

  app.get("/api/logbook/deck/vessel/:vesselId/date/:logDate",
    withErrorHandling("get deck log by date", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, logDate } = req.params;
      
      let entry = await storage.getDeckLogDailyByDate(vesselId, logDate, orgId);
      
      if (!entry) {
        entry = await storage.createDeckLogDaily({
          orgId,
          vesselId,
          logDate,
          status: 'draft',
        });
      }
      
      const complete = await storage.getDeckLogComplete(entry.id, orgId);
      res.json(complete);
    })
  );

  app.post("/api/logbook/deck/daily", writeOperationRateLimit,
    withErrorHandling("create deck log daily", async (req, res) => {
      const orgId = req.orgId;
      
      const existing = await storage.getDeckLogDailyByDate(
        req.body.vesselId,
        req.body.logDate,
        orgId
      );
      
      if (existing) {
        return res.status(409).json({ 
          error: "Deck log already exists for this vessel and date",
          existingId: existing.id
        });
      }
      
      const entry = await storage.createDeckLogDaily({
        ...req.body,
        orgId,
      });
      
      sendCreated(res, entry);
    })
  );

  app.patch("/api/logbook/deck/daily/:id", writeOperationRateLimit,
    withErrorHandling("update deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const entry = await storage.updateDeckLogDaily(req.params.id, req.body, orgId);
      res.json(entry);
    })
  );

  app.post("/api/logbook/deck/daily/:id/sign", writeOperationRateLimit,
    withErrorHandling("sign deck log", async (req, res) => {
      const orgId = req.orgId;
      const { signedByCrewId, signedByName, signedByRank }: SignatureDetails = req.body;
      
      if (!signedByCrewId || !signedByName || !signedByRank) {
        return res.status(400).json({ error: "Signature details required" });
      }
      
      const entry = await storage.signDeckLogDaily(
        req.params.id,
        { signedByCrewId, signedByName, signedByRank },
        orgId
      );
      
      res.json(entry);
    })
  );

  app.delete("/api/logbook/deck/daily/:id", criticalOperationRateLimit,
    withErrorHandling("delete deck log daily", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteDeckLogDaily(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.post("/api/logbook/deck/daily/:id/lock", writeOperationRateLimit,
    withErrorHandling("lock deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const { lockedByUserId, lockedByUserName }: LockDetails = req.body;
      
      if (!lockedByUserId || !lockedByUserName) {
        return res.status(400).json({ error: "lockedByUserId and lockedByUserName required" });
      }
      
      const locked = await storage.lockDeckLogDaily(req.params.id, {
        lockedByUserId,
        lockedByUserName,
      }, orgId);
      res.json(locked);
    })
  );

  app.post("/api/logbook/deck/daily/:id/unlock", writeOperationRateLimit,
    withErrorHandling("unlock deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const unlocked = await storage.unlockDeckLogDaily(req.params.id, orgId);
      res.json(unlocked);
    })
  );

  app.get("/api/logbook/deck/days",
    withErrorHandling("get deck log days", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, from, to } = req.query;
      
      const entries = await storage.getDeckLogDaily(orgId, {
        vesselId: vesselId as string | undefined,
        startDate: from as string | undefined,
        endDate: to as string | undefined,
      });
      res.json(entries);
    })
  );

  app.post("/api/logbook/deck/days/ensure", writeOperationRateLimit,
    withErrorHandling("ensure deck log day", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, date } = req.body;
      
      if (!vesselId || !date) {
        return res.status(400).json({ error: "vesselId and date required" });
      }
      
      let entry = await storage.getDeckLogDailyByDate(vesselId, date, orgId);
      
      if (!entry) {
        entry = await storage.createDeckLogDaily({
          orgId,
          vesselId,
          logDate: date,
          status: 'open',
        });
      }
      
      res.json(entry);
    })
  );

  return 12;
}
