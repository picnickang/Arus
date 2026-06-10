/**
 * Maintenance checklist & work-order task routes.
 *
 * Closes a route-contract triage family (docs/qa/route-contract-triage.md):
 * the client has shipped checklist UI (LinkTemplateDialog, work-order Tasks
 * tab, maintenance-templates page) against these paths since their
 * introduction, and `dbChecklistsStorage` / `dbWorkOrderStorage` carry the
 * full persistence layer — but no routes were ever registered, so every
 * call fell through to Vite's SPA fallback.
 *
 * Kept beside the hexagonal maintenance routes as a thin repositories-barrel
 * adapter (the telemetry domain's pattern) rather than threading checklist
 * ports/events through the application layer — these are CRUD pass-throughs
 * with org scoping, not domain workflows.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  insertMaintenanceChecklistItemSchema,
  insertWorkOrderWorklogSchema,
} from "@shared/schema-runtime";
import { dbChecklistsStorage, dbWorkOrderStorage } from "../../../repositories";
import {
  authenticatedRequest,
  requireOrgId,
  requireOrgIdAndValidateBody,
} from "../../../middleware/auth";
import { withErrorHandling, sendNotFound, sendCreated } from "../../../lib/route-utils";

const idParamSchema = z.object({ id: z.string().min(1) });
const workOrderIdParamSchema = z.object({ workOrderId: z.string().min(1) });

const initializeChecklistBodySchema = z.object({
  templateId: z.string().min(1),
});

const completeItemBodySchema = z.object({
  itemId: z.string().min(1),
  completedBy: z.string().nullable(),
  completedByName: z.string().nullable(),
  passed: z.boolean().nullable(),
  notes: z.string().nullable().optional(),
});

export function registerChecklistRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: import("express").RequestHandler;
    criticalOperationRateLimit: import("express").RequestHandler;
    generalApiRateLimit: import("express").RequestHandler;
  }
) {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ===== Maintenance-template checklist items =====

  app.get(
    "/api/maintenance-templates/:id/items",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch template checklist items", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const template = await dbChecklistsStorage.getMaintenanceTemplate(id, orgId);
      if (!template) {
        return sendNotFound(res, "Maintenance template");
      }
      const items = await dbChecklistsStorage.getMaintenanceChecklistItems(id);
      return res.json(items);
    })
  );

  app.post(
    "/api/maintenance-templates/:id/items",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create template checklist item", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const template = await dbChecklistsStorage.getMaintenanceTemplate(id, orgId);
      if (!template) {
        return sendNotFound(res, "Maintenance template");
      }
      const itemData = insertMaintenanceChecklistItemSchema.parse({
        ...req.body,
        templateId: id,
        orgId,
      });
      const item = await dbChecklistsStorage.createMaintenanceChecklistItem(itemData);
      return sendCreated(res, item);
    })
  );

  app.post(
    "/api/maintenance-templates/:id/clone",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("clone maintenance template", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const template = await dbChecklistsStorage.getMaintenanceTemplate(id, orgId);
      if (!template) {
        return sendNotFound(res, "Maintenance template");
      }
      const clone = await dbChecklistsStorage.cloneMaintenanceTemplate(
        id,
        `${template.name} (Copy)`,
        orgId
      );
      return sendCreated(res, clone);
    })
  );

  // ===== Work-order checklist (template-driven) =====

  // The Tasks tab contract: completions joined with their template item
  // metadata plus a progress rollup. Total counts template items when the
  // work order has a linked template; otherwise whatever completions exist.
  app.get(
    "/api/maintenance-checklist/:workOrderId",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch work-order checklist", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { workOrderId } = workOrderIdParamSchema.parse(req.params);
      const workOrder = await dbWorkOrderStorage.getWorkOrder(orgId, workOrderId);
      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }

      const completions = await dbChecklistsStorage.getChecklistCompletions(workOrderId, orgId);
      const templateItems = workOrder.maintenanceTemplateId
        ? await dbChecklistsStorage.getMaintenanceChecklistItems(workOrder.maintenanceTemplateId)
        : [];

      const completedItems = completions.filter((c) => c.completedBy != null).length;
      const failedItems = completions.filter((c) => c.passed === false).length;
      const skippedItems = completions.filter((c) => c.status === "skipped").length;
      const totalItems = Math.max(templateItems.length, completions.length);

      return res.json({
        completions,
        progress: {
          totalItems,
          completedItems,
          pendingItems: Math.max(0, totalItems - completedItems),
          skippedItems,
          failedItems,
          percentComplete: totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100),
        },
      });
    })
  );

  // Upsert one item's completion state. `completedBy: null` is the client's
  // reset — the row reverts to pending rather than being deleted, preserving
  // notes history semantics chosen by the Tasks tab.
  app.post(
    "/api/maintenance-checklist/:workOrderId/complete",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("complete checklist item", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { workOrderId } = workOrderIdParamSchema.parse(req.params);
      const body = completeItemBodySchema.parse(req.body);

      const workOrder = await dbWorkOrderStorage.getWorkOrder(orgId, workOrderId);
      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }

      const isCompletion = body.completedBy != null;
      const fields = {
        completedBy: body.completedBy,
        completedByName: body.completedByName,
        passed: body.passed,
        notes: body.notes ?? null,
        completedAt: isCompletion ? new Date() : null,
        status: !isCompletion ? "pending" : body.passed === false ? "failed" : "completed",
      };

      const existing = (await dbChecklistsStorage.getChecklistCompletions(workOrderId, orgId)).find(
        (c) => c.itemId === body.itemId
      );
      const completion = existing
        ? await dbChecklistsStorage.updateChecklistCompletion(existing.id, fields)
        : await dbChecklistsStorage.createChecklistCompletion({
            orgId,
            workOrderId,
            itemId: body.itemId,
            ...fields,
          });

      return res.json(completion);
    })
  );

  app.post(
    "/api/work-orders/:id/initialize-checklist",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("initialize work-order checklist", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const { templateId } = initializeChecklistBodySchema.parse(req.body);

      const workOrder = await dbWorkOrderStorage.getWorkOrder(orgId, id);
      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }
      const template = await dbChecklistsStorage.getMaintenanceTemplate(templateId, orgId);
      if (!template) {
        return sendNotFound(res, "Maintenance template");
      }

      const updated = await dbWorkOrderStorage.updateWorkOrder(id, {
        maintenanceTemplateId: templateId,
      });
      return res.json({ success: true, workOrder: updated });
    })
  );

  // ===== Work-order ad-hoc checklists & worklogs =====

  app.get(
    "/api/work-orders/:id/checklists",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch work-order checklists", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const workOrder = await dbWorkOrderStorage.getWorkOrder(orgId, id);
      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }
      return res.json(await dbWorkOrderStorage.getWorkOrderChecklists(id));
    })
  );

  app.get(
    "/api/work-orders/:id/worklogs",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch work-order worklogs", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const workOrder = await dbWorkOrderStorage.getWorkOrder(orgId, id);
      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }
      return res.json(await dbWorkOrderStorage.getWorkOrderWorklogs(id));
    })
  );

  app.post(
    "/api/work-orders/:id/worklogs",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create work-order worklog", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const workOrder = await dbWorkOrderStorage.getWorkOrder(orgId, id);
      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }
      const worklog = insertWorkOrderWorklogSchema.parse({
        ...req.body,
        workOrderId: id,
        orgId,
      });
      return sendCreated(res, await dbWorkOrderStorage.addWorkOrderWorklog(worklog));
    })
  );
}
