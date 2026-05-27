/**
 * Audit Hash Computation
 *
 * SHA-256 hash chaining for tamper-evident audit records.
 */

import { createHash } from "node:crypto";

/**
 * Compute SHA-256 hash of audit record content for chain integrity
 *
 * IMPORTANT: changedFields is intentionally excluded from the hash chain.
 * The hash depends only on: prevHash, orgId, timestamp, entityType,
 * entityId, eventCategory, eventType, performedBy, previousState,
 * newState. changedFields is derived metadata computed from state
 * diffs, not source data.
 *
 * LR-3.5 / AUD-2: `orgId` is now part of the hashed payload. Before
 * this change two tenants could in principle collide on
 * (entityType, entityId, eventCategory, eventType, performedBy,
 * timestamp) — entityId is org-namespaced in practice but the chain
 * verifier had no domain reason to trust that, so a misconfigured
 * insertion or a cross-tenant replay could pass `verify()` against
 * the wrong tenant's chain. Binding orgId into the hash forecloses
 * that class of confusion.
 *
 * Backfill note: any chain row produced before this change has a
 * hash computed without orgId; `verify.ts` must pass the historical
 * orgId field through so re-verification still passes. Rolling-cut
 * verification (new chain starts after deploy) is the cleanest
 * upgrade path; the existing pre-LR-3.5 chain remains
 * cryptographically valid but is not interoperable with the new
 * hashing rule.
 */
export const AUDIT_HASH_VERSION_CURRENT = 2 as const;

export function computeAuditHash(
  prevHash: string | null,
  orgId: string,
  eventTimestamp: Date,
  entityType: string,
  entityId: string,
  eventCategory: string,
  eventType: string,
  performedBy: string,
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>,
  hashVersion: number = AUDIT_HASH_VERSION_CURRENT
): string {
  // LR-3.5 / AUD-2 (Task #208): version-dispatched hash.
  //   v1: legacy pre-orgId payload — kept verbatim so historical rows
  //       written before this change still verify byte-for-byte.
  //   v2: current — binds `orgId` into the payload.
  const payload =
    hashVersion === 1
      ? {
          prevHash,
          timestamp: eventTimestamp.toISOString(),
          entityType,
          entityId,
          eventCategory,
          eventType,
          performedBy,
          previousState: previousState ? JSON.stringify(previousState) : null,
          newState: newState ? JSON.stringify(newState) : null,
        }
      : {
          prevHash,
          orgId,
          timestamp: eventTimestamp.toISOString(),
          entityType,
          entityId,
          eventCategory,
          eventType,
          performedBy,
          previousState: previousState ? JSON.stringify(previousState) : null,
          newState: newState ? JSON.stringify(newState) : null,
        };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Generate deterministic lock key from orgId for PostgreSQL advisory locks
 * Converts string orgId to 32-bit integer
 */
export function computeLockKey(orgId: string): number {
  let hash = 0;
  for (let i = 0; i < orgId.length; i++) {
    const char = orgId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Safely parse JSON field that might be string or object
 */
export function parseJsonField(field: unknown): Record<string, unknown> | undefined {
  if (!field) {
    return undefined;
  }

  if (typeof field === "object") {
    return field as Record<string, unknown>;
  }

  if (typeof field === "string") {
    try {
      return JSON.parse(field);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Parse changedFields - handles both PostgreSQL arrays and SQLite JSON strings
 */
export function parseChangedFields(field: unknown): string[] | undefined {
  if (!field) {
    return undefined;
  }

  if (Array.isArray(field)) {
    return field;
  }

  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}
