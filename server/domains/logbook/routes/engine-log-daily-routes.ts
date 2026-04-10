/**
 * Engine Log Daily Routes
 * 
 * Core CRUD operations for daily engine logs.
 */

import type { Express } from "express";
import { engineLogStorage } from "../../../repositories";
import type { RateLimiters, EngineLogFilters, SignatureDetails, LockDetails } from "./types";
import { validateUUID } from "../../../utils/validation";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";

export function registerEngineLogDailyRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit, criticalOperationRateLimit } = rateLimit;

  app.get("/api/logbook/engine/daily",
    withErrorHandling("get engine log daily entries", async (req, res) => {
      const orgId = req.orgId;
      const filters: EngineLogFilters = {
        vesselId: req.query.vesselId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as string | undefined,
      };
      
      const entries = await engineLogStorage.getEngineLogDaily(orgId, filters);
      res.json(entries);
    })
  );

  app.get("/api/logbook/engine/daily/:id",
    withErrorHandling("get engine log daily entry", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const entry = await engineLogStorage.getEngineLogDailyById(id, orgId);
      if (!entry) {
        return sendNotFound(res, "Engine log entry");
      }
      
      res.json(entry);
    })
  );

  app.get("/api/logbook/engine/daily/:id/complete",
    withErrorHandling("get complete engine log", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const complete = await engineLogStorage.getEngineLogComplete(id, orgId);
      if (!complete) {
        return sendNotFound(res, "Engine log entry");
      }
      
      res.json(complete);
    })
  );

  app.get("/api/logbook/engine/vessel/:vesselId/date/:logDate",
    withErrorHandling("get engine log by date", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, logDate } = req.params;
      
      let entry = await engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId);
      
      if (!entry) {
        entry = await engineLogStorage.createEngineLogDaily({
          orgId,
          vesselId,
          logDate,
          status: 'open',
        });
      }
      
      const complete = await engineLogStorage.getEngineLogComplete(entry.id, orgId);
      res.json(complete);
    })
  );

  app.post("/api/logbook/engine/daily", writeOperationRateLimit,
    withErrorHandling("create engine log daily", async (req, res) => {
      const orgId = req.orgId;
      
      const existing = await engineLogStorage.getEngineLogDailyByDate(
        req.body.vesselId,
        req.body.logDate,
        orgId
      );
      
      if (existing) {
        return res.status(409).json({ 
          error: "Engine log already exists for this vessel and date",
          existingId: existing.id
        });
      }
      
      const entry = await engineLogStorage.createEngineLogDaily({
        ...req.body,
        orgId,
      });
      
      sendCreated(res, entry);
    })
  );

  app.patch("/api/logbook/engine/daily/:id", writeOperationRateLimit,
    withErrorHandling("update engine log daily", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const entry = await engineLogStorage.updateEngineLogDaily(id, req.body, orgId);
      res.json(entry);
    })
  );

  app.post("/api/logbook/engine/daily/:id/sign", writeOperationRateLimit,
    withErrorHandling("sign engine log", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const { signedByCrewId, signedByName, signedByRank }: SignatureDetails = req.body;
      if (!signedByCrewId || !signedByName || !signedByRank) {
        return res.status(400).json({ error: "Signature details required" });
      }
      
      const entry = await engineLogStorage.signEngineLogDaily(id, { signedByCrewId, signedByName, signedByRank }, orgId);
      res.json(entry);
    })
  );

  app.delete("/api/logbook/engine/daily/:id", criticalOperationRateLimit,
    withErrorHandling("delete engine log daily", async (req, res) => {
      const orgId = req.orgId;
      await engineLogStorage.deleteEngineLogDaily(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.post("/api/logbook/engine/daily/:id/lock", writeOperationRateLimit,
    withErrorHandling("lock engine log", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const { lockedByUserId, lockedByUserName }: LockDetails = req.body;
      if (!lockedByUserId || !lockedByUserName) {
        return res.status(400).json({ error: "lockedByUserId and lockedByUserName required" });
      }
      
      try {
        const locked = await engineLogStorage.lockEngineLogDaily(id, { lockedByUserId, lockedByUserName }, orgId);
        res.json(locked);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('already locked')) {
          return res.status(409).json({ error: message });
        }
        throw error;
      }
    })
  );

  app.post("/api/logbook/engine/daily/:id/unlock", writeOperationRateLimit,
    withErrorHandling("unlock engine log", async (req, res) => {
      const orgId = req.orgId;
      const unlocked = await engineLogStorage.unlockEngineLogDaily(req.params.id, orgId);
      res.json(unlocked);
    })
  );

  app.get("/api/logbook/engine/days",
    withErrorHandling("get engine log days", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, from, to } = req.query;
      
      const entries = await engineLogStorage.getEngineLogDaily(orgId, {
        vesselId: vesselId as string | undefined,
        startDate: from as string | undefined,
        endDate: to as string | undefined,
      });
      res.json(entries);
    })
  );

  app.post("/api/logbook/engine/days/ensure", writeOperationRateLimit,
    withErrorHandling("ensure engine log day", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, date } = req.body;
      
      if (!vesselId || !date) {
        return res.status(400).json({ error: "vesselId and date required" });
      }
      
      let entry = await engineLogStorage.getEngineLogDailyByDate(vesselId, date, orgId);
      
      if (!entry) {
        entry = await engineLogStorage.createEngineLogDaily({
          orgId,
          vesselId,
          logDate: date,
          status: 'open',
        });
      }
      
      res.json(entry);
    })
  );

  return 13;
}
