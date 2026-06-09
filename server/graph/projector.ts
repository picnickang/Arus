/**
 * Push A2 — Relational → graph projector.
 *
 * The graph is a *read-side projection of relational truth*. This
 * module owns the only write paths into the graph so the projection
 * rules live in exactly one place.
 *
 * Idempotency: every counting edge (HAS_FAILURE_MODE, REQUIRES_PART,
 * RESOLVED_BY) carries the originating relational row's id as
 * `sourceId`. The adapter MERGEs on (from, to, type, sourceId), so
 * re-running the backfill projects the same edge tuple and `count()`
 * queries return relational truth — zero drift on replay (this was
 * the reviewer's #1 blocking finding on the first cut).
 *
 * Hook points:
 *   - Live write paths (equipment create, inventory_movements insert)
 *     call the projector after commit. The calls are best-effort —
 *     a graph failure must NEVER break the underlying relational write.
 *   - `scripts/graph/backfill.mjs` invokes the same projectors over
 *     historical rows.
 *   - When `GRAPH_ENABLED=false` or AGE is unavailable, every
 *     projector resolves to a no-op without throwing — safe to call
 *     from every write site unconditionally.
 */

import { isGraphAvailable } from "../graph-bootstrap";
import { upsertEdge, upsertNode, deleteEdge, STATIC_EDGE_SOURCE } from "../db/graph-adapter";
import { EdgeType, NodeLabel } from "./types";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("GraphProjector");

export interface EquipmentProjection {
  id: string;
  name?: string | null;
  type?: string | null;
  vesselId?: string | null;
  systemType?: string | null;
}

export interface FailureHistoryProjection {
  /** failure_history.id — the canonical source id for HAS_FAILURE_MODE / RESOLVED_BY edges. */
  failureHistoryId: string | number;
  equipmentId: string;
  failureMode: string;
  technicianId?: string | null;
  workOrderId?: string | null;
}

export interface InventoryMovementProjection {
  /** inventory_movements.id — the canonical source id for REQUIRES_PART edges. */
  movementId: string;
  partId: string;
  workOrderId?: string | null | undefined;
  /** Failure mode (if known) this part consumption was tied to. */
  failureMode?: string | null | undefined;
  /** Canonical supplier of the part (pure fact, not counted). */
  supplierId?: string | null | undefined;
  partName?: string | null | undefined;
}

/** Best-effort wrapper — never throws. Used by live writers. */
async function safe<T>(fn: () => Promise<T>, ctx: string): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.warn(`[GraphProjector] ${ctx} failed (non-fatal)`, {
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function projectEquipment(
  orgId: string,
  eq: EquipmentProjection
): Promise<void> {
  if (!isGraphAvailable()) {return;}
  await safe(async () => {
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
        STATIC_EDGE_SOURCE
      );
    }
  }, `projectEquipment(${eq.id})`);
}

export async function projectFailureHistory(
  orgId: string,
  fh: FailureHistoryProjection
): Promise<void> {
  if (!isGraphAvailable()) {return;}
  const sourceId = `fh:${String(fh.failureHistoryId)}`;
  await safe(async () => {
    await upsertNode(orgId, NodeLabel.FailureMode, fh.failureMode, {});
    await upsertEdge(
      orgId,
      NodeLabel.Equipment,
      fh.equipmentId,
      EdgeType.HasFailureMode,
      NodeLabel.FailureMode,
      fh.failureMode,
      sourceId
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
        sourceId
      );
    }
  }, `projectFailureHistory(${sourceId})`);
}

export async function projectInventoryMovement(
  orgId: string,
  mv: InventoryMovementProjection
): Promise<void> {
  if (!isGraphAvailable()) {return;}
  const sourceId = `mv:${mv.movementId}`;
  await safe(async () => {
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
        STATIC_EDGE_SOURCE
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
        sourceId
      );
    }
  }, `projectInventoryMovement(${sourceId})`);
}

/**
 * Admin-curated dependency edge (Equipment DEPENDS_ON Equipment).
 * Pure relational fact — no count semantics.
 */
export async function projectDependency(
  orgId: string,
  upstreamEquipmentId: string,
  downstreamEquipmentId: string
): Promise<void> {
  if (!isGraphAvailable()) {return;}
  await safe(async () => {
    await upsertEdge(
      orgId,
      NodeLabel.Equipment,
      upstreamEquipmentId,
      EdgeType.DependsOn,
      NodeLabel.Equipment,
      downstreamEquipmentId,
      STATIC_EDGE_SOURCE
    );
  }, `projectDependency(${upstreamEquipmentId}→${downstreamEquipmentId})`);
}

/**
 * Inverse half of `projectEquipment`'s INSTALLED_ON edge — used when
 * an equipment row's `vesselId` changes (or is cleared) so the graph
 * does not retain a stale installation edge alongside the new one.
 * Best-effort, never throws.
 */
export async function retractInstalledOn(
  orgId: string,
  equipmentId: string,
  vesselId: string
): Promise<void> {
  if (!isGraphAvailable()) {return;}
  await safe(async () => {
    const ok = await deleteEdge(
      orgId,
      NodeLabel.Equipment,
      equipmentId,
      EdgeType.InstalledOn,
      NodeLabel.Vessel,
      vesselId
    );
    if (!ok) {
      logger.warn("[GraphProjector] INSTALLED_ON delete returned not-ok", {
        equipmentId,
        vesselId,
        orgId,
      });
    }
  }, `retractInstalledOn(${equipmentId}→${vesselId})`);
}

/**
 * Inverse of `projectDependency` — used when the admin removes the
 * relational row so the graph no longer reports a stale blast-radius
 * edge. Best-effort, never throws (matches projectDependency contract).
 */
export async function retractDependency(
  orgId: string,
  upstreamEquipmentId: string,
  downstreamEquipmentId: string
): Promise<void> {
  if (!isGraphAvailable()) {return;}
  await safe(async () => {
    const ok = await deleteEdge(
      orgId,
      NodeLabel.Equipment,
      upstreamEquipmentId,
      EdgeType.DependsOn,
      NodeLabel.Equipment,
      downstreamEquipmentId
    );
    if (!ok) {
      // Surface stale-edge risk explicitly — the relational row was
      // already deleted by the caller; if the graph delete didn't
      // commit, blast-radius queries may still report this edge.
      logger.warn("[GraphProjector] DEPENDS_ON delete returned not-ok", {
        upstreamEquipmentId,
        downstreamEquipmentId,
        orgId,
      });
    }
  }, `retractDependency(${upstreamEquipmentId}→${downstreamEquipmentId})`);
}
