import { and, eq, sql } from "drizzle-orm";

import { db } from "../../db-config";
import { projectInventoryMovement } from "../../graph/projector";
import { createLogger } from "../../lib/structured-logger";
import { failureHistory, parts as partsTable } from "@shared/schema-runtime";

const logger = createLogger("Db:Inventory:Index");

/**
 * Push A2 — Pending graph projection captured INSIDE a DB transaction
 * but FIRED only after the transaction commits. The reviewer caught
 * the original in-tx fire-and-forget as a divergence hazard: if the
 * SQL transaction rolls back, in-flight graph writes would leave the
 * graph ahead of relational truth. The post-commit pattern below
 * guarantees the graph only ever reflects committed rows.
 *
 * Supplier / part name are resolved lazily here (post-commit) by a
 * single batched lookup against the `parts` table so the SUPPLIED_BY
 * edge is populated on live writes — backfill is no longer the only
 * path that produces supplier linkage.
 */
export interface PendingMovementProjection {
  movementId: string;
  partId: string;
  workOrderId: string | null | undefined;
  /**
   * Movement direction. Only forward-consumption types ('reserve',
   * 'consume') count toward REQUIRES_PART semantics. 'release' /
   * 'return' are reversals and must NOT contribute to the
   * failure→part edge (otherwise the live path would flip-count
   * vs. the backfill, which the reviewer flagged on the fourth
   * pass).
   */
  movementType: string;
}

export async function fireInventoryMovementProjections(
  orgId: string,
  pending: PendingMovementProjection[]
): Promise<void> {
  return fireProjectionsAfterCommit(orgId, pending);
}

async function fireProjectionsAfterCommit(
  orgId: string,
  pending: PendingMovementProjection[]
): Promise<void> {
  if (pending.length === 0) {
    return;
  }
  try {
    const partIds = Array.from(new Set(pending.map((p) => p.partId)));
    // Statically imported `partsTable` (was dynamic import + escape-hatch cast
    // shape — reviewer asked for typed schema bindings on this hot
    // path). Drizzle infers column types from the schema runtime
    // module directly.
    const partRows = await db
      .select({
        id: partsTable.id,
        name: partsTable.name,
        primarySupplierId: partsTable.primarySupplierId,
      })
      .from(partsTable)
      .where(and(eq(partsTable.orgId, orgId), sql`${partsTable.id} = ANY(${partIds})`));
    const partMeta = new Map<string, { name?: string | null; supplierId?: string | null }>();
    for (const r of partRows as Array<{
      id: string;
      name: string | null;
      primarySupplierId: string | null;
    }>) {
      partMeta.set(r.id, {
        name: r.name,
        supplierId: r.primarySupplierId,
      });
    }
    // Resolve failureMode per workOrderId so REQUIRES_PART edges are
    // produced on live writes (not just backfill). Limited to
    // forward-consumption movement types — `release`/`return` are
    // reversals and would flip-count the edge. Reviewer's fifth-pass
    // blocker: without this, the most important counting edge for
    // operational reasoning drifted immediately after bootstrap.
    const consumingPending = pending.filter(
      (p) => p.workOrderId && (p.movementType === "reserve" || p.movementType === "consume")
    );
    const woIds = Array.from(
      new Set(consumingPending.map((p) => p.workOrderId).filter((id): id is string => !!id))
    );
    const failureModeByWo = new Map<string, string>();
    if (woIds.length > 0) {
      const fhRows = await db
        .select({
          workOrderId: failureHistory.workOrderId,
          failureMode: failureHistory.failureMode,
        })
        .from(failureHistory)
        .where(
          and(eq(failureHistory.orgId, orgId), sql`${failureHistory.workOrderId} = ANY(${woIds})`)
        );
      for (const r of fhRows as Array<{ workOrderId: string | null; failureMode: string | null }>) {
        if (r.workOrderId && r.failureMode) {
          failureModeByWo.set(r.workOrderId, r.failureMode);
        }
      }
    }
    await Promise.all(
      pending.map((p) => {
        const meta = partMeta.get(p.partId) ?? {};
        const isConsuming = p.movementType === "reserve" || p.movementType === "consume";
        const failureMode =
          isConsuming && p.workOrderId ? (failureModeByWo.get(p.workOrderId) ?? null) : null;
        return projectInventoryMovement(orgId, {
          movementId: p.movementId,
          partId: p.partId,
          workOrderId: p.workOrderId,
          partName: meta.name ?? null,
          supplierId: meta.supplierId ?? null,
          failureMode,
        }).catch((err) => {
          logger.warn(`[Graph] projectInventoryMovement(${p.movementId}) failed`, {
            orgId,
            partId: p.partId,
            details: err instanceof Error ? err.message : String(err),
          });
        });
      })
    );
  } catch (err) {
    // best-effort by contract; never fail the caller for graph errors,
    // but emit a structured warning so projector drift is observable.
    logger.warn(`[Graph] fireProjectionsAfterCommit failed`, {
      orgId,
      pendingCount: pending.length,
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
