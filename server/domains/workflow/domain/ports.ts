/**
 * Workflow domain ports.
 *
 * The Attention Inbox aggregates data from several other bounded contexts
 * (alerts, equipment, inventory, work orders). To preserve hexagonal
 * boundaries, the workflow domain depends only on these narrow port
 * interfaces. Real adapters that wrap the storages of those domains live in
 * `server/composition/workflow-attention-sources.ts` (outside the workflow
 * domain), and are injected at route registration time.
 *
 * This keeps the domain leak guard happy: no file inside
 * `server/domains/workflow/` imports another domain's `db*Storage` directly.
 */

export interface AlertSourcePort {
  /**
   * Returns alert notifications for the given org.
   * `false` here mirrors the existing storage call (unread/unacked filter).
   */
  getAlertNotifications(orgId: string): Promise<unknown[]>;
}

export interface WorkOrderSourcePort {
  getWorkOrders(orgId: string): Promise<unknown[]>;
}

export interface EquipmentSourcePort {
  getEquipmentRegistry(orgId: string): Promise<unknown[]>;
}

export interface InventorySourcePort {
  getLowStockParts(orgId: string): Promise<unknown[]>;
}

export interface AttentionWorkflowSources {
  alerts: AlertSourcePort;
  workOrders: WorkOrderSourcePort;
  equipment: EquipmentSourcePort;
  inventory: InventorySourcePort;
}
