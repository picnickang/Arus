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

import { Router, Request, Response } from "express";
import { insertServiceOrderSchema, emailQueue, suppliers } from "@shared/schema";
import * as repo from "./repository";
import { SERVICE_ORDER_STATUS_TRANSITIONS, ServiceOrderStatus } from "./types";
import { generateSOEmailHtmlWithTemplate } from "./email-templates";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { canModifyRecord, SO_PERMISSION_GUARD } from "../lib/status-permission-guard";
import { z } from "zod";

const router = Router();

const FINALIZED_SO_STATUSES = ["completed", "invoiced"];

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
    console.error("[ServiceOrder] Failed to aggregate procurement costs:", err);
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
    result[k] = v === "" ? null : v;
  }
  return result;
};

// ── GET / ──────────────────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const filters = {
    status: req.query.status as ServiceOrderStatus | undefined,
    serviceProviderId: req.query.serviceProviderId as string | undefined,
    workOrderId: req.query.workOrderId as string | undefined,
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
  };

  const orders = await repo.listServiceOrders(orgId, filters);
  res.json(orders);
});

// ── GET /:id ───────────────────────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const order = await repo.getServiceOrderById(req.params.id, orgId);
  if (!order) {
    return res.status(404).json({ error: "Service order not found" });
  }
  res.json(order);
});

// ── POST / ─────────────────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const bodyWithOrg = sanitize({ ...req.body, orgId });
  const parsed = insertServiceOrderSchema.safeParse(bodyWithOrg);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  // Improvement #3: sequence-based SO number from repository
  const soNumber = await repo.generateSoNumber(orgId);
  const order = await repo.createServiceOrder({ ...parsed.data, soNumber });
  res.status(201).json(order);
});

// ── PATCH /:id ─────────────────────────────────────────────────────────────────
router.patch("/:id", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
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
  const updated = await repo.updateServiceOrder(req.params.id, orgId, data);

  const newStatus = data.status ?? existing.status;
  if (
    existing.workOrderId &&
    ((data.actualAmount !== undefined && FINALIZED_SO_STATUSES.includes(existing.status)) ||
      (data.status !== undefined && data.status !== existing.status))
  ) {
    await triggerProcurementAggregation(existing.workOrderId, orgId, existing.status, newStatus);
  }

  res.json(updated);
});

// ── PATCH /:id/revise-cost — Improvement #8 ───────────────────────────────────
/**
 * Record a cost revision (change order) on an in-progress service order.
 * Allows cost to be updated mid-job without requiring a status transition.
 * The original quotedAmount is preserved; revisedAmount tracks the change.
 */
router.patch("/:id/revise-cost", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const schema = z.object({
    revisedAmount: z.number().min(0, "Revised amount must be non-negative"),
    revisionNotes: z.string().min(1, "Revision notes are required for audit trail"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  const allowedStatuses: ServiceOrderStatus[] = ["sent", "confirmed", "in_progress"];
  if (!allowedStatuses.includes(existing.status as ServiceOrderStatus)) {
    return res.status(400).json({
      error: `Cannot revise cost on a ${existing.status} service order. Allowed: ${allowedStatuses.join(", ")}`,
    });
  }

  const updated = await repo.updateServiceOrder(req.params.id, orgId, {
    revisedAmount: parsed.data.revisedAmount,
    revisionNotes: parsed.data.revisionNotes,
    revisedAt: new Date(),
  });

  // Record a cost_revised event for audit trail
  await repo.updateServiceOrderStatus(
    req.params.id,
    orgId,
    existing.status as ServiceOrderStatus,
    userId,
    {
      eventOverride: "cost_revised",
      originalAmount: existing.quotedAmount,
      revisedAmount: parsed.data.revisedAmount,
      revisionNotes: parsed.data.revisionNotes,
    }
  );

  res.json(updated);
});

// ── POST /:id/send ─────────────────────────────────────────────────────────────
router.post("/:id/send", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (!SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("sent")) {
    return res.status(400).json({ error: `Cannot send order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(
    req.params.id,
    orgId,
    "sent",
    req.body.userId
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
      console.error("[Service Orders] Failed to queue email:", err);
    }
  }

  res.json({ ...updated, emailQueued });
});

// ── POST /:id/confirm ──────────────────────────────────────────────────────────
router.post("/:id/confirm", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (
    !SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("confirmed")
  ) {
    return res.status(400).json({ error: `Cannot confirm order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(
    req.params.id,
    orgId,
    "confirmed",
    req.body.userId
  );
  res.json(updated);
});

// ── POST /:id/start ────────────────────────────────────────────────────────────
router.post("/:id/start", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (
    !SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("in_progress")
  ) {
    return res.status(400).json({ error: `Cannot start order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(
    req.params.id,
    orgId,
    "in_progress",
    req.body.userId
  );
  res.json(updated);
});

// ── POST /:id/complete ─────────────────────────────────────────────────────────
router.post("/:id/complete", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (
    !SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("completed")
  ) {
    return res.status(400).json({ error: `Cannot complete order in ${existing.status} status` });
  }

  const { actualAmount, actualDurationHours } = req.body;
  if (actualAmount !== undefined || actualDurationHours !== undefined) {
    await repo.updateServiceOrder(req.params.id, orgId, { actualAmount, actualDurationHours });
  }

  const updated = await repo.updateServiceOrderStatus(
    req.params.id,
    orgId,
    "completed",
    req.body.userId
  );
  await triggerProcurementAggregation(existing.workOrderId, orgId, existing.status, "completed");
  res.json(updated);
});

// ── POST /:id/cancel ───────────────────────────────────────────────────────────
router.post("/:id/cancel", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {
    return res.status(404).json({ error: "Service order not found" });
  }

  if (
    !SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("cancelled")
  ) {
    return res.status(400).json({ error: `Cannot cancel order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(
    req.params.id,
    orgId,
    "cancelled",
    req.body.userId,
    { reason: req.body.reason }
  );
  await triggerProcurementAggregation(existing.workOrderId, orgId, existing.status, "cancelled");
  res.json(updated);
});

// ── GET /:id/events ────────────────────────────────────────────────────────────
router.get("/:id/events", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const events = await repo.getServiceOrderEvents(req.params.id, orgId);
  res.json(events);
});

// ── DELETE /:id ────────────────────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
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

  const result = await repo.deleteServiceOrder(req.params.id, orgId);
  if (!result.success) {
    const status = result.error === "Service order not found" ? 404 : 400;
    return res.status(status).json({ error: result.error });
  }

  res.json({ success: true });
});

// ── DELETE /bulk/by-work-order/:workOrderId ────────────────────────────────────
router.delete("/bulk/by-work-order/:workOrderId", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {
    return res.status(400).json({ error: "Missing x-org-id header" });
  }

  const result = await repo.deleteAllServiceOrdersByWorkOrder(req.params.workOrderId, orgId);
  res.json(result);
});

export default router;
