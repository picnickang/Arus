/**
 * Push A2 — Knowledge graph node + edge type taxonomy.
 *
 * The graph is a read-side projection of relational truth. These
 * string constants are the single source for node labels and edge
 * types used by every projector, query, and Copilot tool so the
 * schema cannot drift across modules.
 */

export const NodeLabel = {
  Equipment: "Equipment",
  FailureMode: "FailureMode",
  Part: "Part",
  Supplier: "Supplier",
  Technician: "Technician",
  Vessel: "Vessel",
} as const;
export type NodeLabel = (typeof NodeLabel)[keyof typeof NodeLabel];

export const EdgeType = {
  /** Equipment → Vessel */
  InstalledOn: "INSTALLED_ON",
  /** Equipment → FailureMode (history-derived, weighted by count) */
  HasFailureMode: "HAS_FAILURE_MODE",
  /** FailureMode → Part (history-derived, weighted by count) */
  RequiresPart: "REQUIRES_PART",
  /** Part → Supplier */
  SuppliedBy: "SUPPLIED_BY",
  /** FailureMode → Technician (history-derived) */
  ResolvedBy: "RESOLVED_BY",
  /** Equipment → Equipment (admin-curated dependency, downstream degrades) */
  DependsOn: "DEPENDS_ON",
} as const;
export type EdgeType = (typeof EdgeType)[keyof typeof EdgeType];

export interface GraphNodeRef {
  /** Stable business id used as graph node primary key. */
  id: string;
  label: NodeLabel;
}

export interface SimilarFailureRow {
  failureMode: string;
  occurrences: number;
  equipmentIds: string[];
}

export interface PartsForFailureRow {
  partId: string;
  partName?: string;
  occurrences: number;
}

export interface PropagationRow {
  equipmentId: string;
  equipmentName?: string;
  hops: number;
}
