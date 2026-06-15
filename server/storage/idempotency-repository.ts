import { createHash } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db, isLocalMode } from "../db";
import { requestIdempotency } from "@shared/schema-runtime";
import { logger } from "../utils/logger";

const LOG_CTX = "IdempotencyRepository";

/**
 * Durable L2 store behind the in-memory idempotency cache, so replayed
 * mutations land on the cached first response even across server restarts —
 * the common case on vessels, where the outbox replays after connectivity
 * (and often the sidecar process) comes back.
 *
 * Driver notes: the pg table lacks org/hash columns and the sqlite table has
 * NOT NULL org columns, so the request hash travels inside the responseBody
 * wrapper (`{h, b}`) — identical on both drivers, zero schema changes.
 */

export interface StoredIdempotentResponse {
  statusCode: number;
  body: unknown;
  requestHash: string | undefined;
}

interface StoredWrapper {
  h?: string;
  b: unknown;
}

// schema-runtime picks the drizzle table matching the deployment mode (pg in
// cloud, sqlite on vessels); the sqlite-only NOT NULL columns are added as
// loose values below because the shared type surface is the pg variant.
const table = requestIdempotency;

export function hashIdempotentRequest(fullKey: string, body: unknown): string {
  const bodyText = body === undefined ? "" : JSON.stringify(body);
  // Salting with the full key keeps hashes unique per key, which sidesteps the
  // UNIQUE(request_hash) constraint in the sqlite DDL while still detecting
  // same-key/different-body reuse (same key → same salt → comparable hashes).
  return createHash("sha256").update(`${fullKey}\n${bodyText}`).digest("hex");
}

export async function getStoredResponse(
  fullKey: string
): Promise<StoredIdempotentResponse | undefined> {
  const rows = await db
    .select({
      responseStatus: table.responseStatus,
      responseBody: table.responseBody,
    })
    .from(table)
    .where(and(eq(table.key, fullKey), gt(table.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || row.responseStatus === null || row.responseBody === null) {
    return undefined;
  }

  try {
    const wrapper = JSON.parse(row.responseBody) as StoredWrapper;
    return {
      statusCode: row.responseStatus,
      body: wrapper.b,
      requestHash: wrapper.h,
    };
  } catch (error) {
    logger.warn(
      LOG_CTX,
      `Discarding unparseable idempotency record for key ${fullKey.slice(0, 48)}: ${String(error)}`
    );
    return undefined;
  }
}

export interface IdempotencyStoreEntry {
  fullKey: string;
  orgId: string;
  idempotencyKey: string;
  requestHash: string;
  statusCode: number;
  body: unknown;
  ttlMs: number;
}

/**
 * Pure values builder, exported so the driver-conditional shape is directly
 * testable against both tables: the sqlite DDL has NOT NULL org_id /
 * idempotency_key / request_hash columns that the pg table lacks
 * (see tests/unit/idempotency-dual-driver.test.ts).
 */
export function buildIdempotencyInsertValues(
  entry: IdempotencyStoreEntry,
  isLocal: boolean,
  now: Date = new Date()
): Record<string, unknown> {
  const expiresAt = new Date(now.getTime() + entry.ttlMs);
  const responseBody = JSON.stringify({
    h: entry.requestHash,
    b: entry.body,
  } satisfies StoredWrapper);

  const values: Record<string, unknown> = {
    key: entry.fullKey,
    responseStatus: entry.statusCode,
    responseBody,
    expiresAt,
    createdAt: now,
  };
  if (isLocal) {
    // NOT NULL columns that only exist in the sqlite DDL.
    values["orgId"] = entry.orgId;
    values["idempotencyKey"] = entry.idempotencyKey;
    values["requestHash"] = entry.requestHash;
  }
  return values;
}

export async function storeResponse(entry: IdempotencyStoreEntry): Promise<void> {
  const now = new Date();
  const values = buildIdempotencyInsertValues(entry, isLocalMode, now);

  // Upsert (not insert-or-nothing): a successful completion must overwrite the
  // caller's own pending claim row (see claimKey) to convert it into the stored
  // response. With insert-or-nothing the claim would shadow the response and
  // cross-replica retries would 425 forever until the claim expired. The set
  // fields are recomputed from the typed entry (not read back off the untyped
  // values record) so no casts are needed.
  const responseBody = JSON.stringify({
    h: entry.requestHash,
    b: entry.body,
  } satisfies StoredWrapper);

  await db
    .insert(table)
    .values(values as typeof table.$inferInsert)
    .onConflictDoUpdate({
      target: table.key,
      set: {
        responseStatus: entry.statusCode,
        responseBody,
        expiresAt: new Date(now.getTime() + entry.ttlMs),
      },
    });
}

/**
 * Pending-claim TTL. Bounds how long a claim survives a hard process crash
 * (graceful failures release the claim immediately via releaseClaim, and
 * success converts it via storeResponse). It MUST exceed the longest realistic
 * handler duration: if a claim expired while its handler was still running, the
 * reaper could drop the row and a concurrent retry on another replica would
 * re-run the mutation. 15 min sits comfortably above any HTTP handler (which a
 * proxy/LB timeout would sever — firing `close` → releaseClaim — long before).
 */
export const CLAIM_TTL_MS = 15 * 60 * 1000;

export interface IdempotencyClaimEntry {
  fullKey: string;
  orgId: string;
  idempotencyKey: string;
  requestHash: string;
}

/**
 * Values for a pending durable claim: a row with a NULL response, so
 * getStoredResponse treats it as "not complete yet" while it reserves the key.
 * Mirrors buildIdempotencyInsertValues' driver-conditional shape (sqlite has
 * NOT NULL org_id / idempotency_key / request_hash columns the pg table lacks).
 */
export function buildIdempotencyClaimValues(
  entry: IdempotencyClaimEntry,
  isLocal: boolean,
  now: Date = new Date()
): Record<string, unknown> {
  const values: Record<string, unknown> = {
    key: entry.fullKey,
    responseStatus: null,
    responseBody: null,
    expiresAt: new Date(now.getTime() + CLAIM_TTL_MS),
    createdAt: now,
  };
  if (isLocal) {
    values["orgId"] = entry.orgId;
    values["idempotencyKey"] = entry.idempotencyKey;
    values["requestHash"] = entry.requestHash;
  }
  return values;
}

/**
 * Durable cross-replica reservation. Inserts a pending row keyed by fullKey;
 * the first caller (across all cloud replicas sharing one Postgres) lands the
 * row and returns true, later callers conflict and return false. Returning the
 * inserted key distinguishes a win (row returned) from a loss (empty) under
 * insert-or-nothing. Pairs with storeResponse (completion) and releaseClaim
 * (failure).
 */
export async function claimKey(entry: IdempotencyClaimEntry): Promise<boolean> {
  const values = buildIdempotencyClaimValues(entry, isLocalMode);

  const inserted = await db
    .insert(table)
    .values(values as typeof table.$inferInsert)
    .onConflictDoNothing({ target: table.key })
    .returning({ key: table.key });

  return inserted.length > 0;
}

/**
 * Release a claim we won but did not complete (handler error, non-2xx, or
 * client abort), so a retry — here or on another replica — can re-claim at once
 * instead of waiting for the claim to expire. Scoped to still-pending rows
 * (NULL response) so a late `close` event can never delete a stored response.
 */
export async function releaseClaim(fullKey: string): Promise<void> {
  await db.delete(table).where(and(eq(table.key, fullKey), isNull(table.responseStatus)));
}

export async function deleteExpiredResponses(): Promise<void> {
  await db.delete(table).where(lt(table.expiresAt, new Date()));
}
