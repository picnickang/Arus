import { db } from "../db";
import {
  serviceOrders,
  serviceOrderEvents,
  serviceRequests,
  workOrders,
  suppliers,
  vessels,
  equipment,
} from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { unwrapRows, type ServiceRequestRow } from "../routes/service-request-route-utils";
import {
  ServiceOrder,
  InsertServiceOrder,
  ServiceOrderWithDetails,
  ServiceOrderListFilters,
  ServiceOrderStatus,
} from "./types";

export async function generateSoNumber(
  orgId: string,
  executor: { execute: typeof db.execute } = db
): Promise<string> {
  const lockKey = Buffer.from(`so_num:${orgId}`).reduce((a, b) => (a * 31 + b) & 0x7fffffff, 0);
  const result = await executor.execute(
    sql`SELECT pg_advisory_xact_lock(${lockKey}),
        COALESCE(MAX(CAST(SUBSTRING(so_number FROM 4) AS INTEGER)), 0) + 1 AS next_val
        FROM service_orders WHERE org_id = ${orgId} AND so_number ~ '^SO-[0-9]+$'`
  );
  const nextNum = Number(
    (result as object as { rows?: Array<{ next_val: string }> }).rows?.[0]?.next_val ?? 1
  );
  return `SO-${String(nextNum).padStart(4, "0")}`;
}

export async function createServiceOrder(
  data: InsertServiceOrder & { soNumber: string },
  executor: { insert: typeof db.insert } = db
): Promise<ServiceOrder> {
  const [so] = await executor.insert(serviceOrders).values(data).returning();
  if (!so) {
    throw new Error("createServiceOrder: no row returned");
  }
  await executor.insert(serviceOrderEvents).values({
    orgId: data.orgId,
    soId: so.id,
    eventType: "created",
    details: { status: "draft" },
  });
  return so;
}

export async function getServiceOrderById(
  id: string,
  orgId: string
): Promise<ServiceOrderWithDetails | null> {
  const result = await db
    .select({
      so: serviceOrders,
      workOrderNumber: workOrders.woNumber,
      workOrderDescription: workOrders.description,
      serviceProviderName: suppliers.name,
      serviceProviderEmail: suppliers.email,
      vesselName: vessels.name,
      equipmentName: equipment.name,
      originatingRequestId: serviceRequests.id,
      originatingRequestNumber: serviceRequests.requestNumber,
      originatingRequestStatus: serviceRequests.status,
    })
    .from(serviceOrders)
    .leftJoin(workOrders, eq(serviceOrders.workOrderId, workOrders.id))
    .leftJoin(suppliers, eq(serviceOrders.serviceProviderId, suppliers.id))
    .leftJoin(vessels, eq(workOrders.vesselId, vessels.id))
    .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
    .leftJoin(
      serviceRequests,
      and(eq(serviceRequests.serviceOrderId, serviceOrders.id), eq(serviceRequests.orgId, orgId))
    )
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.orgId, orgId)))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }
  return {
    ...row.so,
    workOrderNumber: row.workOrderNumber ?? undefined,
    workOrderDescription: row.workOrderDescription ?? undefined,
    serviceProviderName: row.serviceProviderName ?? undefined,
    serviceProviderEmail: row.serviceProviderEmail ?? undefined,
    vesselName: row.vesselName ?? undefined,
    equipmentName: row.equipmentName ?? undefined,
    originatingRequestId: row.originatingRequestId ?? undefined,
    originatingRequestNumber: row.originatingRequestNumber ?? undefined,
    originatingRequestStatus: row.originatingRequestStatus ?? undefined,
  };
}

export async function listServiceOrders(
  orgId: string,
  filters: ServiceOrderListFilters = {}
): Promise<ServiceOrderWithDetails[]> {
  const conditions = [eq(serviceOrders.orgId, orgId)];

  if (filters.status) {
    conditions.push(eq(serviceOrders.status, filters.status));
  }
  if (filters.serviceProviderId) {
    conditions.push(eq(serviceOrders.serviceProviderId, filters.serviceProviderId));
  }
  if (filters.workOrderId) {
    conditions.push(eq(serviceOrders.workOrderId, filters.workOrderId));
  }
  if (filters.dateFrom) {
    conditions.push(gte(serviceOrders.scheduledStartDate, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(serviceOrders.scheduledEndDate, filters.dateTo));
  }

  const rows = await db
    .select({
      so: serviceOrders,
      workOrderNumber: workOrders.woNumber,
      workOrderDescription: workOrders.description,
      serviceProviderName: suppliers.name,
      serviceProviderEmail: suppliers.email,
      vesselName: vessels.name,
      equipmentName: equipment.name,
      originatingRequestId: serviceRequests.id,
      originatingRequestNumber: serviceRequests.requestNumber,
      originatingRequestStatus: serviceRequests.status,
    })
    .from(serviceOrders)
    .leftJoin(workOrders, eq(serviceOrders.workOrderId, workOrders.id))
    .leftJoin(suppliers, eq(serviceOrders.serviceProviderId, suppliers.id))
    .leftJoin(vessels, eq(workOrders.vesselId, vessels.id))
    .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
    .leftJoin(
      serviceRequests,
      and(eq(serviceRequests.serviceOrderId, serviceOrders.id), eq(serviceRequests.orgId, orgId))
    )
    .where(and(...conditions))
    .orderBy(sql`${serviceOrders.createdAt} DESC`);

  return rows.map((row) => ({
    ...row.so,
    workOrderNumber: row.workOrderNumber ?? undefined,
    workOrderDescription: row.workOrderDescription ?? undefined,
    serviceProviderName: row.serviceProviderName ?? undefined,
    serviceProviderEmail: row.serviceProviderEmail ?? undefined,
    vesselName: row.vesselName ?? undefined,
    equipmentName: row.equipmentName ?? undefined,
    originatingRequestId: row.originatingRequestId ?? undefined,
    originatingRequestNumber: row.originatingRequestNumber ?? undefined,
    originatingRequestStatus: row.originatingRequestStatus ?? undefined,
  }));
}

export async function updateServiceOrder(
  id: string,
  orgId: string,
  data: Partial<InsertServiceOrder>
): Promise<ServiceOrder | null> {
  const [updated] = await db
    .update(serviceOrders)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.orgId, orgId)))
    .returning();
  return updated || null;
}

export async function updateServiceOrderStatus(
  id: string,
  orgId: string,
  status: ServiceOrderStatus,
  userId?: string,
  details?: Record<string, unknown>
): Promise<ServiceOrder | null> {
  const now = new Date();
  const updates: Partial<ServiceOrder> = { status, updatedAt: now };

  if (status === "sent") {
    updates.sentAt = now;
  } else if (status === "confirmed") {
    updates.confirmedAt = now;
  } else if (status === "in_progress") {
    updates.actualStartDate = now;
  } else if (status === "completed") {
    updates.completedAt = now;
    updates.actualEndDate = now;
  } else if (status === "cancelled") {
    updates.cancelledAt = now;
    if (details?.["reason"]) {
      updates.cancellationReason = details["reason"] as string;
    }
  }

  const [updated] = await db
    .update(serviceOrders)
    .set(updates)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.orgId, orgId)))
    .returning();

  if (updated) {
    const eventType = status === "in_progress" ? "started" : status;
    await db.insert(serviceOrderEvents).values({
      orgId,
      soId: id,
      eventType,
      userId,
      details: details ?? { status },
    });
  }

  return updated || null;
}

export async function getServiceOrderEvents(soId: string, orgId: string) {
  return db
    .select()
    .from(serviceOrderEvents)
    .where(and(eq(serviceOrderEvents.soId, soId), eq(serviceOrderEvents.orgId, orgId)))
    .orderBy(sql`${serviceOrderEvents.createdAt} DESC`);
}

export async function deleteServiceOrder(
  id: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const existing = await getServiceOrderById(id, orgId);
  if (!existing) {
    return { success: false, error: "Service order not found" };
  }

  const status = existing.status;
  if (status !== "draft" && status !== "cancelled") {
    return { success: false, error: "Only draft or cancelled service orders can be deleted" };
  }

  await db
    .delete(serviceOrderEvents)
    .where(and(eq(serviceOrderEvents.soId, id), eq(serviceOrderEvents.orgId, orgId)));
  await db
    .delete(serviceOrders)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.orgId, orgId)));

  return { success: true };
}

export async function deleteAllServiceOrdersByWorkOrder(
  workOrderId: string,
  orgId: string
): Promise<{ success: boolean; deletedCount: number; skippedCount: number; errors: string[] }> {
  const orders = await listServiceOrders(orgId, { workOrderId });
  let deletedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const order of orders) {
    const result = await deleteServiceOrder(order.id, orgId);
    if (result.success) {
      deletedCount++;
    } else {
      skippedCount++;
      if (result.error) {
        errors.push(`${order.soNumber}: ${result.error}`);
      }
    }
  }

  return { success: true, deletedCount, skippedCount, errors };
}

// ---------------------------------------------------------------------------
// Service-request reads. Extracted from service-request-read-routes.ts so the
// route layer no longer holds the raw db handle (check:hex-storage). Raw SQL
// is preserved verbatim.
// ---------------------------------------------------------------------------
export async function listServiceRequestsForOrg(
  orgId: string,
  opts: { status?: string | undefined; workOrderId?: string | undefined; sortBy?: string | undefined }
): Promise<Record<string, unknown>[]> {
  let query = sql`
        SELECT
          sr.id,
          sr.request_number AS "requestNumber",
          sr.title,
          sr.description,
          sr.urgency,
          sr.estimated_cost::float8 AS "estimatedCost",
          sr.requested_by AS "requestedBy",
          sr.status,
          sr.rejection_reason AS "rejectionReason",
          sr.reviewed_by AS "reviewedBy",
          sr.reviewed_at AS "reviewedAt",
          sr.converted_at AS "convertedAt",
          sr.work_order_id AS "workOrderId",
          sr.service_order_id AS "serviceOrderId",
          sr.previous_wo_status AS "previousWoStatus",
          wo.wo_number AS "workOrderNumber",
          wo.description AS "workOrderDescription",
          e.name AS "equipmentName",
          v.name AS "vesselName",
          so.so_number AS "serviceOrderNumber",
          so.status AS "serviceOrderStatus",
          sr.created_at AS "createdAt",
          sr.updated_at AS "updatedAt"
        FROM service_requests sr
        LEFT JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
        LEFT JOIN equipment e ON e.id = wo.equipment_id
        LEFT JOIN vessels v ON v.id = wo.vessel_id
        LEFT JOIN service_orders so ON so.id = sr.service_order_id AND so.org_id = ${orgId}
        WHERE sr.org_id = ${orgId}
      `;

  if (opts.status === "actionable") {
    query = sql`${query} AND sr.status IN ('pending_review', 'under_review', 'approved')`;
  } else if (opts.status) {
    query = sql`${query} AND sr.status = ${opts.status}`;
  }
  if (opts.workOrderId) {
    query = sql`${query} AND sr.work_order_id = ${opts.workOrderId}`;
  }

  if (opts.sortBy === "vessel") {
    query = sql`${query} ORDER BY v.name ASC NULLS LAST, sr.created_at DESC`;
  } else if (opts.sortBy === "urgency") {
    query = sql`${query} ORDER BY
          CASE sr.urgency
            WHEN 'critical' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            ELSE 4
          END ASC,
          sr.created_at DESC`;
  } else {
    query = sql`${query} ORDER BY sr.created_at DESC`;
  }

  const rows = await db.execute(query);
  return unwrapRows(rows);
}

export async function getServiceRequestWithDetails(
  id: string,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [row] = await db
    .execute(
      sql`
        SELECT
          sr.*,
          wo.wo_number AS "workOrderNumber",
          wo.description AS "workOrderDescription",
          e.name AS "equipmentName",
          v.name AS "vesselName"
        FROM service_requests sr
        LEFT JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
        LEFT JOIN equipment e ON e.id = wo.equipment_id
        LEFT JOIN vessels v ON v.id = wo.vessel_id
        WHERE sr.id = ${id} AND sr.org_id = ${orgId}
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return row;
}

export async function listServiceRequestsForWorkOrder(
  workOrderId: string,
  orgId: string
): Promise<Record<string, unknown>[]> {
  const rows = await db.execute(sql`
        SELECT
          sr.id,
          sr.request_number AS "requestNumber",
          sr.title,
          sr.description,
          sr.urgency,
          sr.estimated_cost::float8 AS "estimatedCost",
          sr.requested_by AS "requestedBy",
          sr.status,
          sr.rejection_reason AS "rejectionReason",
          sr.service_order_id AS "serviceOrderId",
          sr.reviewed_by AS "reviewedBy",
          sr.reviewed_at AS "reviewedAt",
          sr.converted_at AS "convertedAt",
          sr.previous_wo_status AS "previousWoStatus",
          sr.created_at AS "createdAt",
          sr.updated_at AS "updatedAt"
        FROM service_requests sr
        WHERE sr.work_order_id = ${workOrderId}
          AND sr.org_id = ${orgId}
        ORDER BY sr.created_at DESC
      `);
  return unwrapRows(rows);
}

// ---------------------------------------------------------------------------
// Service-request writes. Extracted from service-request-edit-routes.ts so the
// route layer no longer holds the raw db handle. Raw SQL preserved verbatim;
// retry/event business logic stays in the route.
// ---------------------------------------------------------------------------
export async function getServiceRequestStatusRow(
  id: string,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [sr] = await db
    .execute(
      sql`
        SELECT id, status FROM service_requests
        WHERE id = ${id} AND org_id = ${orgId}
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return sr;
}

export async function updateServiceRequestFields(
  id: string,
  orgId: string,
  userId: string | undefined,
  updates: Record<string, string | number | null>
): Promise<ServiceRequestRow | undefined> {
  const [updated] = await db
    .execute(
      sql`
        UPDATE service_requests
        SET
          title = ${updates["title"] !== undefined ? updates["title"] : sql`title`},
          description = ${updates["description"] !== undefined ? updates["description"] : sql`description`},
          urgency = ${updates["urgency"] !== undefined ? updates["urgency"] : sql`urgency`},
          estimated_cost = ${updates["estimated_cost"] !== undefined ? updates["estimated_cost"] : sql`estimated_cost`},
          service_details = ${updates["service_details"] !== undefined ? updates["service_details"] : sql`service_details`},
          special_requirements = ${updates["special_requirements"] !== undefined ? updates["special_requirements"] : sql`special_requirements`},
          reviewed_by = COALESCE(reviewed_by, ${userId}),
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return updated;
}

export async function getWorkOrderForServiceRequest(
  workOrderId: string,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [wo] = await db
    .execute(
      sql`
        SELECT id, wo_number, description, vessel_id, status
        FROM work_orders
        WHERE id = ${workOrderId} AND org_id = ${orgId}
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return wo;
}

export async function getActiveServiceRequestForWorkOrder(
  workOrderId: string,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [existingActive] = await db
    .execute(
      sql`
        SELECT id, request_number, status
        FROM service_requests
        WHERE work_order_id = ${workOrderId} AND org_id = ${orgId}
          AND status NOT IN ('rejected', 'converted')
        LIMIT 1
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return existingActive;
}

export async function generateServiceRequestNumber(orgId: string): Promise<string> {
  const [seqResult] = await db
    .execute(
      sql`
        SELECT COALESCE(
          MAX(CAST(SUBSTRING(request_number FROM 'SR-([0-9]+)') AS INTEGER)),
          0
        ) + 1 AS next_num
        FROM service_requests
        WHERE org_id = ${orgId}
      `
    )
    .then(unwrapRows<{ next_num: number | string | null }>);
  return `SR-${String(seqResult?.next_num || 1).padStart(4, "0")}`;
}

export interface InsertServiceRequestParams {
  serviceRequestId: string;
  orgId: string;
  workOrderId: string;
  requestNumber: string;
  title: string;
  description: string | null;
  urgency: string;
  estimatedCost: number | null;
  serviceDetails: string | null;
  specialRequirements: string | null;
  requestedBy: string | undefined;
  previousWoStatus: string;
}

export async function insertServiceRequestRow(
  p: InsertServiceRequestParams
): Promise<ServiceRequestRow | undefined> {
  const [inserted] = await db
    .execute(
      sql`
        INSERT INTO service_requests (
          id, org_id, work_order_id, request_number,
          title, description, urgency, estimated_cost,
          service_details, special_requirements,
          requested_by, status, previous_wo_status,
          created_at, updated_at
        )
        VALUES (
          ${p.serviceRequestId},
          ${p.orgId},
          ${p.workOrderId},
          ${p.requestNumber},
          ${p.title},
          ${p.description},
          ${p.urgency},
          ${p.estimatedCost},
          ${p.serviceDetails},
          ${p.specialRequirements},
          ${p.requestedBy},
          'pending_review',
          ${p.previousWoStatus},
          NOW(),
          NOW()
        )
        RETURNING *
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return inserted;
}

export async function markWorkOrderAwaitingService(
  workOrderId: string,
  orgId: string
): Promise<void> {
  await db.execute(sql`
    UPDATE work_orders
    SET status = 'awaiting_service', updated_at = NOW()
    WHERE id = ${workOrderId} AND org_id = ${orgId}
      AND status NOT IN ('completed', 'cancelled', 'awaiting_service')
  `);
}
