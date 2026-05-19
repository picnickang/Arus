import { and, asc, eq, lte, sql } from "drizzle-orm";
import { eventOutbox } from "../../../shared/schema/sync.js";
import { db } from "../../db.js";
import type { EnqueueOutboxInput } from "./types.js";
import { backoffMs, MAX_ATTEMPTS } from "./backoff.js";

export { backoffMs } from "./backoff.js";

// Drizzle PgDatabase / PgTransaction types are wide; accept any tx-like
// object that exposes the same query builder surface as `db`.
export type TxOrDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface OutboxRow {
  id: string;
  eventId: string;
  eventType: string;
  orgId: string;
  aggregateId: string | null;
  aggregateType: string | null;
  payload: unknown;
  occurredAt: Date;
  status: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date;
  dispatchedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
}

/**
 * Insert one outbox row inside the caller's transaction (or, if no tx is
 * provided, on the default connection — best-effort, not transactional).
 *
 * Idempotent on `eventId`: a duplicate envelope is a no-op (ON CONFLICT
 * DO NOTHING), which keeps the bridge subscriber safe to call alongside
 * inline enqueues.
 */
export async function enqueueOutbox(
  input: EnqueueOutboxInput,
  tx?: TxOrDb
): Promise<void> {
  const client = tx ?? db;
  await client
    .insert(eventOutbox)
    .values({
      eventId: input.eventId,
      eventType: input.eventType,
      orgId: input.orgId,
      aggregateId: input.aggregateId ?? null,
      aggregateType: input.aggregateType ?? null,
      payload: input.payload as never,
      occurredAt: input.occurredAt ?? new Date(),
    })
    .onConflictDoNothing({ target: eventOutbox.eventId });
}

/**
 * Claim a batch of pending rows for dispatch.
 *
 * Per-tenant ordering is a hard invariant: within an `orgId`, events MUST
 * be published in `next_attempt_at, created_at` order even when multiple
 * worker replicas race for the queue. The `NOT EXISTS` clause is the
 * teeth — we refuse to claim any `pending` row whose `orgId` already has
 * a row in `dispatching`. Combined with `FOR UPDATE SKIP LOCKED`, this
 * gives us: across tenants → parallel; within a tenant → strictly
 * serialised across replicas.
 *
 * Rows transition `pending → dispatching` atomically and record
 * `dispatched_at` so the stale-row reaper can distinguish a genuinely
 * stuck dispatch from a recently-claimed one (without overloading
 * `next_attempt_at`, which is for backoff).
 */
export async function claimPendingBatch(
  limit: number,
  now: Date = new Date()
): Promise<OutboxRow[]> {
  const rows = await db.execute(sql`
    WITH claimed AS (
      SELECT eo.id
      FROM ${eventOutbox} eo
      WHERE eo.status = 'pending'
        AND eo.next_attempt_at <= ${now}
        AND NOT EXISTS (
          SELECT 1 FROM ${eventOutbox} blocker
          WHERE blocker.org_id = eo.org_id
            AND blocker.status = 'dispatching'
        )
      ORDER BY eo.next_attempt_at ASC, eo.created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE ${eventOutbox}
    SET status = 'dispatching',
        attempts = ${eventOutbox.attempts} + 1,
        dispatched_at = ${now}
    FROM claimed
    WHERE ${eventOutbox.id} = claimed.id
    RETURNING ${eventOutbox.id} AS id,
              ${eventOutbox.eventId} AS "eventId",
              ${eventOutbox.eventType} AS "eventType",
              ${eventOutbox.orgId} AS "orgId",
              ${eventOutbox.aggregateId} AS "aggregateId",
              ${eventOutbox.aggregateType} AS "aggregateType",
              ${eventOutbox.payload} AS payload,
              ${eventOutbox.occurredAt} AS "occurredAt",
              ${eventOutbox.status} AS status,
              ${eventOutbox.attempts} AS attempts,
              ${eventOutbox.lastError} AS "lastError",
              ${eventOutbox.nextAttemptAt} AS "nextAttemptAt",
              ${eventOutbox.dispatchedAt} AS "dispatchedAt",
              ${eventOutbox.publishedAt} AS "publishedAt",
              ${eventOutbox.createdAt} AS "createdAt"
  `);
  return (rows as unknown as { rows?: OutboxRow[] }).rows ?? (rows as unknown as OutboxRow[]);
}

// Terminal transitions are guarded by `status='dispatching'` so a late
// completion after the reaper requeued a row cannot silently overwrite
// the new lifecycle (which would lose the duplicate-dispatch signal and
// could mark a still-pending row as published).
export async function markPublished(id: string, when: Date = new Date()): Promise<void> {
  await db
    .update(eventOutbox)
    .set({ status: "published", publishedAt: when, lastError: null, dispatchedAt: null })
    .where(and(eq(eventOutbox.id, id), eq(eventOutbox.status, "dispatching")));
}

export async function markFailed(
  id: string,
  attempts: number,
  error: string,
  now: Date = new Date()
): Promise<void> {
  const isDead = attempts >= MAX_ATTEMPTS;
  await db
    .update(eventOutbox)
    .set({
      status: isDead ? "dead" : "pending",
      lastError: error.slice(0, 4_000),
      nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
      dispatchedAt: null,
    })
    .where(and(eq(eventOutbox.id, id), eq(eventOutbox.status, "dispatching")));
}

/**
 * Reset rows whose dispatch has been in flight longer than `staleMs`.
 * Compares against `dispatched_at` (set at claim time), NOT
 * `next_attempt_at` — the latter is the backoff schedule and is not
 * advanced by claim, so reaping on it would prematurely requeue
 * recently-claimed work that just happens to have an old retry stamp.
 */
export async function reapStaleDispatching(staleMs: number, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - staleMs);
  const result = await db
    .update(eventOutbox)
    .set({ status: "pending", nextAttemptAt: now, dispatchedAt: null })
    .where(
      and(
        eq(eventOutbox.status, "dispatching"),
        lte(eventOutbox.dispatchedAt, cutoff)
      )
    );
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}

export async function countByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: eventOutbox.status, count: sql<number>`count(*)::int` })
    .from(eventOutbox)
    .groupBy(eventOutbox.status)
    .orderBy(asc(eventOutbox.status));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.count);
  return out;
}
