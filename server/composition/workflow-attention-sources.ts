/**
 * Composition root for the Workflow Attention Inbox.
 *
 * Lives outside `server/domains/` on purpose: the workflow domain expresses
 * its dependencies as ports (see `server/domains/workflow/domain/ports.ts`),
 * and this file is the only place that wires those ports to the concrete
 * `db*Storage` adapters owned by other bounded contexts. Keeping the wiring
 * here preserves hexagonal modularity — no domain reaches into another
 * domain's infrastructure directly.
 */

import { dbAlertStorage } from "../db/alerts/index.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { dbInventoryStorage } from "../db/inventory/index.js";
import { dbWorkOrderStorage } from "../db/workorders/index.js";
import type {
  AlertSourcePort,
  AttentionWorkflowSources,
  EquipmentSourcePort,
  InventorySourcePort,
  WorkOrderSourcePort,
} from "../domains/workflow/domain/ports.js";

const alertSource: AlertSourcePort = {
  getAlertNotifications: (orgId) => dbAlertStorage.getAlertNotifications(false, orgId),
};

const workOrderSource: WorkOrderSourcePort = {
  getWorkOrders: (orgId) => dbWorkOrderStorage.getWorkOrders(undefined, orgId),
};

const equipmentSource: EquipmentSourcePort = {
  getEquipmentRegistry: (orgId) => dbEquipmentStorage.getEquipmentRegistry(orgId),
};

const inventorySource: InventorySourcePort = {
  getLowStockParts: (orgId) => dbInventoryStorage.getLowStockParts(orgId),
};

export function createWorkflowAttentionSources(): AttentionWorkflowSources {
  return {
    alerts: alertSource,
    workOrders: workOrderSource,
    equipment: equipmentSource,
    inventory: inventorySource,
  };
}
