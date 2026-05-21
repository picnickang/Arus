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
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const crewIdParamSchema = z.object({ crewId: z.string().min(1) });
const idParamSchema = z.object({ id: z.string().min(1) });
const expiringDocsQuerySchema = z.object({
  daysAhead: z.coerce.number().int().optional(),
  includeAcknowledged: z.enum(["true", "false"]).optional(),
});
const rawBodySchema = z.record(z.unknown());

export function registerDocumentRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew/:crewId/documents",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch crew documents", async (req, res) => {
      const { crewId } = crewIdParamSchema.parse(req.params);
      const documents = await crewService.getCrewDocuments(crewId, req.orgId);
      res.json(documents);
    })
  );

  app.post(
    "/api/crew/:crewId/documents",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create crew document", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const { crewId } = crewIdParamSchema.parse(req.params);
      const body: Record<string, unknown> = { ...rawBodySchema.parse(req.body ?? {}) };

      if (body.issuedAt && typeof body.issuedAt === "string") {
        body.issuedAt = new Date(body.issuedAt);
      }

      if (body.expiresAt && typeof body.expiresAt === "string") {
        body.expiresAt = new Date(body.expiresAt);
      }

      const docData = insertCrewDocumentSchema.parse({
        ...body,
        orgId,
        crewId,
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
      const { id } = idParamSchema.parse(req.params);
      const body: Record<string, unknown> = { ...rawBodySchema.parse(req.body ?? {}) };

      if (body.issuedAt && typeof body.issuedAt === "string") {
        body.issuedAt = new Date(body.issuedAt);
      }

      if (body.expiresAt && typeof body.expiresAt === "string") {
        body.expiresAt = new Date(body.expiresAt);
      }

      const docData = insertCrewDocumentSchema.partial().parse(body);
      const document = await crewService.updateCrewDocument(
        id,
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
      const { id } = idParamSchema.parse(req.params);
      await crewService.deleteCrewDocument(id, req.user?.id, req.orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/crew-documents/expiring",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch expiring documents", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const q = expiringDocsQuerySchema.parse(req.query);
      const daysAhead = q.daysAhead ?? 90;
      const includeAcknowledged = q.includeAcknowledged === "true";

      const expiringDocs = await crewService.getDocumentsExpiring(
        orgId,
        daysAhead,
        includeAcknowledged
      );

      const enrichedDocs = await Promise.all(
        expiringDocs.map(async (doc: Record<string, unknown> & { crewId: string }) => {
          const crewMember = await crewService.getCrewById(doc.crewId);
          return {
            ...doc,
            crewMemberName: crewMember?.name || "Unknown",
            crewMemberRank: crewMember?.rank || "Unknown",
            daysUntilExpiry: typeof doc.expiresAt === "string" || doc.expiresAt instanceof Date
              ? Math.ceil((new Date(doc.expiresAt as string | Date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null,
            urgencyLevel: typeof doc.expiresAt === "string" || doc.expiresAt instanceof Date
              ? getExpiryUrgencyLevel(doc.expiresAt as string | Date)
              : null,
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
      const { id: docId } = idParamSchema.parse(req.params);
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
      const orgId = DEFAULT_ORG_ID;
      const result = await crewService.scanAndFlagExpiringDocuments(orgId);
      res.json(result);
    })
  );
}
