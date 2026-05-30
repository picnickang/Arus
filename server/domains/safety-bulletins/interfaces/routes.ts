/**
 * Safety Bulletin Routes (Interfaces Layer)
 * HTTP concerns for the safety-bulletins domain.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { safetyBulletinService } from "../service";
import { requireOrgId, type AuthenticatedRequest } from "../../../middleware/auth";
import { withErrorHandling } from "../../../lib/route-utils";
import { SAFETY_BULLETIN_SEVERITIES } from "@shared/schema";

const createBulletinSchema = z.object({
  vesselId: z.string().min(1).optional(),
  title: z.string().min(1),
  body: z.string().optional(),
  severity: z.enum(SAFETY_BULLETIN_SEVERITIES as readonly [string, ...string[]]).optional(),
  category: z.string().optional(),
  reference: z.string().optional(),
  effectiveDate: z.string().optional(),
  expiresAt: z.string().optional(),
});

export function registerSafetyBulletinRoutes(
  app: Express,
  rateLimit: {
    generalApiRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    writeOperationRateLimit?: import("../../../lib/rate-limit-factory").RateLimit;
  },
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimit;
  const writeLimit = writeOperationRateLimit || generalApiRateLimit;

  app.get(
    "/api/safety-bulletins",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("list safety bulletins", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { vesselId, includeInactive } = z
        .object({
          vesselId: z.string().optional(),
          // Query strings only — treat the literal "true" as true so
          // `includeInactive=false` is not coerced to truthy.
          includeInactive: z
            .enum(["true", "false"])
            .optional()
            .transform((value) => value === "true"),
        })
        .parse(req.query);
      const bulletins = await safetyBulletinService.listBulletins(orgId, {
        activeOnly: !includeInactive,
        ...(vesselId !== undefined && { vesselId }),
      });
      return res.json(bulletins);
    }),
  );

  app.post(
    "/api/safety-bulletins",
    requireOrgId,
    writeLimit,
    withErrorHandling("create safety bulletin", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const data = createBulletinSchema.parse(req.body);
      const bulletin = await safetyBulletinService.createBulletin({
        ...data,
        orgId,
        createdBy: (req as AuthenticatedRequest).user?.id,
      });
      return res.status(201).json(bulletin);
    }),
  );
}
