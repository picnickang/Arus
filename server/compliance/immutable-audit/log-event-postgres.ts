/**
 * PostgreSQL Audit Event Logging
 *
 * Uses advisory locks for hash chain integrity across concurrent processes.
 */

import { pool } from "../../db";
import { computeAuditHash, computeLockKey } from "./hashing";
import type { AuditEventInput, AuditRecord } from "./types";

/**
 * Log audit event with PostgreSQL advisory lock for chain integrity
 */
export async function logEventPostgres(input: AuditEventInput): Promise<AuditRecord> {
  if (!pool) {
    throw new Error("PostgreSQL pool not available");
  }

  const id = crypto.randomUUID();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockKey = computeLockKey(input.orgId);
    await client.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);

    const eventTimestamp = new Date();
    const serverTimestamp = new Date();

    const latestResult = await client.query(
      `SELECT hash FROM immutable_audit_trail 
       WHERE org_id = $1 
       ORDER BY event_timestamp DESC 
       LIMIT 1`,
      [input.orgId]
    );
    const prevHash = latestResult.rows[0]?.hash ?? null;

    const hash = computeAuditHash(
      prevHash,
      eventTimestamp,
      input.entityType,
      input.entityId,
      input.eventCategory,
      input.eventType,
      input.performedBy,
      input.previousState,
      input.newState
    );

    await client.query(
      `INSERT INTO immutable_audit_trail (
        id, org_id, event_category, event_type, entity_type, entity_id,
        previous_state, new_state, changed_fields, performed_by, performed_by_type,
        performed_by_name, performed_by_role, ip_address, device_id, vessel_id,
        event_timestamp, server_timestamp, prev_hash, hash,
        compliance_standard, retention_required, retention_expires_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        id,
        input.orgId,
        input.eventCategory,
        input.eventType,
        input.entityType,
        input.entityId,
        input.previousState ? JSON.stringify(input.previousState) : null,
        input.newState ? JSON.stringify(input.newState) : null,
        input.changedFields ?? null,
        input.performedBy,
        input.performedByType ?? "user",
        input.performedByName ?? null,
        input.performedByRole ?? null,
        input.ipAddress ?? null,
        input.deviceId ?? null,
        input.vesselId ?? null,
        eventTimestamp,
        serverTimestamp,
        prevHash,
        hash,
        input.complianceStandard ?? null,
        input.retentionRequired ?? true,
        input.retentionExpiresAt ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );

    await client.query("COMMIT");

    return {
      id,
      orgId: input.orgId,
      eventCategory: input.eventCategory,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      previousState: input.previousState,
      newState: input.newState,
      changedFields: input.changedFields,
      performedBy: input.performedBy,
      performedByType: input.performedByType ?? "user",
      performedByName: input.performedByName,
      performedByRole: input.performedByRole,
      ipAddress: input.ipAddress,
      deviceId: input.deviceId,
      vesselId: input.vesselId,
      eventTimestamp,
      serverTimestamp,
      prevHash: prevHash ?? undefined,
      hash,
      complianceStandard: input.complianceStandard,
      retentionRequired: input.retentionRequired ?? true,
      retentionExpiresAt: input.retentionExpiresAt,
      metadata: input.metadata,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
