/**
   * CANONICAL HOME — Workorders
   * ============================================================
   * This module is the single canonical home for Workorders data
   * access. Other layers (domain adapters under
   * `server/domains/workorders/infrastructure/`, legacy route handlers,
   * cross-domain readers in `server/composition/*`, etc.) MUST import
   * the `db…Storage` singleton from this file directly rather than
   * routing through `server/repositories.ts`. Push B4 (Repositories
   * Proxy Decomposition) removed the four primary-domain importers of
   * that proxy; the proxy now exists only as a transitional re-export
   * barrel for legacy non-domain consumers. New code MUST import from
   * here.
   * ============================================================
   */
  /**
 * Work Orders Repository - Modular Aggregator
 * Re-exports all modules for backward compatibility
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Workorders:Index");
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
    return this.nested.addWorkOrderPart(part as any);
  }
  async updateWorkOrderPart(id: string, updates: PartialPart) {
    return this.nested.updateWorkOrderPart(id, updates as any);
  }
  async deleteWorkOrderPart(id: string) {
    return this.nested.deleteWorkOrderPart(id);
  }
  async getWorkOrderTasks(workOrderId: string) {
    return this.nested.getWorkOrderTasks(workOrderId);
  }
  async addWorkOrderTask(task: PartialTask) {
    return this.nested.addWorkOrderTask(task as any);
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
    return this.nested.addWorkOrderChecklist(checklist as any);
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
    return this.nested.addWorkOrderWorklog(worklog as any);
  }
  async updateWorkOrderWorklog(id: string, updates: PartialWorklog) {
    return this.nested.updateWorkOrderWorklog(id, updates);
  }
  async deleteWorkOrderWorklog(id: string) {
    return this.nested.deleteWorkOrderWorklog(id);
  }
  async createWorkOrderCompletion(completion: InsertCompletion) {
    return this.completions.createWorkOrderCompletion(completion as any);
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

logger.info("[Work Orders Repository] Loaded 8 modular files");
