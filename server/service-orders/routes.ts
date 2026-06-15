/**
 * Service Order Routes
 *
 * Improvements applied:
 * #3  — SO numbers now use a PostgreSQL sequence (see repository.ts).
 * #8  — PATCH /:id/revise-cost endpoint for mid-job cost revisions
 *        (change orders) without requiring a full status transition.
 * #20 — sanitize() now maps empty strings to null instead of undefined.
 *        Previously "" → undefined caused updates to be silently ignored,
 *        so clearing a field (e.g. special requirements) had no effect.
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("ServiceOrders:Routes");
import { Router, Request, Response } from "express";
import { authenticatedRequest } from "../middleware/auth";

/**
 * Derive orgId from the authenticated request (set by `requireOrgId` middleware,
 * which is mounted on this router in `domain-router-registry.ts`). Falls back to
 * DEFAULT_ORG_ID to keep behaviour identical during the project's current
 * single-tenant phase, but funnels every handler through one seam so the day
 * the system becomes multi-tenant, only this helper changes.
 */
function getOrgId(req: Request): string {
  const orgId = authenticatedRequest(req).orgId;
  if (!orgId) {
    throw new Error("Organization ID required");
  }
  return orgId;
}

/**
 * Derive the acting user's id from the authenticated session for audit
 * attribution on status transitions. Never trust a client-supplied
 * `req.body.userId` for this — the actor written to the service-order event
 * log must be the logged-in user, not a value the caller can set to anyone.
 */
function getActorUserId(req: Request): string | undefined {
  const authReq = authenticatedRequest(req);
  return authReq.user?.id ?? authReq.session?.userId;
}

/**
 * Express types req.params as `Record<string, string | undefined>` under
 * noUncheckedIndexedAccess, but the underlying route pattern guarantees the
 * matched segment is present. Funnel each path-param lookup through this
 * helper so the unreachable-undefined branch is collapsed in one place.
 */
function pathParam(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== "string" || v === "") {
    throw new Error(`Missing required path parameter: ${name}`);
  }
  return v;
}
import { insertServiceOrderSchema, emailQueue, suppliers } from "@shared/schema";
import * as repo from "./repository";
import { SERVICE_ORDER_STATUS_TRANSITIONS, type ServiceOrderStatus } from "./types";
import { generateSOEmailHtmlWithTemplate } from "./email-templates";
import { syncWorkOrderFromServiceOrders } from "../routes/wo-so-bridge-routes";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { canModifyRecord, SO_PERMISSION_GUARD } from "../lib/status-permission-guard";
import { z } from "zod";

const router = Router();

const FINALIZED_SO_STATUSES = ["completed", "invoiced"];
const serviceOrderStatusSchema = z.enum([
  "draft",
  "sent",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function headerString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function serviceOrderStatus(value: unknown): ServiceOrderStatus {
  return serviceOrderStatusSchema.parse(value);
}

async function triggerProcurementAggregation(
  workOrderId: string | null | undefined,
  orgId: string,
  previousStatus: string,
  newStatus: string
): Promise<void> {
  if (!workOrderId) {
    return;
  }
  const wasFinalized = FINALIZED_SO_STATUSES.includes(previousStatus);
  const isFinalized = FINALIZED_SO_STATUSES.includes(newStatus);
  if (!wasFinalized && !isFinalized) {
    return;
  }
  try {
    const { aggregateProcurementCostsToWorkOrder } = await import("../cost-savings-engine");
    await aggregateProcurementCostsToWorkOrder(workOrderId, orgId);
  } catch (err) {
    logger.error("[ServiceOrder] Failed to aggregate procurement costs:", undefined, err);
  }
}

/**
 * Improvement #20: maps empty strings to null (not undefined).
 * Previously empty strings became undefined, which Drizzle ORM treats as
 * "do not update this column", so clearing a text field had no effect.
 * null explicitly sets the column to NULL in the database.
 */
const sanitize = (obj: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") {
      continue;
    }
    result[k] = v === "" ? null : v;
  }
  return result;
};

// ── GET / ──────────────────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const filters = {
    status:
      req.query["status"] === undefined
        ? undefined
        : serviceOrderStatusSchema.parse(req.query["status"]),
    serviceProviderId: queryString(req.query["serviceProviderId"]),
    workOrderId: queryString(req.query["workOrderId"]),
    dateFrom: req.query["dateFrom"] ? new Date(String(req.query["dateFrom"])) : undefined,
    dateTo: req.query["dateTo"] ? new Date(String(req.query["dateTo"])) : undefined,
  };

  const orders = await repo.listServiceOrders(orgId, filters);
  return res.json(orders);
});

// ── GET /:id ───────────────────────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const order = await repo.getServiceOrderById(pathParam(req, "id"), orgId);
  if (!order) {
    return res.status(404).json({ error: "Service order not found" });
  }
  return res.json(order);
});

// ── POST / ─────────────────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const bodyWithOrg = sanitize({ ...req.body, orgId });
  // soNumber is generated server-side (see below) — omit from validation so
  // callers don't need to supply it.
  const parsed = insertServiceOrderSchema.omit({ soNumber: true }).safeParse(bodyWithOrg);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  // Improvement #3: sequence-based SO number from repository.
  // Generate the number and insert in the SAME transaction so the
  // pg_advisory_xact_lock inside generateSoNumber is held until commit —
  // otherwise two concurrent POSTs can read the same MAX and collide on
  // the (org_id, so_number) unique key.
  const order = await db.transaction(async (tx) => {
    const soNumber = await repo.generateSoNumber(orgId, tx as { execute: typeof db.execute });
    return repo.createServiceOrder(
      { ...parsed.data, soNumber },
      tx as { insert: typeof db.insert }
    );
  });
  return res.status(201).json(order);
});

// ── PATCH /:id ─────────────────────────────────────────────────────────────────
router.patch("/:id", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const userId = headerString(req.headers["x-user-id"]);

  const existing = await repo.getServiceOrderById(pathParam(req, "id"), orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (userId) {
    const permCheck = await canModifyRecord(userId, orgId, existing.status, SO_PERMISSION_GUARD);
    if (!permCheck.allowed) {
      return res
        .status(403)
        .json({ error: "Forbidden", message: permCheck.reason, code: "INSUFFICIENT_PERMISSIONS" });
    }
  }

  const data = sanitize(req.body);
  const updated = await repo.updateServiceOrder(pathParam(req, "id"), orgId, data);

  const newStatus = data["status"] ?? existing.status;
  if (
    existing.workOrderId &&
    ((data["actualAmount"] !== undefined && FINALIZED_SO_STATUSES.includes(existing.status)) ||
      (data["status"] !== undefined && data["status"] !== existing.status))
  ) {
    await triggerProcurementAggregation(
      existing.workOrderId,
      orgId,
      String(existing.status),
      String(newStatus)
    );
  }

  return res.json(updated);
});

// ── PATCH /:id/revise-cost — Improvement #8 ───────────────────────────────────
/**
 * Record a cost revision (change order) on an in-progress service order.
 * Allows cost to be updated mid-job without requiring a status transition.
 * The original quotedAmount is preserved; revisedAmount tracks the change.
 */
router.patch("/:id/revise-cost", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const userId = headerString(req.headers["x-user-id"]);

  const schema = z.object({
    revisedAmount: z.number().min(0, "Revised amount must be non-negative"),
    revisionNotes: z.string().min(1, "Revision notes are required for audit trail"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const existing = await repo.getServiceOrderById(pathParam(req, "id"), orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  const allowedStatuses: ServiceOrderStatus[] = ["sent", "confirmed", "in_progress"];
  const currentStatus = serviceOrderStatus(existing.status);
  if (!allowedStatuses.includes(currentStatus)) {
    return res.status(400).json({
      error: `Cannot revise cost on a ${existing.status} service order. Allowed: ${allowedStatuses.join(", ")}`,
    });
  }

  const updated = await repo.updateServiceOrder(pathParam(req, "id"), orgId, {
    revisedAmount: parsed.data.revisedAmount,
    revisionNotes: parsed.data.revisionNotes,
    revisedAt: new Date(),
  });

  // Record a cost_revised event for audit trail
  await repo.updateServiceOrderStatus(pathParam(req, "id"), orgId, currentStatus, userId, {
    eventOverride: "cost_revised",
    originalAmount: existing.quotedAmount,
    revisedAmount: parsed.data.revisedAmount,
    revisionNotes: parsed.data.revisionNotes,
  });

  return res.json(updated);
});

// ── POST /:id/send ─────────────────────────────────────────────────────────────
router.post("/:id/send", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const existing = await repo.getServiceOrderById(pathParam(req, "id"), orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (!SERVICE_ORDER_STATUS_TRANSITIONS[serviceOrderStatus(existing.status)].includes("sent")) {
    return res.status(400).json({ error: `Cannot send order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(
    pathParam(req, "id"),
    orgId,
    "sent",
    getActorUserId(req)
  );
  if (!updated) {
    return res.status(500).json({ error: "Failed to update service order status" });
  }

  let emailQueued = false;
  if (existing.serviceProviderId) {
    try {
      const [provider] = await db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, existing.serviceProviderId), eq(suppliers.orgId, orgId)));

      if (provider?.email) {
        const emailContent = await generateSOEmailHtmlWithTemplate(
          orgId,
          existing,
          provider,
          { woNumber: existing.workOrderNumber, description: existing.workOrderDescription },
          { name: existing.equipmentName },
          { name: existing.vesselName }
        );

        await db.insert(emailQueue).values({
          orgId,
          supplierId: existing.serviceProviderId,
          recipientEmail: provider.email,
          recipientName: provider.contactName || provider.name,
          subject: emailContent.subject,
          htmlContent: emailContent.body,
          status: "pending",
        });
        emailQueued = true;
      }
    } catch (err) {
      logger.error("[Service Orders] Failed to queue email:", undefined, err);
    }
  }

  return res.json({ ...updated, emailQueued });
});

// ── POST /:id/confirm ──────────────────────────────────────────────────────────
router.post("/:id/confirm", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const existing = await repo.getServiceOrderById(pathParam(req, "id"), orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (
    !SERVICE_ORDER_STATUS_TRANSITIONS[serviceOrderStatus(existing.status)].includes("confirmed")
  ) {
    return res.status(400).json({ error: `Cannot confirm order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(
    pathParam(req, "id"),
    orgId,
    "confirmed",
    getActorUserId(req)
  );
  return res.json(updated);
});

// ── POST /:id/start ────────────────────────────────────────────────────────────
router.post("/:id/start", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const existing = await repo.getServiceOrderById(pathParam(req, "id"), orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (
    !SERVICE_ORDER_STATUS_TRANSITIONS[serviceOrderStatus(existing.status)].includes("in_progress")
  ) {
    return res.status(400).json({ error: `Cannot start order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(
    pathParam(req, "id"),
    orgId,
    "in_progress",
    getActorUserId(req)
  );
  return res.json(updated);
});

// ── POST /:id/complete ─────────────────────────────────────────────────────────
router.post("/:id/complete", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const existing = await repo.getServiceOrderById(pathParam(req, "id"), orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (
    !SERVICE_ORDER_STATUS_TRANSITIONS[serviceOrderStatus(existing.status)].includes("completed")
  ) {
    return res.status(400).json({ error: `Cannot complete order in ${existing.status} status` });
  }

  const { actualAmount, actualDurationHours } = req.body;
  if (actualAmount !== undefined || actualDurationHours !== undefined) {
    await repo.updateServiceOrder(pathParam(req, "id"), orgId, {
      actualAmount,
      actualDurationHours,
    });
  }

  const updated = await repo.updateServiceOrderStatus(
    pathParam(req, "id"),
    orgId,
    "completed",
    getActorUserId(req)
  );
  await triggerProcurementAggregation(existing.workOrderId, orgId, existing.status, "completed");

  // Auto-sync the parent Work Order status when this completion makes all SOs done.
  if (existing.workOrderId) {
    try {
      await syncWorkOrderFromServiceOrders(db, orgId, existing.workOrderId);
    } catch (err) {
      logger.error(
        "[ServiceOrder] Failed to sync work order status after completion:",
        undefined,
        err
      );
    }
  }

  return res.json(updated);
});

// ── POST /:id/cancel ───────────────────────────────────────────────────────────
router.post("/:id/cancel", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const existing = await repo.getServiceOrderById(pathParam(req, "id"), orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (
    !SERVICE_ORDER_STATUS_TRANSITIONS[serviceOrderStatus(existing.status)].includes("cancelled")
  ) {
    return res.status(400).json({ error: `Cannot cancel order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(
    pathParam(req, "id"),
    orgId,
    "cancelled",
    getActorUserId(req),
    { reason: req.body.reason }
  );
  await triggerProcurementAggregation(existing.workOrderId, orgId, existing.status, "cancelled");
  return res.json(updated);
});

// ── GET /:id/events ────────────────────────────────────────────────────────────
router.get("/:id/events", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const events = await repo.getServiceOrderEvents(pathParam(req, "id"), orgId);
  return res.json(events);
});

// ── DELETE /:id ────────────────────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const userId = headerString(req.headers["x-user-id"]);

  const existing = await repo.getServiceOrderById(pathParam(req, "id"), orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (userId) {
    const permCheck = await canModifyRecord(userId, orgId, existing.status, SO_PERMISSION_GUARD);
    if (!permCheck.allowed) {
      return res
        .status(403)
        .json({ error: "Forbidden", message: permCheck.reason, code: "INSUFFICIENT_PERMISSIONS" });
    }
  }

  const result = await repo.deleteServiceOrder(pathParam(req, "id"), orgId);
  if (!result.success) {
    const status = result.error === "Service order not found" ? 404 : 400;
    return res.status(status).json({ error: result.error });
  }

  return res.json({ success: true });
});

// ── DELETE /bulk/by-work-order/:workOrderId ────────────────────────────────────
router.delete("/bulk/by-work-order/:workOrderId", async (req: Request, res: Response) => {
  const orgId = getOrgId(req);

  const result = await repo.deleteAllServiceOrdersByWorkOrder(pathParam(req, "workOrderId"), orgId);
  return res.json(result);
});

export default router;
