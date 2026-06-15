import type { Request, Response, Router } from "express";
import { z } from "zod";
import { auditService } from "../immutable-audit.service";
import { requireAdminAuth, auditAdminAction } from "../../security";
import { dbGdprStorage } from "../../db/gdpr";
import { requireComplianceAccess } from "./audit-routes";
import { createLogger } from "../../lib/structured-logger";
import { authenticatedRequest } from "../../middleware/auth";

const logger = createLogger("Compliance:Routes:DataPrivacyRoutes");

const dsarRequestSchema = z.object({
  requesterEmail: z.string().email(),
  requesterName: z.string().optional(),
  requesterType: z.enum(["crew_member", "user", "external"]),
  requestType: z.enum(["access", "rectification", "erasure", "portability", "restrict_processing"]),
  requestDescription: z.string().optional(),
  dataCategories: z.array(z.string()).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});

const dsarFilterSchema = z.object({
  status: z.string().optional(),
  requestType: z.string().optional(),
  requesterEmail: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

function requestOrgId(req: Request): string | undefined {
  return authenticatedRequest(req).orgId;
}

function requestActorId(req: Request): string {
  const authReq = authenticatedRequest(req);
  return authReq.adminId || authReq.user?.id || "admin";
}

function getArrayLength(obj: Record<string, unknown>, key: string): number {
  const arr = obj[key];
  return Array.isArray(arr) ? arr.length : 0;
}

function hasData(obj: Record<string, unknown>, key: string): boolean {
  const val = obj[key];
  return Array.isArray(val)
    ? val.length > 0
    : typeof val === "object" && val !== null
      ? Object.keys(val).length > 0
      : false;
}

export function registerDataPrivacyDsarRoutes(router: Router): void {
  router.get(
    "/dsar",
    requireAdminAuth,
    auditAdminAction("dsar_list"),
    requireComplianceAccess,
    async (req: Request, res: Response) => {
      try {
        const orgId = requestOrgId(req);
        if (!orgId) {
          return res.status(401).json({ error: "Organization ID required" });
        }
        const filters = dsarFilterSchema.parse(req.query);
        const requests = await dbGdprStorage.getDataSubjectRequestsFiltered(orgId, {
          ...(filters.status !== undefined && { status: filters.status }),
          ...(filters.requestType !== undefined && { requestType: filters.requestType }),
          ...(filters.requesterEmail !== undefined && { requesterEmail: filters.requesterEmail }),
          ...(filters.fromDate !== undefined && { fromDate: new Date(filters.fromDate) }),
          ...(filters.toDate !== undefined && { toDate: new Date(filters.toDate) }),
        });
        await auditService.logEvent({
          orgId,
          eventCategory: "compliance_event",
          eventType: "dsar_list_viewed",
          entityType: "dsar",
          entityId: "list",
          performedBy: requestActorId(req),
          performedByType: "user",
          metadata: { filters, count: requests.length },
        });
        return res.json({ success: true, data: requests, count: requests.length });
      } catch (error) {
        logger.error("[Compliance] DSAR list error:", undefined, error);
        return res.status(500).json({ error: "Failed to retrieve DSAR requests" });
      }
    }
  );

  router.get(
    "/dsar/statistics",
    requireAdminAuth,
    requireComplianceAccess,
    async (req: Request, res: Response) => {
      try {
        const orgId = requestOrgId(req);
        if (!orgId) {
          return res.status(401).json({ error: "Organization ID required" });
        }
        const allRequests = await dbGdprStorage.getDataSubjectRequestsFiltered(orgId, {});
        const byStatus: Record<string, number> = Object.create(null);
        const byType: Record<string, number> = Object.create(null);
        const stats = {
          total: allRequests.length,
          byStatus,
          byType,
          avgCompletionDays: 0,
          overdueCount: 0,
        };
        let completedDays = 0,
          completedCount = 0;
        const now = new Date();
        for (const req of allRequests) {
          stats.byStatus[req.status] = (stats.byStatus[req.status] ?? 0) + 1;
          stats.byType[req.requestType] = (stats.byType[req.requestType] ?? 0) + 1;
          if (req.completedAt && req.createdAt) {
            completedDays +=
              (new Date(req.completedAt).getTime() - new Date(req.createdAt).getTime()) /
              (1000 * 60 * 60 * 24);
            completedCount++;
          }
          if (
            req.status !== "completed" &&
            req.status !== "rejected" &&
            req.dueDate &&
            new Date(req.dueDate) < now
          ) {
            stats.overdueCount++;
          }
        }
        stats.avgCompletionDays =
          completedCount > 0 ? Math.round((completedDays / completedCount) * 10) / 10 : 0;
        return res.json({ success: true, data: stats });
      } catch (error) {
        logger.error("[Compliance] DSAR statistics error:", undefined, error);
        return res.status(500).json({ error: "Failed to retrieve DSAR statistics" });
      }
    }
  );

  router.get(
    "/dsar/:id",
    requireAdminAuth,
    auditAdminAction("dsar_view"),
    requireComplianceAccess,
    async (req: Request, res: Response) => {
      try {
        const orgId = requestOrgId(req);
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({ error: "Missing id" });
        }
        if (!orgId) {
          return res.status(401).json({ error: "Organization ID required" });
        }
        const request = await dbGdprStorage.getDataSubjectRequestWithOrg(id, orgId);
        if (!request) {
          return res.status(404).json({ error: "DSAR request not found" });
        }
        return res.json({ success: true, data: request });
      } catch (error) {
        logger.error("[Compliance] DSAR get error:", undefined, error);
        return res.status(500).json({ error: "Failed to retrieve DSAR request" });
      }
    }
  );

  router.post(
    "/dsar",
    requireAdminAuth,
    auditAdminAction("dsar_create"),
    requireComplianceAccess,
    async (req: Request, res: Response) => {
      try {
        const orgId = requestOrgId(req);
        if (!orgId) {
          return res.status(401).json({ error: "Organization ID required" });
        }
        const data = dsarRequestSchema.parse(req.body);
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const request = await dbGdprStorage.createDataSubjectRequest({
          orgId,
          ...data,
          dueDate,
        });
        await auditService.logEvent({
          orgId,
          eventCategory: "compliance_event",
          eventType: "dsar_created",
          entityType: "dsar",
          entityId: request.id,
          newState: request,
          performedBy: requestActorId(req),
          performedByType: "user",
          retentionRequired: true,
        });
        return res.status(201).json({
          success: true,
          data: request,
          message: `DSAR request created. Due date: ${request.dueDate.toISOString()}`,
        });
      } catch (error) {
        logger.error("[Compliance] DSAR create error:", undefined, error);
        return res.status(500).json({ error: "Failed to create DSAR request" });
      }
    }
  );

  router.post(
    "/dsar/:id/acknowledge",
    requireAdminAuth,
    auditAdminAction("dsar_acknowledge"),
    requireComplianceAccess,
    async (req: Request, res: Response) => {
      try {
        const orgId = requestOrgId(req);
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({ error: "Missing id" });
        }
        if (!orgId) {
          return res.status(401).json({ error: "Organization ID required" });
        }
        const existingRequest = await dbGdprStorage.getDataSubjectRequestWithOrg(id, orgId);
        if (!existingRequest) {
          return res.status(404).json({ error: "DSAR request not found" });
        }
        if (existingRequest.status !== "pending") {
          return res.status(400).json({
            error: "Invalid state transition",
            message: `DSAR request is already ${existingRequest.status}. Only pending requests can be acknowledged.`,
          });
        }
        const request = await dbGdprStorage.acknowledgeDataSubjectRequest(
          id,
          requestActorId(req),
          orgId
        );
        await auditService.logEvent({
          orgId,
          eventCategory: "compliance_event",
          eventType: "dsar_acknowledged",
          entityType: "dsar",
          entityId: id,
          newState: { status: "in_progress", acknowledgedAt: request.acknowledgedAt },
          performedBy: requestActorId(req),
          performedByType: "user",
          retentionRequired: true,
        });
        return res.json({
          success: true,
          data: request,
          message: "DSAR request acknowledged and in progress",
        });
      } catch (error) {
        logger.error("[Compliance] DSAR acknowledge error:", undefined, error);
        return res.status(500).json({ error: "Failed to acknowledge DSAR request" });
      }
    }
  );

  router.post(
    "/dsar/:id/collect",
    requireAdminAuth,
    auditAdminAction("dsar_data_collection"),
    requireComplianceAccess,
    async (req: Request, res: Response) => {
      try {
        const orgId = requestOrgId(req);
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({ error: "Missing id" });
        }
        const { identifierType } = req.body as { identifierType: "email" | "userId" | "crewId" };
        if (!orgId) {
          return res.status(401).json({ error: "Organization ID required" });
        }
        const request = await dbGdprStorage.getDataSubjectRequestWithOrg(id, orgId);
        if (!request) {
          return res.status(404).json({ error: "DSAR request not found" });
        }
        const identifier = request.requesterId || request.requesterEmail;
        if (!identifier) {
          // Without a requester id/email the collection queries run against NULL
          // and silently return nothing — fail loudly instead of "succeeding"
          // with an empty export.
          return res.status(400).json({
            error: "DSAR request has no requesterId or requesterEmail to collect data for",
          });
        }
        const type = identifierType || (request.requesterId ? "userId" : "email");
        const collectedData = await dbGdprStorage.collectUserDataForDsar(orgId, identifier, type);
        const collectedDataObj = collectedData as Record<string, unknown>;
        await auditService.logEvent({
          orgId,
          eventCategory: "compliance_event",
          eventType: "dsar_data_collected",
          entityType: "dsar",
          entityId: id,
          performedBy: requestActorId(req),
          performedByType: "user",
          metadata: {
            identifier,
            identifierType: type,
            dataCategories: Object.keys(collectedDataObj).filter((k) =>
              hasData(collectedDataObj, k)
            ),
          },
          retentionRequired: true,
        });
        return res.json({
          success: true,
          data: {
            dsarId: id,
            identifier,
            identifierType: type,
            collectedData,
            summary: {
              users: getArrayLength(collectedDataObj, "users"),
              crewMembers: getArrayLength(collectedDataObj, "crewMembers"),
              restRecords: getArrayLength(collectedDataObj, "restRecords"),
              workOrders: getArrayLength(collectedDataObj, "workOrders"),
              auditEvents: getArrayLength(collectedDataObj, "auditEvents"),
            },
          },
        });
      } catch (error) {
        logger.error("[Compliance] DSAR data collection error:", undefined, error);
        return res.status(500).json({ error: "Failed to collect data for DSAR" });
      }
    }
  );

  router.post(
    "/dsar/:id/execute-erasure",
    requireAdminAuth,
    auditAdminAction("dsar_erasure"),
    requireComplianceAccess,
    async (req: Request, res: Response) => {
      try {
        const orgId = requestOrgId(req);
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({ error: "Missing id" });
        }
        const { confirmErasure, reason } = req.body;
        if (!orgId) {
          return res.status(401).json({ error: "Organization ID required" });
        }
        if (!confirmErasure) {
          return res.status(400).json({
            error: "Erasure must be explicitly confirmed",
            message: "Set confirmErasure: true to proceed with data erasure",
          });
        }
        const request = await dbGdprStorage.getDataSubjectRequestWithOrg(id, orgId);
        if (!request) {
          return res.status(404).json({ error: "DSAR request not found" });
        }
        if (request.requestType !== "erasure") {
          return res.status(400).json({
            error: "Invalid request type",
            message: "This endpoint is only for erasure requests",
          });
        }
        const erasedBy = requestActorId(req);
        const result = await dbGdprStorage.executeDataErasure(id, orgId, erasedBy, reason);
        await auditService.logEvent({
          orgId,
          eventCategory: "compliance_event",
          eventType: "dsar_erasure_executed",
          entityType: "dsar",
          entityId: id,
          performedBy: erasedBy,
          performedByType: "user",
          metadata: { result, reason },
          retentionRequired: true,
        });
        return res.json({ success: true, data: result });
      } catch (error) {
        logger.error("[Compliance] DSAR erasure error:", undefined, error);
        return res.status(500).json({ error: "Failed to execute data erasure" });
      }
    }
  );

  router.post(
    "/dsar/:id/complete",
    requireAdminAuth,
    auditAdminAction("dsar_complete"),
    requireComplianceAccess,
    async (req: Request, res: Response) => {
      try {
        const orgId = requestOrgId(req);
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({ error: "Missing id" });
        }
        const { notes } = req.body;
        if (!orgId) {
          return res.status(401).json({ error: "Organization ID required" });
        }
        const request = await dbGdprStorage.completeDataSubjectRequest(
          id,
          requestActorId(req),
          notes,
          orgId
        );
        await auditService.logEvent({
          orgId,
          eventCategory: "compliance_event",
          eventType: "dsar_completed",
          entityType: "dsar",
          entityId: id,
          newState: { status: "completed", completedAt: request.completedAt },
          performedBy: requestActorId(req),
          performedByType: "user",
          retentionRequired: true,
        });
        return res.json({ success: true, data: request, message: "DSAR request completed" });
      } catch (error) {
        logger.error("[Compliance] DSAR complete error:", undefined, error);
        return res.status(500).json({ error: "Failed to complete DSAR request" });
      }
    }
  );

  router.post(
    "/dsar/:id/reject",
    requireAdminAuth,
    auditAdminAction("dsar_reject"),
    requireComplianceAccess,
    async (req: Request, res: Response) => {
      try {
        const orgId = requestOrgId(req);
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({ error: "Missing id" });
        }
        const { reason, rejectionReason } = req.body;
        if (!orgId) {
          return res.status(401).json({ error: "Organization ID required" });
        }
        const request = await dbGdprStorage.rejectDataSubjectRequest(
          id,
          requestActorId(req),
          rejectionReason || reason,
          orgId
        );
        await auditService.logEvent({
          orgId,
          eventCategory: "compliance_event",
          eventType: "dsar_rejected",
          entityType: "dsar",
          entityId: id,
          newState: { status: "rejected", rejectionReason: rejectionReason || reason },
          performedBy: requestActorId(req),
          performedByType: "user",
          retentionRequired: true,
        });
        return res.json({ success: true, data: request, message: "DSAR request rejected" });
      } catch (error) {
        logger.error("[Compliance] DSAR reject error:", undefined, error);
        return res.status(500).json({ error: "Failed to reject DSAR request" });
      }
    }
  );
}
