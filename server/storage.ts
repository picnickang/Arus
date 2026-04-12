/**
 * @deprecated RETIRED — All consumers migrated to server/repositories.ts
 *
 * This file exists only to prevent import-resolution errors from stale caches.
 * DO NOT add new imports targeting this file.
 */
export { storage } from "./repositories";
export type { IStorage } from "./storage/interfaces/storage.types";
export type { WorkOrderFilters } from "./storage/interfaces/storage.types";
