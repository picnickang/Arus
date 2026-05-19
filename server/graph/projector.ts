/**
 * Push A2 — Relational → graph projector.
 *
 * The graph is a *read-side projection of relational truth*. This
 * module owns the only write paths into the graph so the projection
 * rules live in exactly one place. Every call is idempotent (the
 * adapter uses Cypher MERGE) — re-running the backfill must never
 * duplicate nodes or inflate edge weights from the same source row
 * twice (callers should set `incrementWeight=0` on replay, or pass
 * the natural counting input once).
 *
 * Hook points:
 *   - Write paths (equipment create/update, failure_history insert,
 *     inventory_movements insert) call `projectEquipment` /
 *     `projectFailureHistory` / `projectInventoryMovement` opportunistically.
 *   - `scripts/graph/backfill.mjs` invokes the same projectors over
 *     historical relational rows.
 *   - When `GRAPH_ENABLED=false` or AGE is unavailable, every projector
 *     resolves to false without throwing — safe to call from every
 *     write site unconditionally.
 */

import { isGraphAvailable } from "../graph-bootstrap";
import { upsertEdge, upsertNode } from "./adapter";
import { EdgeType, NodeLabel } from "./types";

export interface EquipmentProjection {
  id: string;
  name?: string | null;
  type?: string | null;
  vesselId?: string | null;
  systemType?: string | null;
}

export interface FailureHistoryProjection {
  equipmentId: string;
  failureMode: string;
  technicianId?: string | null;
  workOrderId?: string | null;
}

export interface InventoryMovementProjection {
  partId: string;
  workOrderId?: string | null;
  /** Failure mode (if known) that this part consumption was tied to. */
  failureMode?: string | null;
  /** Optional supplier on which this part is canonically sourced. */
  supplierId?: string | null;
  partName?: string | null;
}

export async function projectEquipment(
  orgId: string,
  eq: EquipmentProjection
): Promise<void> {
  if (!isGraphAvailable()) return;
  await upsertNode(orgId, NodeLabel.Equipment, eq.id, {
    name: eq.name ?? undefined,
    type: eq.type ?? undefined,
    systemType: eq.systemType ?? undefined,
  });
  if (eq.vesselId) {
    await upsertNode(orgId, NodeLabel.Vessel, eq.vesselId, {});
    await upsertEdge(
      orgId,
      NodeLabel.Equipment,
      eq.id,
      EdgeType.InstalledOn,
      NodeLabel.Vessel,
      eq.vesselId,
      // INSTALLED_ON is a relational fact, not a count — keep weight at 1.
      0
    );
  }
}

export async function projectFailureHistory(
  orgId: string,
  fh: FailureHistoryProjection
): Promise<void> {
  if (!isGraphAvailable()) return;
  await upsertNode(orgId, NodeLabel.FailureMode, fh.failureMode, {});
  await upsertEdge(
    orgId,
    NodeLabel.Equipment,
    fh.equipmentId,
    EdgeType.HasFailureMode,
    NodeLabel.FailureMode,
    fh.failureMode,
    1
  );
  if (fh.technicianId) {
    await upsertNode(orgId, NodeLabel.Technician, fh.technicianId, {});
    await upsertEdge(
      orgId,
      NodeLabel.FailureMode,
      fh.failureMode,
      EdgeType.ResolvedBy,
      NodeLabel.Technician,
      fh.technicianId,
      1
    );
  }
}

export async function projectInventoryMovement(
  orgId: string,
  mv: InventoryMovementProjection
): Promise<void> {
  if (!isGraphAvailable()) return;
  await upsertNode(orgId, NodeLabel.Part, mv.partId, {
    name: mv.partName ?? undefined,
  });
  if (mv.supplierId) {
    await upsertNode(orgId, NodeLabel.Supplier, mv.supplierId, {});
    await upsertEdge(
      orgId,
      NodeLabel.Part,
      mv.partId,
      EdgeType.SuppliedBy,
      NodeLabel.Supplier,
      mv.supplierId,
      0
    );
  }
  if (mv.failureMode) {
    await upsertNode(orgId, NodeLabel.FailureMode, mv.failureMode, {});
    await upsertEdge(
      orgId,
      NodeLabel.FailureMode,
      mv.failureMode,
      EdgeType.RequiresPart,
      NodeLabel.Part,
      mv.partId,
      1
    );
  }
}

/**
 * Admin-curated dependency edge. Surfaced as a separate projector so
 * an admin UI / import script can wire downstream-degrade relationships
 * (used by `failurePropagation` Copilot tool).
 */
export async function projectDependency(
  orgId: string,
  upstreamEquipmentId: string,
  downstreamEquipmentId: string
): Promise<void> {
  if (!isGraphAvailable()) return;
  await upsertEdge(
    orgId,
    NodeLabel.Equipment,
    upstreamEquipmentId,
    EdgeType.DependsOn,
    NodeLabel.Equipment,
    downstreamEquipmentId,
    0
  );
}
