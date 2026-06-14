/**
 * Composition - Sync Inventory Data Provider
 *
 * The sync domain's reconcile route needs to read parts and sync part cost to
 * stock — both owned by the inventory domain. This adapter lives in the
 * composition layer (outside `server/domains/`) so the sync domain itself stays
 * free of cross-domain `dbInventoryStorage` coupling; the port is injected into
 * the sync routes via the domain-router registry (mirrors the alerts→crew seam).
 */

import { dbInventoryStorage } from "../db/inventory/index.js";

export interface ISyncInventoryPort {
  /** Parts to reconcile (only `id` is consumed). */
  getParts(): Promise<Array<{ id: string }>>;
  /** Recompute and write a part's cost onto its stock rows. */
  syncPartCostToStock(partId: string): Promise<void>;
}

export const syncInventoryProvider: ISyncInventoryPort = {
  getParts: () => dbInventoryStorage.getParts(),
  syncPartCostToStock: (partId: string) => dbInventoryStorage.syncPartCostToStock(partId),
};
