/**
 * Crew Routes - Notification Settings
 * Crew notification preferences management
 */

import { z } from "zod";
import { crewAppService as crewService } from "../application/index.js";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../../middleware/auth";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";

export function registerNotificationRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew/:crewId/notification-settings",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch notification settings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { crewId = '' } = req.params;

      const crew = await crewService.getCrewById(crewId, orgId);
      if (!crew) {
        return sendNotFound(res, "Crew member");
      }

      const settings = await crewService.getCrewNotificationSettings(crewId, orgId);

      if (!settings) {
        return res.json({
          crewId,
          orgId,
          emailAlertsEnabled: true,
          certExpiryEmailEnabled: true,
          documentExpiryEmailEnabled: true,
          complianceEmailEnabled: true,
          overrideEmail: null,
        });
      }

      res.json(settings);
    })
  );

  app.put(
    "/api/crew/:crewId/notification-settings",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update notification settings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { crewId = '' } = req.params;

      const crew = await crewService.getCrewById(crewId, orgId);
      if (!crew) {
        return sendNotFound(res, "Crew member");
      }

      const emailSchema = z.object({
        emailAlertsEnabled: z.boolean().optional(),
        certExpiryEmailEnabled: z.boolean().optional(),
        documentExpiryEmailEnabled: z.boolean().optional(),
        complianceEmailEnabled: z.boolean().optional(),
        overrideEmail: z.string().email().nullable().optional(),
      });

      const settingsData = emailSchema.parse(req.body);

      const settings = await crewService.upsertCrewNotificationSettings(
        crewId,
        orgId,
        settingsData
      );

      res.json(settings);
    })
  );

  app.get(
    "/api/crew-notification-settings/bulk",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch bulk notification settings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const settings = await crewService.getAllCrewNotificationSettings(orgId);
      res.json(settings);
    })
  );
}
