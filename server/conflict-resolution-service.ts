/**
 * Offline conflict-resolution service (Phase 1 — work orders).
 *
 * Version contract (optimistic concurrency):
 *   - The client edits a record offline and remembers the `version` it
 *     started from (its "base version").
 *   - On sync it sends `{ table, recordId, data, version }`.
 *   - The server applies the update transactionally, guarded by
 *     `id = recordId AND org_id = <authenticated org> AND version = baseVersion`,
 *     and bumps `version` to `baseVersion + 1`.
 *   - If exactly one row matched, the edit applied cleanly.
 *   - If no row matched but the record still exists in scope, another
 *     device already advanced the version => the stale write is REJECTED
 *     and a row is persisted in `sync_conflicts` for review. The change is
 *     never silently overwritten.
 *   - If the record does not exist in the caller's scope, it is reported
 *     as not-found.
 *
 * Everything is scoped to the authenticated caller's org. Only tables on
 * the allowlist below participate; any other table is refused.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db.js";
import { workOrders, syncConflicts } from "@shared/schema-runtime";
import { insertWorkOrderSchema } from "@shared/schema-runtime";

// ── Errors the route layer translates into HTTP 400 ──────────────────────

export class ConflictTableNotAllowedError extends Error {
  constructor(table: string) {
    super(`Conflict detection is not enabled for table: ${table}`);
    this.name = "ConflictTableNotAllowedError";
  }
}

export class ConflictPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictPayloadError";
  }
}

// ── Allowlist of conflict-enabled tables ─────────────────────────────────

/**
 * Tables that participate in optimistic-concurrency conflict detection.
 * Phase 1 ships a single high-value table (work orders). Adding a table
 * means: (a) list it here, (b) give it a guarded-update handler in
 * `applyOptimisticUpdate`, and (c) declare its safety-critical fields.
 */
export const CONFLICT_ENABLED_TABLES = ["work_orders"] as const;
export type ConflictEnabledTable = (typeof CONFLICT_ENABLED_TABLES)[number];

/**
 * Fields whose divergence forces MANUAL resolution (never auto-resolved).
 */
const SAFETY_CRITICAL_FIELDS: Record<ConflictEnabledTable, ReadonlySet<string>> = {
  work_orders: new Set(["status", "priority", "affectsVesselDowntime", "assignedCrewId"]),
};

export function isConflictEnabledTable(table: string): table is ConflictEnabledTable {
  return (CONFLICT_ENABLED_TABLES as readonly string[]).includes(table);
}

export function listConflictEnabledTables(): ConflictEnabledTable[] {
  return [...CONFLICT_ENABLED_TABLES];
}

// ── Public types ─────────────────────────────────────────────────────────

export interface ConflictRecord {
  conflictId: string;
  table: string;
  recordId: string;
  field: string | null;
  serverValue: unknown;
  clientValue: unknown;
  serverVersion: number | null;
  clientVersion: number | null;
  isSafetyCritical: boolean;
  detectedAt: Date;
}

export interface ApplyUpdateInput {
  orgId: string;
  table: string;
  recordId: string;
  data: unknown;
  baseVersion: number;
  user?: string | null;
  device?: string | null;
  clientTimestamp?: Date | null;
}

export type ApplyConflictOutcome =
  | { status: "applied"; newVersion: number }
  | { status: "not_found" }
  | { status: "conflict"; conflict: ConflictRecord };

// ── Helpers ──────────────────────────────────────────────────────────────

function safeJsonParse(value: string | null): unknown {
  if (value === null) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

type SyncConflictRow = typeof syncConflicts.$inferSelect;

function toConflictRecord(
  row: SyncConflictRow,
  clientValue: unknown,
  serverValue: unknown
): ConflictRecord {
  return {
    conflictId: row.id,
    table: row.tableName,
    recordId: row.recordId,
    field: row.fieldName ?? null,
    serverValue,
    clientValue,
    serverVersion: row.serverVersion ?? null,
    clientVersion: row.localVersion ?? null,
    isSafetyCritical: row.isSafetyCritical ?? false,
    detectedAt: row.createdAt ?? new Date(),
  };
}

/**
 * Client-supplied work-order changes: a partial of the insert schema with
 * the identity / server-managed columns stripped so a device can never
 * tamper with org scoping or the version counter.
 */
const workOrderUpdateSchema = insertWorkOrderSchema
  .omit({
    orgId: true,
    version: true,
    lastModifiedBy: true,
    lastModifiedDevice: true,
  })
  .partial();

// ── Core: apply a guarded optimistic update ──────────────────────────────

export async function applyOptimisticUpdate(
  input: ApplyUpdateInput
): Promise<ApplyConflictOutcome> {
  if (!isConflictEnabledTable(input.table)) {
    throw new ConflictTableNotAllowedError(input.table);
  }

  // Phase 1: work_orders is the only enabled table.
  return applyWorkOrderUpdate(input);
}

async function applyWorkOrderUpdate(input: ApplyUpdateInput): Promise<ApplyConflictOutcome> {
  const parsed = workOrderUpdateSchema.safeParse(input.data);
  if (!parsed.success) {
    throw new ConflictPayloadError(`Invalid work order update payload: ${parsed.error.message}`);
  }
  const updateData = parsed.data;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(workOrders)
      .set({
        ...updateData,
        version: input.baseVersion + 1,
        lastModifiedBy: input.user ?? null,
        lastModifiedDevice: input.device ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workOrders.id, input.recordId),
          eq(workOrders.orgId, input.orgId),
          eq(workOrders.version, input.baseVersion)
        )
      )
      .returning();

    if (updated) {
      return {
        status: "applied",
        newVersion: updated.version ?? input.baseVersion + 1,
      };
    }

    // No row matched the (id, org, version) guard. Distinguish a stale
    // write from a record that simply isn't in this caller's scope.
    const [current] = await tx
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, input.recordId), eq(workOrders.orgId, input.orgId)));

    if (!current) {
      return { status: "not_found" };
    }

    const changedFields = Object.keys(updateData);
    const isSafetyCritical = changedFields.some((field) =>
      SAFETY_CRITICAL_FIELDS.work_orders.has(field)
    );

    const [persisted] = await tx
      .insert(syncConflicts)
      .values({
        orgId: input.orgId,
        tableName: "work_orders",
        recordId: input.recordId,
        fieldName: null,
        localValue: JSON.stringify(updateData),
        localVersion: input.baseVersion,
        localTimestamp: input.clientTimestamp ?? new Date(),
        localUser: input.user ?? null,
        localDevice: input.device ?? null,
        serverValue: JSON.stringify(current),
        serverVersion: current.version ?? null,
        serverTimestamp: current.updatedAt ?? null,
        serverUser: current.lastModifiedBy ?? null,
        serverDevice: current.lastModifiedDevice ?? null,
        resolutionStrategy: isSafetyCritical ? "manual" : "lww",
        resolved: false,
        isSafetyCritical,
      })
      .returning();

    if (!persisted) {
      throw new Error("Failed to persist sync conflict");
    }

    return {
      status: "conflict",
      conflict: toConflictRecord(persisted, updateData, current),
    };
  });
}

// ── Read: pending (unresolved) conflicts for a scope ─────────────────────

export async function getPendingConflicts(orgId: string): Promise<ConflictRecord[]> {
  const rows = await db
    .select()
    .from(syncConflicts)
    .where(and(eq(syncConflicts.orgId, orgId), eq(syncConflicts.resolved, false)));

  return rows.map((row) =>
    toConflictRecord(row, safeJsonParse(row.localValue), safeJsonParse(row.serverValue))
  );
}

// ── Resolve a single conflict (scoped) ───────────────────────────────────

/**
 * Marks a conflict resolved. Returns false when the conflict does not
 * exist in the caller's scope or is already resolved, so the route can
 * surface a 404 instead of silently succeeding cross-tenant.
 */
export async function manuallyResolveConflict(
  conflictId: string,
  resolvedValue: unknown,
  resolvedBy: string,
  orgId: string
): Promise<boolean> {
  const [updated] = await db
    .update(syncConflicts)
    .set({
      resolved: true,
      resolvedValue: JSON.stringify(resolvedValue),
      resolvedBy,
      resolvedAt: new Date(),
    })
    .where(
      and(
        eq(syncConflicts.id, conflictId),
        eq(syncConflicts.orgId, orgId),
        eq(syncConflicts.resolved, false)
      )
    )
    .returning();

  return Boolean(updated);
}

// ── Bulk read for auto-resolve (scoped) ──────────────────────────────────

export async function getUnresolvedConflictsByIds(
  orgId: string,
  conflictIds: string[]
): Promise<SyncConflictRow[]> {
  if (conflictIds.length === 0) {
    return [];
  }
  return db
    .select()
    .from(syncConflicts)
    .where(
      and(
        inArray(syncConflicts.id, conflictIds),
        eq(syncConflicts.orgId, orgId),
        eq(syncConflicts.resolved, false)
      )
    );
}
