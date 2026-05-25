/**
 * Certificate Routes (Interfaces Layer)
 * Handles HTTP concerns for certificate domain
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { certificateService } from "../service";
import { requireOrgId, type AuthenticatedRequest } from "../../../middleware/auth";
import { withErrorHandling } from "../../../lib/route-utils";
import { CERTIFICATE_TYPES, CERTIFICATE_STATUSES, ISSUING_AUTHORITY_TYPES } from "@shared/schema";

const createCertificateSchema = z.object({
  vesselId: z.string().min(1),
  certificateType: z.enum(CERTIFICATE_TYPES as readonly [string, ...string[]]),
  certificateName: z.string().min(1),
  certificateNumber: z.string().optional(),
  issuingAuthority: z.string().min(1),
  issuingAuthorityType: z
    .enum(ISSUING_AUTHORITY_TYPES as readonly [string, ...string[]])
    .optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  nextSurveyDue: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  surveyWindowStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  surveyWindowEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  equipmentId: z.string().optional(),
  surveyId: z.string().optional(),
  notes: z.string().optional(),
  documentUrl: z.string().url().optional(),
});

const updateCertificateSchema = z.object({
  status: z.enum(CERTIFICATE_STATUSES as readonly [string, ...string[]]).optional(),
  certificateNumber: z.string().optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  nextSurveyDue: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  lastSurveyDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  surveyWindowStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  surveyWindowEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  surveyId: z.string().optional(),
  notes: z.string().optional(),
  documentUrl: z.string().url().optional().nullable(),
});

const conditionSchema = z.object({
  description: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  imposedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const endorsementSchema = z.object({
  flagState: z.string().min(1),
  endorsementNumber: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export function registerCertificateRoutes(
  app: Express,
  rateLimit: {
    generalApiRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    writeOperationRateLimit?: import("../../../lib/rate-limit-factory").RateLimit;
  }
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimit;
  const writeLimit = writeOperationRateLimit || generalApiRateLimit;

  app.get(
    "/api/certificates/summary",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch certificate summary", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { vesselId } = z.object({ vesselId: z.string().optional() }).parse(req.query);
      const summary = await certificateService.getSummary(orgId, vesselId);
      return res.json(summary);
    })
  );

  app.get(
    "/api/certificates/expiring",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch expiring certificates", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { days: daysRaw } = z.object({ days: z.coerce.number().optional() }).parse(req.query);
      const days = Math.min(Math.max(daysRaw || 90, 1), 365);
      const certs = await certificateService.getExpiring(orgId, days);
      return res.json(certs);
    })
  );

  app.get(
    "/api/certificates",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("list certificates", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { vesselId, type, status } = z
        .object({
          vesselId: z.string().optional(),
          type: z.string().optional(),
          status: z.string().optional(),
        })
        .parse(req.query);
      const certs = await certificateService.listCertificates(orgId, {
        vesselId,
        type,
        status,
      });
      return res.json(certs);
    })
  );

  app.get(
    "/api/certificates/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch certificate", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const cert = await certificateService.getCertificateById(id, orgId);
      if (!cert) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      return res.json(cert);
    })
  );

  app.post(
    "/api/certificates",
    requireOrgId,
    writeLimit,
    withErrorHandling("create certificate", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const data = createCertificateSchema.parse(req.body);
      const cert = await certificateService.createCertificate(
        { ...data, orgId },
        (req as AuthenticatedRequest).user?.id
      );
      return res.status(201).json(cert);
    })
  );

  app.patch(
    "/api/certificates/:id",
    requireOrgId,
    writeLimit,
    withErrorHandling("update certificate", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const data = updateCertificateSchema.parse(req.body);
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const updated = await certificateService.updateCertificate(
        id,
        orgId,
        data,
        (req as AuthenticatedRequest).user?.id
      );
      if (!updated) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      return res.json(updated);
    })
  );

  app.post(
    "/api/certificates/:id/conditions",
    requireOrgId,
    writeLimit,
    withErrorHandling("add condition of class", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const data = conditionSchema.parse(req.body);
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const result = await certificateService.addCondition(
        id,
        orgId,
        data,
        (req as AuthenticatedRequest).user?.id
      );
      if (!result) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      return res.status(201).json(result);
    })
  );

  app.patch(
    "/api/certificates/:id/conditions/:conditionId",
    requireOrgId,
    writeLimit,
    withErrorHandling("update condition status", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id, conditionId } = z
        .object({ id: z.string().min(1), conditionId: z.string().min(1) })
        .parse(req.params);
      const { status } = z.object({ status: z.enum(["open", "closed"]) }).parse(req.body);
      const updated = await certificateService.updateConditionStatus(
        id,
        orgId,
        conditionId,
        status,
        (req as AuthenticatedRequest).user?.id
      );
      if (!updated) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      return res.json(updated);
    })
  );

  app.post(
    "/api/certificates/:id/endorsements",
    requireOrgId,
    writeLimit,
    withErrorHandling("add endorsement", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const data = endorsementSchema.parse(req.body);
      const updated = await certificateService.addEndorsement(
        req.params['id'] ?? '',
        orgId,
        data,
        (req as AuthenticatedRequest).user?.id
      );
      if (!updated) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      return res.status(201).json(updated);
    })
  );

  app.delete(
    "/api/certificates/:id",
    requireOrgId,
    writeLimit,
    withErrorHandling("delete certificate", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const deleted = await certificateService.deleteCertificate(req.params['id'] ?? '', orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      return res.json({ success: true });
    })
  );
}
