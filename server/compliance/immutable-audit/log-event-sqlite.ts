/**
 * SQLite Audit Event Logging
 *
 * Uses BEGIN IMMEDIATE for exclusive write locking and chain integrity.
 */

import { libsqlClient } from "../../db";
import { computeAuditHash } from "./hashing";
import type { AuditEventInput, AuditRecord } from "./types";

/**
 * Log audit event with SQLite exclusive transaction for chain integrity
 */
export async function logEventSqlite(input: AuditEventInput): Promise<AuditRecord> {
  if (!libsqlClient) {
    throw new Error("SQLite client not available in local mode");
  }

  const id = crypto.randomUUID();

  try {
    await libsqlClient.execute("BEGIN IMMEDIATE");

    const eventTimestamp = new Date();
    const serverTimestamp = new Date();

    const latestResult = await libsqlClient.execute({
      sql: `SELECT hash FROM immutable_audit_trail 
            WHERE org_id = ? 
            ORDER BY event_timestamp DESC 
            LIMIT 1`,
      args: [input.orgId],
    });

    const prevHash = (latestResult.rows[0]?.hash as string | null) ?? null;

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

    await libsqlClient.execute({
      sql: `INSERT INTO immutable_audit_trail (
        id, org_id, event_category, event_type, entity_type, entity_id,
        previous_state, new_state, changed_fields, performed_by, performed_by_type,
        performed_by_name, performed_by_role, ip_address, device_id, vessel_id,
        event_timestamp, server_timestamp, prev_hash, hash,
        compliance_standard, retention_required, retention_expires_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.orgId,
        input.eventCategory,
        input.eventType,
        input.entityType,
        input.entityId,
        input.previousState ? JSON.stringify(input.previousState) : null,
        input.newState ? JSON.stringify(input.newState) : null,
        input.changedFields ? JSON.stringify(input.changedFields) : null,
        input.performedBy,
        input.performedByType ?? "user",
        input.performedByName ?? null,
        input.performedByRole ?? null,
        input.ipAddress ?? null,
        input.deviceId ?? null,
        input.vesselId ?? null,
        eventTimestamp.toISOString(),
        serverTimestamp.toISOString(),
        prevHash,
        hash,
        input.complianceStandard ?? null,
        (input.retentionRequired ?? true) ? 1 : 0,
        input.retentionExpiresAt?.toISOString() ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    });

    await libsqlClient.execute("COMMIT");

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
    await libsqlClient.execute("ROLLBACK");
    throw error;
  }
}
