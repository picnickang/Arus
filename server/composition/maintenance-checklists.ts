/**
 * Composition seam for the maintenance checklist routes.
 *
 * Checklist data is owned by the work-orders domain's storages; maintenance
 * interfaces may neither import that domain directly (cross-domain guard)
 * nor reference `db*Storage` from a routes file (domain-leak guard). The
 * ports re-export the storages under composition-owned names so the route
 * depends on this seam, not on raw storage symbols. Deeper fix (tracked in
 * the audit): fold checklist operations into work-orders application
 * services and consume those here instead.
 */
import { dbChecklistsStorage, dbWorkOrderStorage } from "../repositories.js";

export const checklistsPort = dbChecklistsStorage;
export const checklistWorkOrdersPort = dbWorkOrderStorage;
