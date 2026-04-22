/**
 * Equipment Context Routes - Backward-compatible shim
 *
 * MODULARIZED: 645 lines → 5 focused modules (~70-180 lines each)
 */

export type { EquipmentContext, ContextQueryOptions } from "./equipment-context/types";
export { contextQuerySchema } from "./equipment-context/types";
export { registerEquipmentContextRoutes } from "./equipment-context/routes";
export { buildEquipmentContext } from "./equipment-context/context-builder";
