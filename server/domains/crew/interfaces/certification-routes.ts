/**
 * Crew Routes - Certifications
 * Certification management and expiry alerts
 */

import { z } from "zod";
import { insertCrewCertificationSchema } from "@shared/schema-runtime";
import { crewAppService as crewService } from "../application/index.js";
import { requireOrgId, requireOrgIdAndValidateBody } from "../../../middleware/auth";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";
import { getExpiryUrgencyLevel } from "./types.js";

export function registerCertificationRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get("/api/crew-certifications", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch crew certifications", async (req, res) => {
      const { crewId } = req.query;
      const orgId = req.orgId;
      const certifications = await crewService.listCertifications(crewId as string | undefined, orgId);
      res.json(certifications);
    })
  );

  app.post("/api/crew-certifications", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("create certification", async (req, res) => {
      const certData = insertCrewCertificationSchema.parse({ ...req.body, orgId: req.orgId });
      const cert = await crewService.createCertification(certData, req.user?.id);
      sendCreated(res, cert);
    })
  );

  app.put("/api/crew-certifications/:id", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("update certification", async (req, res) => {
      const certData = insertCrewCertificationSchema.partial().parse(req.body);
      const cert = await crewService.updateCertification(req.params.id, certData, req.user?.id, req.orgId);
      res.json(cert);
    })
  );

  app.delete("/api/crew-certifications/:id", requireOrgId, criticalOperationRateLimit,
    withErrorHandling("delete certification", async (req, res) => {
      await crewService.deleteCertification(req.params.id, req.user?.id, req.orgId);
      sendDeleted(res);
    })
  );

  app.get("/api/crew-certifications/expiring", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch expiring certifications", async (req, res) => {
      const orgId = req.headers["x-org-id"] as string;
      const daysAhead = Number.parseInt(req.query.daysAhead as string) || 90;
      const includeAcknowledged = req.query.includeAcknowledged === "true";

      const expiringCerts = await crewService.getCertificationsExpiring(orgId, daysAhead, includeAcknowledged);

      const enrichedCerts = await Promise.all(
        expiringCerts.map(async (cert) => {
          const crewMember = await crewService.getCrewMemberById(cert.crewId);
          return {
            ...cert,
            crewMemberName: crewMember?.name || "Unknown",
            crewMemberRank: crewMember?.rank || "Unknown",
            daysUntilExpiry: Math.ceil(
              (new Date(cert.expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            ),
            urgencyLevel: getExpiryUrgencyLevel(cert.expiresAt!),
          };
        })
      );

      res.json({
        certifications: enrichedCerts,
        summary: {
          total: enrichedCerts.length,
          critical: enrichedCerts.filter((c) => c.urgencyLevel === "critical").length,
          warning: enrichedCerts.filter((c) => c.urgencyLevel === "warning").length,
          notice: enrichedCerts.filter((c) => c.urgencyLevel === "notice").length,
        },
      });
    })
  );

  const acknowledgeAlertSchema = z.object({
    notes: z.string().max(1000).optional(),
  });

  app.post("/api/crew-certifications/:id/acknowledge-alert", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("acknowledge certification alert", async (req, res) => {
      const certId = req.params.id;
      const userId = req.user?.id;
      const { notes } = acknowledgeAlertSchema.parse(req.body);

      const cert = await crewService.acknowledgeCertificationAlert(certId, userId, notes);
      res.json(cert);
    })
  );

  app.post("/api/crew-certifications/scan-expiry", requireOrgId, criticalOperationRateLimit,
    withErrorHandling("scan for expiring certifications", async (req, res) => {
      const orgId = req.headers["x-org-id"] as string;
      const result = await crewService.scanAndFlagExpiringCertifications(orgId);
      res.json(result);
    })
  );
}
