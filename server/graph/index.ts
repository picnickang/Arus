/**
 * Push A2 — Knowledge graph public surface. Single import site so the
 * rest of the codebase never reaches into AGE-specific files directly.
 */

export {
  isGraphEnabled,
  isGraphAvailable,
  runGraphBootstrap,
  ensureTenantGraph,
  tenantGraphName,
} from "../graph-bootstrap";

export {
  findSimilarFailures,
  whatPartsForFailureMode,
  failurePropagation,
  crossClassPatterns,
  upsertNode,
  upsertEdge,
} from "../db/graph-adapter";

export {
  projectEquipment,
  projectFailureHistory,
  projectInventoryMovement,
  projectDependency,
  retractDependency,
} from "./projector";

export { NodeLabel, EdgeType } from "./types";

export type {
  EquipmentProjection,
  FailureHistoryProjection,
  InventoryMovementProjection,
} from "./projector";
