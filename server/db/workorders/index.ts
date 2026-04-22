/**
 * Work Orders Repository - Modular Aggregator
 * Re-exports all modules for backward compatibility
 */

import { DbWorkOrderCore } from "./db-core.js";
import { DbWorkOrderNested } from "./db-nested.js";
import { DbWorkOrderCompletions } from "./db-completions.js";
import type {
  WorkOrderPart,
  WorkOrderTask,
  WorkOrderChecklist,
  WorkOrderWorklog,
  WorkOrderCompletion,
} from "./types.js";

export * from "./types.js";
export { DbWorkOrderCore } from "./db-core.js";
export { DbWorkOrderNested } from "./db-nested.js";
export { DbWorkOrderCompletions } from "./db-completions.js";

type PartialPart = Partial<WorkOrderPart>;
type PartialTask = Partial<WorkOrderTask>;
type PartialChecklist = Partial<WorkOrderChecklist>;
type PartialWorklog = Partial<WorkOrderWorklog>;
type InsertCompletion = Omit<WorkOrderCompletion, "id">;
type CompletionFilters = {
  equipmentId?: string;
  vesselId?: string;
  startDate?: Date;
  endDate?: Date;
  orgId?: string;
};

export class DatabaseWorkOrderStorage extends DbWorkOrderCore {
  private nested = new DbWorkOrderNested();
  private completions = new DbWorkOrderCompletions();
  async getWorkOrderParts(workOrderId: string, orgId?: string) {
    return this.nested.getWorkOrderParts(workOrderId, orgId);
  }
  async addWorkOrderPart(part: PartialPart) {
    return this.nested.addWorkOrderPart(part);
  }
  async updateWorkOrderPart(id: string, updates: PartialPart) {
    return this.nested.updateWorkOrderPart(id, updates);
  }
  async deleteWorkOrderPart(id: string) {
    return this.nested.deleteWorkOrderPart(id);
  }
  async getWorkOrderTasks(workOrderId: string) {
    return this.nested.getWorkOrderTasks(workOrderId);
  }
  async addWorkOrderTask(task: PartialTask) {
    return this.nested.addWorkOrderTask(task);
  }
  async updateWorkOrderTask(id: string, updates: PartialTask) {
    return this.nested.updateWorkOrderTask(id, updates);
  }
  async deleteWorkOrderTask(id: string) {
    return this.nested.deleteWorkOrderTask(id);
  }
  async getWorkOrderChecklists(workOrderId: string) {
    return this.nested.getWorkOrderChecklists(workOrderId);
  }
  async addWorkOrderChecklist(checklist: PartialChecklist) {
    return this.nested.addWorkOrderChecklist(checklist);
  }
  async updateWorkOrderChecklist(id: string, updates: PartialChecklist) {
    return this.nested.updateWorkOrderChecklist(id, updates);
  }
  async deleteWorkOrderChecklist(id: string) {
    return this.nested.deleteWorkOrderChecklist(id);
  }
  async getWorkOrderWorklogs(workOrderId: string) {
    return this.nested.getWorkOrderWorklogs(workOrderId);
  }
  async addWorkOrderWorklog(worklog: PartialWorklog) {
    return this.nested.addWorkOrderWorklog(worklog);
  }
  async updateWorkOrderWorklog(id: string, updates: PartialWorklog) {
    return this.nested.updateWorkOrderWorklog(id, updates);
  }
  async deleteWorkOrderWorklog(id: string) {
    return this.nested.deleteWorkOrderWorklog(id);
  }
  async createWorkOrderCompletion(completion: InsertCompletion) {
    return this.completions.createWorkOrderCompletion(completion);
  }
  async getWorkOrderCompletions(filters?: CompletionFilters) {
    return this.completions.getWorkOrderCompletions(filters);
  }
  async getWorkOrderCompletion(id: string) {
    return this.completions.getWorkOrderCompletion(id);
  }
  async getWorkOrderCompletionsByWorkOrder(workOrderId: string) {
    return this.completions.getWorkOrderCompletionsByWorkOrder(workOrderId);
  }
}

export const dbWorkOrderStorage = new DatabaseWorkOrderStorage();

console.log("[Work Orders Repository] Loaded 8 modular files");
