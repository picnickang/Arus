import { db } from "../db";
import { serviceOrders, workOrders } from "@shared/schema-runtime";
import { eq, and } from "drizzle-orm";

const FINALIZED_SO_STATUSES = ["completed", "invoiced"];

interface ServiceOrderDetail {
  id: string;
  soNumber: string;
  status: string;
  actualAmount: number | null;
  quotedAmount: number | null;
  serviceProviderId: string;
}

export interface WorkOrderProcurementCosts {
  serviceOrderCosts: number;
  totalProcurementCost: number;
  resolvedDowntimeCostPerHour: number;
  serviceOrderDetails: ServiceOrderDetail[];
}

export async function getWorkOrderProcurementCosts(
  workOrderId: string,
  orgId: string
): Promise<WorkOrderProcurementCosts> {
  const result: WorkOrderProcurementCosts = {
    serviceOrderCosts: 0,
    totalProcurementCost: 0,
    resolvedDowntimeCostPerHour: 1000,
    serviceOrderDetails: [],
  };

  if (serviceOrders) {
    const sos = await db
      .select({
        id: serviceOrders.id,
        soNumber: serviceOrders.soNumber,
        status: serviceOrders.status,
        actualAmount: serviceOrders.actualAmount,
        quotedAmount: serviceOrders.quotedAmount,
        serviceProviderId: serviceOrders.serviceProviderId,
      })
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.workOrderId, workOrderId),
          eq(serviceOrders.orgId, orgId)
        )
      );

    result.serviceOrderDetails = sos.map((so) => ({
      id: so.id,
      soNumber: so.soNumber,
      status: so.status,
      actualAmount: so.actualAmount,
      quotedAmount: so.quotedAmount,
      serviceProviderId: so.serviceProviderId ?? "",
    }));

    result.serviceOrderCosts = sos.reduce((total, so) => {
      if (!FINALIZED_SO_STATUSES.includes(so.status)) return total;
      return total + (so.actualAmount ?? 0);
    }, 0);
  }

  const [workOrder] = await db
    .select({
      equipmentId: workOrders.equipmentId,
      downtimeCostPerHour: workOrders.downtimeCostPerHour,
    })
    .from(workOrders)
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.orgId, orgId)))
    .limit(1);

  if (workOrder) {
    const { equipment, costModel } = await import("@shared/schema-runtime");
    const [equipmentRow] = await db
      .select({ downtimeCostPerHour: equipment.downtimeCostPerHour })
      .from(equipment)
      .where(and(eq(equipment.id, workOrder.equipmentId), eq(equipment.orgId, orgId)))
      .limit(1);

    const [activeCostModel] = await db
      .select({ downtimePerHour: costModel.downtimePerHour })
      .from(costModel)
      .where(and(eq(costModel.orgId, orgId), eq(costModel.isActive, true)))
      .limit(1);

    result.resolvedDowntimeCostPerHour = workOrder.downtimeCostPerHour
      ?? equipmentRow?.downtimeCostPerHour
      ?? activeCostModel?.downtimePerHour
      ?? 1000;
  }

  result.totalProcurementCost = result.serviceOrderCosts;
  return result;
}

export async function aggregateProcurementCostsToWorkOrder(
  workOrderId: string,
  orgId: string
): Promise<{ totalPartsCost: number; totalProcurementCost: number }> {
  const costs = await getWorkOrderProcurementCosts(workOrderId, orgId);

  const [workOrder] = await db
    .select({
      equipmentId: workOrders.equipmentId,
      downtimeCostPerHour: workOrders.downtimeCostPerHour,
      totalLaborCost: workOrders.totalLaborCost,
      actualDowntimeHours: workOrders.actualDowntimeHours,
    })
    .from(workOrders)
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.orgId, orgId)))
    .limit(1);

  if (!workOrder) {
    throw new Error(`Work order ${workOrderId} not found`);
  }

  const { workOrderParts } = await import("@shared/schema-runtime");
  let internalPartsCost = 0;
  if (workOrderParts) {
    const parts = await db
      .select({ totalCost: workOrderParts.totalCost })
      .from(workOrderParts)
      .where(eq(workOrderParts.workOrderId, workOrderId));
    internalPartsCost = parts.reduce((sum, p) => sum + (p.totalCost ?? 0), 0);
  }

  const updatedTotalPartsCost = internalPartsCost + costs.serviceOrderCosts;

  const totalCost =
    (workOrder.totalLaborCost ?? 0) +
    updatedTotalPartsCost +
    ((workOrder.actualDowntimeHours ?? 0) * costs.resolvedDowntimeCostPerHour);

  await db
    .update(workOrders)
    .set({
      totalPartsCost: updatedTotalPartsCost,
      totalCost,
    })
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.orgId, orgId)));

  return {
    totalPartsCost: updatedTotalPartsCost,
    totalProcurementCost: costs.totalProcurementCost,
  };
}
