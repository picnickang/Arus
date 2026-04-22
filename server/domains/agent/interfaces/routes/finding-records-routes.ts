import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import type { AgentFindingService } from "../../application/finding-service";
import {
  FINDING_TYPES,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
} from "../../domain/finding-domain-types";
import type { AgentFindingFilter } from "../../domain/finding-domain-types";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface FindingRecordsRouteDeps {
  findingService: AgentFindingService;
  rateLimit: RateLimitMiddleware;
  requireMaintenanceRole: RoleMiddleware;
}

const findingCreateSchema = z.object({
  findingType: z.enum(["anomaly", "recommendation", "risk", "compliance_gap"]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  title: z.string().min(1).max(500),
  evidenceSummary: z.string().max(5000).optional().nullable(),
  recommendedAction: z.string().max(2000).optional().nullable(),
  taskId: z.string().optional().nullable(),
  equipmentId: z.string().optional().nullable(),
  vesselId: z.string().optional().nullable(),
  entityType: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
  conversationId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export function registerFindingRecordsRoutes(app: Express, deps: FindingRecordsRouteDeps) {
  const { findingService, rateLimit, requireMaintenanceRole } = deps;

  app.get(
    "/api/agent/finding-records",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const filter: AgentFindingFilter = {};
        const qFindingType = req.query.findingType as string | undefined;
        if (qFindingType && (FINDING_TYPES as readonly string[]).includes(qFindingType)) {
          filter.findingType = qFindingType as AgentFindingFilter["findingType"];
        }
        const qSeverity = req.query.severity as string | undefined;
        if (qSeverity && (FINDING_SEVERITIES as readonly string[]).includes(qSeverity)) {
          filter.severity = qSeverity as AgentFindingFilter["severity"];
        }
        const qFindingStatus = req.query.status as string | undefined;
        if (qFindingStatus && (FINDING_STATUSES as readonly string[]).includes(qFindingStatus)) {
          filter.status = qFindingStatus as AgentFindingFilter["status"];
        }
        if (req.query.taskId) {
          filter.taskId = req.query.taskId as string;
        }
        if (req.query.equipmentId) {
          filter.equipmentId = req.query.equipmentId as string;
        }
        filter.limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        filter.offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
        const findings = await findingService.list(orgId, filter);
        res.json(findings);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/finding-records",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const parsed = findingCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid finding data", details: parsed.error.flatten().fieldErrors });
        }
        const finding = await findingService.create({ ...parsed.data, orgId });
        res.status(201).json(finding);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/finding-records/:id",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const finding = await findingService.getById(req.params.id, orgId);
        if (!finding) {
          return res.status(404).json({ error: "Finding not found" });
        }
        res.json(finding);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.patch(
    "/api/agent/finding-records/:id",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { status, severity, recommendedAction } = req.body;
        const updateData: Record<string, unknown> = {};
        if (status && FINDING_STATUSES.includes(status)) {
          updateData.status = status;
        }
        if (severity && FINDING_SEVERITIES.includes(severity)) {
          updateData.severity = severity;
        }
        if (recommendedAction !== undefined) {
          updateData.recommendedAction = recommendedAction;
        }
        const finding = await findingService.update(req.params.id, orgId, updateData);
        res.json(finding);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        const statusCode = msg.includes("not found")
          ? 404
          : msg.includes("Cannot transition")
            ? 400
            : 500;
        res.status(statusCode).json({ error: msg });
      }
    }
  );
}
