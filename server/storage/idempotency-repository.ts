import { createHash } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
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

export async function storeResponse(entry: {
  fullKey: string;
  orgId: string;
  idempotencyKey: string;
  requestHash: string;
  statusCode: number;
  body: unknown;
  ttlMs: number;
}): Promise<void> {
  const now = new Date();
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
  if (isLocalMode) {
    // NOT NULL columns that only exist in the sqlite DDL.
    values["orgId"] = entry.orgId;
    values["idempotencyKey"] = entry.idempotencyKey;
    values["requestHash"] = entry.requestHash;
  }

  await db
    .insert(table)
    .values(values as typeof table.$inferInsert)
    .onConflictDoNothing({ target: table.key });
}

export async function deleteExpiredResponses(): Promise<void> {
  await db.delete(table).where(lt(table.expiresAt, new Date()));
}
