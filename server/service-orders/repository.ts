import { db } from "../db";
import { serviceOrders, serviceOrderEvents, workOrders, suppliers, vessels, equipment } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { ServiceOrder, InsertServiceOrder, ServiceOrderWithDetails, ServiceOrderListFilters, ServiceOrderStatus } from "./types";

export async function generateSoNumber(orgId: string): Promise<string> {
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(CAST(SUBSTRING(so_number FROM 4) AS INTEGER)), 0) + 1 AS next_val
        FROM service_orders WHERE org_id = ${orgId} AND so_number ~ '^SO-[0-9]+$'`
  );
  const nextNum = Number((result as { rows?: Array<{ next_val: string }> }).rows?.[0]?.next_val ?? 1);
  return `SO-${String(nextNum).padStart(3, "0")}`;
}

export async function createServiceOrder(data: InsertServiceOrder & { soNumber: string }): Promise<ServiceOrder> {
  const [so] = await db.insert(serviceOrders).values(data).returning();
  await db.insert(serviceOrderEvents).values({
    orgId: data.orgId,
    soId: so.id,
    eventType: "created",
    details: { status: "draft" },
  });
  return so;
}

export async function getServiceOrderById(id: string, orgId: string): Promise<ServiceOrderWithDetails | null> {
  const result = await db
    .select({
      so: serviceOrders,
      workOrderNumber: workOrders.woNumber,
      workOrderDescription: workOrders.description,
      serviceProviderName: suppliers.name,
      serviceProviderEmail: suppliers.email,
      vesselName: vessels.name,
      equipmentName: equipment.name,
    })
    .from(serviceOrders)
    .leftJoin(workOrders, eq(serviceOrders.workOrderId, workOrders.id))
    .leftJoin(suppliers, eq(serviceOrders.serviceProviderId, suppliers.id))
    .leftJoin(vessels, eq(workOrders.vesselId, vessels.id))
    .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.orgId, orgId)))
    .limit(1);

  if (result.length === 0) { return null; }
  const row = result[0];
  return {
    ...row.so,
    workOrderNumber: row.workOrderNumber ?? undefined,
    workOrderDescription: row.workOrderDescription ?? undefined,
    serviceProviderName: row.serviceProviderName ?? undefined,
    serviceProviderEmail: row.serviceProviderEmail ?? undefined,
    vesselName: row.vesselName ?? undefined,
    equipmentName: row.equipmentName ?? undefined,
  };
}

export async function listServiceOrders(
  orgId: string,
  filters: ServiceOrderListFilters = {}
): Promise<ServiceOrderWithDetails[]> {
  const conditions = [eq(serviceOrders.orgId, orgId)];

  if (filters.status) { conditions.push(eq(serviceOrders.status, filters.status)); }
  if (filters.serviceProviderId) { conditions.push(eq(serviceOrders.serviceProviderId, filters.serviceProviderId)); }
  if (filters.workOrderId) { conditions.push(eq(serviceOrders.workOrderId, filters.workOrderId)); }
  if (filters.dateFrom) { conditions.push(gte(serviceOrders.scheduledStartDate, filters.dateFrom)); }
  if (filters.dateTo) { conditions.push(lte(serviceOrders.scheduledEndDate, filters.dateTo)); }

  const rows = await db
    .select({
      so: serviceOrders,
      workOrderNumber: workOrders.woNumber,
      workOrderDescription: workOrders.description,
      serviceProviderName: suppliers.name,
      serviceProviderEmail: suppliers.email,
      vesselName: vessels.name,
      equipmentName: equipment.name,
    })
    .from(serviceOrders)
    .leftJoin(workOrders, eq(serviceOrders.workOrderId, workOrders.id))
    .leftJoin(suppliers, eq(serviceOrders.serviceProviderId, suppliers.id))
    .leftJoin(vessels, eq(workOrders.vesselId, vessels.id))
    .leftJoin(equipment, eq(workOrders.equipmentId, equipment.id))
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

  if (status === "sent") { updates.sentAt = now; }
  else if (status === "confirmed") { updates.confirmedAt = now; }
  else if (status === "in_progress") { updates.actualStartDate = now; }
  else if (status === "completed") {
    updates.completedAt = now;
    updates.actualEndDate = now;
  } else if (status === "cancelled") {
    updates.cancelledAt = now;
    if (details?.reason) { updates.cancellationReason = details.reason as string; }
  }

  const [updated] = await db
    .update(serviceOrders)
    .set(updates)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.orgId, orgId)))
    .returning();

  if (updated) {
    const eventType = status === "in_progress" ? "started" : status;
    await db.insert(serviceOrderEvents).values({
      orgId, soId: id, eventType, userId, details: details ?? { status },
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
  if (!existing) { return { success: false, error: "Service order not found" }; }

  const status = existing.status;
  if (status !== "draft" && status !== "cancelled") {
    return { success: false, error: "Only draft or cancelled service orders can be deleted" };
  }

  await db.delete(serviceOrderEvents).where(
    and(eq(serviceOrderEvents.soId, id), eq(serviceOrderEvents.orgId, orgId))
  );
  await db.delete(serviceOrders).where(
    and(eq(serviceOrders.id, id), eq(serviceOrders.orgId, orgId))
  );

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
      if (result.error) { errors.push(`${order.soNumber}: ${result.error}`); }
    }
  }

  return { success: true, deletedCount, skippedCount, errors };
}
