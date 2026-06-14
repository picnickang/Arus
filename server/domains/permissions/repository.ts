/**
 * Permissions repository — backward-compatibility shim.
 *
 * The implementation moved to infrastructure/repository.ts (the hexagonal data
 * layer; raw db access is confined there). This shim re-exports the public
 * surface so existing `permissions/repository` importers keep working while the
 * domain is migrated to the layered structure.
 */
export * from "./infrastructure/repository.js";
