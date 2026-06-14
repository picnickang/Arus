/**
 * Alerts Infrastructure - Work Order Escalation Adapter
 *
 * Implements IWorkOrderEscalator by delegating to the work-order service via
 * the repositories barrel. The import is lazy (mirroring the original route's
 * `await import(...)`) to preserve module boot-order safety.
 */

import type { IWorkOrderEscalator } from "../domain/ports";
import type { WorkOrder, InsertWorkOrder } from "@shared/schema";

export class WorkOrderEscalationAdapter implements IWorkOrderEscalator {
  async createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder> {
    const { workOrderService } = await import("../../../repositories");
    // InsertWorkOrder satisfies createWorkOrder's input (its extra woNumber/id
    // fields are optional), so no cast is needed.
    return workOrderService.createWorkOrder(data);
  }
}

export const workOrderEscalator = new WorkOrderEscalationAdapter();
