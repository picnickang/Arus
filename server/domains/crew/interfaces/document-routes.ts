/**
 * Crew Routes - Documents
 * Document management and expiry alerts
 */

import { z } from "zod";
import { insertCrewDocumentSchema } from "@shared/schema-runtime";
import { crewAppService as crewService } from "../application/index.js";
import { requireOrgId, requireOrgIdAndValidateBody } from "../../../middleware/auth";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";
import { getExpiryUrgencyLevel } from "./types.js";

export function registerDocumentRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew/:crewId/documents",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch crew documents", async (req, res) => {
      const documents = await crewService.getCrewDocuments(req.params.crewId, req.orgId);
      res.json(documents);
    })
  );

  app.post(
    "/api/crew/:crewId/documents",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create crew document", async (req, res) => {
      const orgId = req.headers["x-org-id"] as string;
      const body = { ...req.body };

      if (body.issuedAt && typeof body.issuedAt === "string") {
        body.issuedAt = new Date(body.issuedAt);
      }

      if (body.expiresAt && typeof body.expiresAt === "string") {
        body.expiresAt = new Date(body.expiresAt);
      }

      const docData = insertCrewDocumentSchema.parse({
        ...body,
        orgId,
        crewId: req.params.crewId,
      });
      const document = await crewService.createCrewDocument(docData, req.user?.id);
      sendCreated(res, document);
    })
  );

  app.put(
    "/api/crew-documents/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update crew document", async (req, res) => {
      const body = { ...req.body };

      if (body.issuedAt && typeof body.issuedAt === "string") {
        body.issuedAt = new Date(body.issuedAt);
      }

      if (body.expiresAt && typeof body.expiresAt === "string") {
        body.expiresAt = new Date(body.expiresAt);
      }

      const docData = insertCrewDocumentSchema.partial().parse(body);
      const document = await crewService.updateCrewDocument(
        req.params.id,
        docData,
        req.user?.id,
        req.orgId
      );
      res.json(document);
    })
  );

  app.delete(
    "/api/crew-documents/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete crew document", async (req, res) => {
      await crewService.deleteCrewDocument(req.params.id, req.user?.id, req.orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/crew-documents/expiring",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch expiring documents", async (req, res) => {
      const orgId = req.headers["x-org-id"] as string;
      const daysAhead = Number.parseInt(req.query.daysAhead as string) || 90;
      const includeAcknowledged = req.query.includeAcknowledged === "true";

      const expiringDocs = await crewService.getDocumentsExpiring(
        orgId,
        daysAhead,
        includeAcknowledged
      );

      const enrichedDocs = await Promise.all(
        expiringDocs.map(async (doc) => {
          const crewMember = await crewService.getCrewById(doc.crewId);
          return {
            ...doc,
            crewMemberName: crewMember?.name || "Unknown",
            crewMemberRank: crewMember?.rank || "Unknown",
            daysUntilExpiry: doc.expiresAt
              ? Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null,
            urgencyLevel: doc.expiresAt ? getExpiryUrgencyLevel(doc.expiresAt) : null,
          };
        })
      );

      res.json({
        documents: enrichedDocs,
        summary: {
          total: enrichedDocs.length,
          critical: enrichedDocs.filter((d) => d.urgencyLevel === "critical").length,
          warning: enrichedDocs.filter((d) => d.urgencyLevel === "warning").length,
          notice: enrichedDocs.filter((d) => d.urgencyLevel === "notice").length,
        },
      });
    })
  );

  const acknowledgeDocAlertSchema = z.object({
    notes: z.string().max(1000).optional(),
  });

  app.post(
    "/api/crew-documents/:id/acknowledge-alert",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("acknowledge document alert", async (req, res) => {
      const docId = req.params.id;
      const userId = req.user?.id;
      const { notes } = acknowledgeDocAlertSchema.parse(req.body);

      const doc = await crewService.acknowledgeDocumentAlert(docId, userId, notes);
      res.json(doc);
    })
  );

  app.post(
    "/api/crew-documents/scan-expiry",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("scan for expiring documents", async (req, res) => {
      const orgId = req.headers["x-org-id"] as string;
      const result = await crewService.scanAndFlagExpiringDocuments(orgId);
      res.json(result);
    })
  );
}
