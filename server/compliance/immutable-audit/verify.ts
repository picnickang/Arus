/**
 * Audit Chain Verification
 *
 * Verify the cryptographic integrity of the audit trail.
 */

import { db } from "../../db";
import { immutableAuditTrail } from "@shared/schema-runtime";
import { eq, and, gte, lte } from "drizzle-orm";
import { computeAuditHash, parseJsonField } from "./hashing";
import type { ChainVerificationResult } from "./types";

/**
 * Verify the integrity of the audit chain
 * Returns details about chain validity and any tampering detected
 */
export async function verifyAuditChain(
  orgId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ChainVerificationResult> {
  const conditions = [eq(immutableAuditTrail.orgId, orgId)];

  if (startDate) {
    conditions.push(gte(immutableAuditTrail.eventTimestamp, startDate));
  }

  if (endDate) {
    conditions.push(lte(immutableAuditTrail.eventTimestamp, endDate));
  }

  const records = await db
    .select()
    .from(immutableAuditTrail)
    .where(and(...conditions))
    .orderBy(immutableAuditTrail.eventTimestamp);

  if (records.length === 0) {
    return { valid: true, recordsVerified: 0 };
  }

  let expectedPrevHash: string | null = null;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;

    if (record.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        recordsVerified: i,
        brokenAt: i,
        brokenRecordId: record.id,
        error: `Hash chain broken at record ${i}: expected prevHash ${expectedPrevHash}, got ${record.prevHash}`,
      };
    }

    const computedHash = computeAuditHash(
      record.prevHash,
      record.eventTimestamp as Date,
      record.entityType,
      record.entityId,
      record.eventCategory,
      record.eventType,
      record.performedBy,
      parseJsonField(record.previousState),
      parseJsonField(record.newState)
    );

    if (computedHash !== record.hash) {
      return {
        valid: false,
        recordsVerified: i,
        brokenAt: i,
        brokenRecordId: record.id,
        error: `Hash mismatch at record ${i}: computed ${computedHash}, stored ${record.hash}`,
      };
    }

    expectedPrevHash = record.hash;
  }

  return {
    valid: true,
    recordsVerified: records.length,
  };
}
