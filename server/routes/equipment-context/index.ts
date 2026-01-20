/**
 * Equipment Context Module - Backward-compatible re-exports
 *
 * MODULARIZED: 645 lines → 5 focused modules (~70-180 lines each)
 */

export type { EquipmentContext, ContextQueryOptions } from './types';
export { contextQuerySchema } from './types';
export { registerEquipmentContextRoutes } from './routes';
export { buildEquipmentContext } from './context-builder';
