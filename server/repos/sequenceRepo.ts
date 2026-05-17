// @ts-nocheck
/**
 * Sequence Repository
 * Provides atomic sequence number generation for MQTT entity events
 *
 * Uses database-level atomicity (INSERT ... ON CONFLICT UPDATE ... RETURNING)
 * to ensure monotonic sequence numbers across concurrent writes
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { safeSql } from "../utils/safeSql";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Repos:SequenceRepo");

/**
 * Generate next sequence number for a given (vesselId, entity) pair
 *
 * This is atomic and thread-safe - concurrent calls will never return the same sequence
 *
 * @param vesselId - The vessel identifier
 * @param entity - Entity type (work_order, alert, equipment, crew, maintenance)
 * @returns Next monotonic sequence number
 */
export async function nextSeq(vesselId: string, entity: string): Promise<number> {
  try {
    const result = await safeSql(
      db,
      sql`
      INSERT INTO entity_offsets (vessel_id, entity, seq)
      VALUES (${vesselId}, ${entity}, 1)
      ON CONFLICT (vessel_id, entity)
      DO UPDATE SET seq = entity_offsets.seq + 1
      RETURNING seq;
    `
    );

    // Extract sequence from result
    const row = Array.isArray((result as any)?.rows) ? (result as any).rows[0] : (result as any)[0];

    if (!row || row.seq === undefined) {
      throw new Error(`Failed to generate sequence for ${vesselId}:${entity}`);
    }

    return Number(row.seq);
  } catch (error) {
    logger.error(`[SequenceRepo] Error generating sequence for ${vesselId}:${entity}:`, undefined, error);
    throw error;
  }
}

/**
 * Get current sequence number without incrementing
 *
 * @param vesselId - The vessel identifier
 * @param entity - Entity type
 * @returns Current sequence number or 0 if not exists
 */
export async function getCurrentSeq(vesselId: string, entity: string): Promise<number> {
  try {
    const result = await safeSql(
      db,
      sql`
      SELECT seq FROM entity_offsets
      WHERE vessel_id = ${vesselId} AND entity = ${entity};
    `
    );

    const row = Array.isArray((result as any)?.rows) ? (result as any).rows[0] : (result as any)[0];

    return row ? Number(row.seq) : 0;
  } catch (error) {
    logger.error(`[SequenceRepo] Error fetching current sequence for ${vesselId}:${entity}:`, undefined, error);
    return 0;
  }
}

/**
 * Reset sequence to a specific value (use with caution!)
 *
 * @param vesselId - The vessel identifier
 * @param entity - Entity type
 * @param value - New sequence value
 */
export async function resetSeq(vesselId: string, entity: string, value: number): Promise<void> {
  try {
    await safeSql(
      db,
      sql`
      INSERT INTO entity_offsets (vessel_id, entity, seq)
      VALUES (${vesselId}, ${entity}, ${value})
      ON CONFLICT (vessel_id, entity)
      DO UPDATE SET seq = ${value};
    `
    );

    logger.warn(`[SequenceRepo] RESET sequence for ${vesselId}:${entity} to ${value}`);
  } catch (error) {
    logger.error(`[SequenceRepo] Error resetting sequence for ${vesselId}:${entity}:`, undefined, error);
    throw error;
  }
}
