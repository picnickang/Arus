/**
 * Crew Routes - Manager-raised Custom Alerts
 *
 * Lets managers raise ad-hoc alerts/notes against a crew member (e.g. "follow
 * up on visa", "performance review due"). Unlike certification/document expiry
 * alerts these carry no expiry-scan machinery — severity is chosen by the
 * manager and the alert is acknowledged/resolved manually. They appear in the
 * crew Alerts tab alongside the expiry-derived ones.
 */

import { z } from "zod";
import { crewAppService as crewService } from "../application/index.js";
import { requireOrgId, requireOrgIdAndValidateBody } from "../../../middleware/auth";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";

const listQuerySchema = z.object({ crewId: z.string().min(1) });
const alertIdParamSchema = z.object({ id: z.string().min(1) });

const createAlertSchema = z.object({
  crewId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(1000).optional(),
  severity: z.enum(["critical", "warning", "notice"]).default("notice"),
  dueAt: z.string().datetime().optional(),
});

const acknowledgeSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export function registerCrewAlertRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew-alerts",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("list crew alerts", async (req, res) => {
      const { crewId } = listQuerySchema.parse(req.query);
      const alerts = await crewService.listCrewAlerts(crewId, req.orgId);
      res.json(alerts);
    })
  );

  app.post(
    "/api/crew-alerts",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create crew alert", async (req, res) => {
      const body = createAlertSchema.parse(req.body ?? {});
      const alert = await crewService.createCrewAlert({
        orgId: req.orgId,
        crewId: body.crewId,
        title: body.title,
        detail: body.detail ?? null,
        severity: body.severity,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        createdBy: req.user?.id ?? null,
      });
      sendCreated(res, alert);
    })
  );

  app.post(
    "/api/crew-alerts/:id/acknowledge",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("acknowledge crew alert", async (req, res) => {
      const { id } = alertIdParamSchema.parse(req.params);
      const { notes } = acknowledgeSchema.parse(req.body ?? {});
      const alert = await crewService.acknowledgeCrewAlert(id, req.orgId, req.user?.id, notes);
      res.json(alert);
    })
  );

  app.delete(
    "/api/crew-alerts/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete crew alert", async (req, res) => {
      const { id } = alertIdParamSchema.parse(req.params);
      await crewService.deleteCrewAlert(id, req.orgId);
      sendDeleted(res);
    })
  );
}
