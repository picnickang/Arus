/**
 * Audit Hash Computation
 *
 * SHA-256 hash chaining for tamper-evident audit records.
 */

import { createHash } from 'node:crypto';

/**
 * Compute SHA-256 hash of audit record content for chain integrity
 * 
 * IMPORTANT: changedFields is intentionally excluded from the hash chain.
 * The hash depends only on: prevHash, timestamp, entityType, entityId,
 * eventCategory, eventType, performedBy, previousState, newState.
 * changedFields is derived metadata computed from state diffs, not source data.
 */
export function computeAuditHash(
  prevHash: string | null,
  eventTimestamp: Date,
  entityType: string,
  entityId: string,
  eventCategory: string,
  eventType: string,
  performedBy: string,
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>
): string {
  const hashInput = JSON.stringify({
    prevHash,
    timestamp: eventTimestamp.toISOString(),
    entityType,
    entityId,
    eventCategory,
    eventType,
    performedBy,
    previousState: previousState ? JSON.stringify(previousState) : null,
    newState: newState ? JSON.stringify(newState) : null,
  });

  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Generate deterministic lock key from orgId for PostgreSQL advisory locks
 * Converts string orgId to 32-bit integer
 */
export function computeLockKey(orgId: string): number {
  let hash = 0;
  for (let i = 0; i < orgId.length; i++) {
    const char = orgId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
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

  if (typeof field === 'object') {
    return field as Record<string, unknown>;
  }

  if (typeof field === 'string') {
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

  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) {return parsed;}
    } catch {
      return undefined;
    }
  }
  return undefined;
}
