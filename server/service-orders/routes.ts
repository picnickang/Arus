import { Router, Request, Response } from "express";
import { insertServiceOrderSchema, emailQueue, suppliers } from "@shared/schema";
import * as repo from "./repository";
import { SERVICE_ORDER_STATUS_TRANSITIONS, ServiceOrderStatus } from "./types";
import { generateSOEmailHtmlWithTemplate } from "./email-templates";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { canModifyRecord, SO_PERMISSION_GUARD } from "../lib/status-permission-guard";

const router = Router();

const sanitize = (obj: Record<string, unknown>) => {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = v === "" ? undefined : v;
  }
  return result;
};

router.get("/", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

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

router.get("/:id", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const order = await repo.getServiceOrderById(req.params.id, orgId);
  if (!order) {return res.status(404).json({ error: "Service order not found" });}
  res.json(order);
});

router.post("/", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const bodyWithOrg = sanitize({ ...req.body, orgId });
  const parsed = insertServiceOrderSchema.safeParse(bodyWithOrg);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const soNumber = await repo.generateSoNumber(orgId);
  const order = await repo.createServiceOrder({ ...parsed.data, soNumber });
  res.status(201).json(order);
});

router.patch("/:id", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {return res.status(404).json({ error: "Service order not found" });}

  if (userId) {
    const permCheck = await canModifyRecord(userId, orgId, existing.status, SO_PERMISSION_GUARD);
    if (!permCheck.allowed) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: permCheck.reason,
        code: "INSUFFICIENT_PERMISSIONS"
      });
    }
  }

  const data = sanitize(req.body);
  const updated = await repo.updateServiceOrder(req.params.id, orgId, data);
  res.json(updated);
});

router.post("/:id/send", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {return res.status(404).json({ error: "Service order not found" });}

  if (!SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("sent")) {
    return res.status(400).json({ error: `Cannot send order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(req.params.id, orgId, "sent", req.body.userId);
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

router.post("/:id/confirm", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {return res.status(404).json({ error: "Service order not found" });}

  if (!SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("confirmed")) {
    return res.status(400).json({ error: `Cannot confirm order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(req.params.id, orgId, "confirmed", req.body.userId);
  res.json(updated);
});

router.post("/:id/start", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {return res.status(404).json({ error: "Service order not found" });}

  if (!SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("in_progress")) {
    return res.status(400).json({ error: `Cannot start order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(req.params.id, orgId, "in_progress", req.body.userId);
  res.json(updated);
});

router.post("/:id/complete", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {return res.status(404).json({ error: "Service order not found" });}

  if (!SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("completed")) {
    return res.status(400).json({ error: `Cannot complete order in ${existing.status} status` });
  }

  const { actualAmount, actualDurationHours } = req.body;
  if (actualAmount !== undefined || actualDurationHours !== undefined) {
    await repo.updateServiceOrder(req.params.id, orgId, { actualAmount, actualDurationHours });
  }

  const updated = await repo.updateServiceOrderStatus(req.params.id, orgId, "completed", req.body.userId);
  res.json(updated);
});

router.post("/:id/cancel", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {return res.status(404).json({ error: "Service order not found" });}

  if (!SERVICE_ORDER_STATUS_TRANSITIONS[existing.status as ServiceOrderStatus].includes("cancelled")) {
    return res.status(400).json({ error: `Cannot cancel order in ${existing.status} status` });
  }

  const updated = await repo.updateServiceOrderStatus(
    req.params.id,
    orgId,
    "cancelled",
    req.body.userId,
    { reason: req.body.reason }
  );
  res.json(updated);
});

router.get("/:id/events", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const events = await repo.getServiceOrderEvents(req.params.id, orgId);
  res.json(events);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const existing = await repo.getServiceOrderById(req.params.id, orgId);
  if (!existing) {return res.status(404).json({ error: "Service order not found" });}

  if (userId) {
    const permCheck = await canModifyRecord(userId, orgId, existing.status, SO_PERMISSION_GUARD);
    if (!permCheck.allowed) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: permCheck.reason,
        code: "INSUFFICIENT_PERMISSIONS"
      });
    }
  }

  const result = await repo.deleteServiceOrder(req.params.id, orgId);
  if (!result.success) {
    const status = result.error === "Service order not found" ? 404 : 400;
    return res.status(status).json({ error: result.error });
  }

  res.json({ success: true });
});

router.delete("/bulk/by-work-order/:workOrderId", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string;
  if (!orgId) {return res.status(400).json({ error: "Missing x-org-id header" });}

  const result = await repo.deleteAllServiceOrdersByWorkOrder(req.params.workOrderId, orgId);
  res.json(result);
});

export default router;
