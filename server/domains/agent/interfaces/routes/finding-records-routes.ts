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

const listQuerySchema = z.object({
  findingType: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  taskId: z.string().optional(),
  equipmentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

const updateSchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  recommendedAction: z.string().nullable().optional(),
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
        const q = listQuerySchema.parse(req.query);
        const filter: AgentFindingFilter = {};
        if (q.findingType && (FINDING_TYPES as readonly string[]).includes(q.findingType)) {
          filter.findingType = q.findingType as AgentFindingFilter["findingType"];
        }
        if (q.severity && (FINDING_SEVERITIES as readonly string[]).includes(q.severity)) {
          filter.severity = q.severity as AgentFindingFilter["severity"];
        }
        if (q.status && (FINDING_STATUSES as readonly string[]).includes(q.status)) {
          filter.status = q.status as AgentFindingFilter["status"];
        }
        if (q.taskId) filter.taskId = q.taskId;
        if (q.equipmentId) filter.equipmentId = q.equipmentId;
        filter.limit = Math.min(q.limit ?? 50, 200);
        filter.offset = Math.max(q.offset ?? 0, 0);
        const findings = await findingService.list(orgId, filter);
        return res.json(findings);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        return res.status(201).json(finding);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const { id } = idParamSchema.parse(req.params);
        const finding = await findingService.getById(id, orgId);
        if (!finding) {
          return res.status(404).json({ error: "Finding not found" });
        }
        return res.json(finding);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const { id } = idParamSchema.parse(req.params);
        const { status, severity, recommendedAction } = updateSchema.parse(req.body);
        const updateData: Record<string, unknown> = {};
        if (status && (FINDING_STATUSES as readonly string[]).includes(status)) {
          updateData['status'] = status;
        }
        if (severity && (FINDING_SEVERITIES as readonly string[]).includes(severity)) {
          updateData['severity'] = severity;
        }
        if (recommendedAction !== undefined) {
          updateData['recommendedAction'] = recommendedAction;
        }
        const finding = await findingService.update(id, orgId, updateData);
        return res.json(finding);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        const statusCode = msg.includes("not found")
          ? 404
          : msg.includes("Cannot transition")
            ? 400
            : 500;
        return res.status(statusCode).json({ error: msg });
      }
    }
  );
}
