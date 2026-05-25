/**
 * Work Order History Hash Chain Service
 *
 * Provides tamper-evident hash chaining for work order history records.
 * Each entry includes a SHA-256 hash of the previous entry, creating an
 * immutable chain that can be verified for data integrity.
 *
 * Architecture:
 * - Uses PostgreSQL advisory locks or SQLite BEGIN IMMEDIATE for concurrency protection
 * - Hash includes: previous_hash + org_id + work_order_id + event_type + field_name +
 *   previous_value + new_value + description + performed_by + metadata + created_at
 * - Sequence numbers are scoped to org_id + work_order_id for efficient verification
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Compliance:WorkOrderHistoryHash.service");
import crypto from "node:crypto";
import { db } from "../db";
import { workOrderHistory } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

interface HashChainEntry {
  orgId: string;
  workOrderId: string;
  eventType: string;
  previousValue?: string | null;
  newValue?: string | null;
  fieldName?: string | null;
  description: string;
  performedBy: string;
  performedByName?: string | null;
  metadata?: string | null;
}

interface VerificationResult {
  isValid: boolean;
  totalEntries: number;
  verifiedCount: number;
  firstInvalidEntry?: {
    id: string;
    sequenceNumber: number;
    expectedHash: string;
    actualHash: string;
  };
  chainStartDate?: Date;
  chainEndDate?: Date;
}

class WorkOrderHistoryHashService {
  private static instance: WorkOrderHistoryHashService;

  private constructor() {}

  static getInstance(): WorkOrderHistoryHashService {
    if (!WorkOrderHistoryHashService.instance) {
      WorkOrderHistoryHashService.instance = new WorkOrderHistoryHashService();
    }
    return WorkOrderHistoryHashService.instance;
  }

  /**
   * Compute SHA-256 hash for a work order history entry
   */
  private computeHash(previousHash: string | null, entry: HashChainEntry, createdAt: Date): string {
    const payload = JSON.stringify({
      previousHash: previousHash || "GENESIS",
      orgId: entry.orgId,
      workOrderId: entry.workOrderId,
      eventType: entry.eventType,
      previousValue: entry.previousValue || null,
      newValue: entry.newValue || null,
      fieldName: entry.fieldName || null,
      description: entry.description,
      performedBy: entry.performedBy,
      performedByName: entry.performedByName || null,
      metadata: entry.metadata || null,
      createdAt: createdAt.toISOString(),
    });

    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Acquire PostgreSQL advisory lock for work order history chain
   * Uses a different lock namespace than the immutable audit trail
   */
  private async acquireLock(orgId: string, workOrderId: string): Promise<void> {
    const lockKey = this.computeLockKey(orgId, workOrderId);
    await db.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
  }

  /**
   * Compute a numeric lock key from org_id + work_order_id
   * Uses a different hash range than immutable audit to avoid collisions
   */
  private computeLockKey(orgId: string, workOrderId: string): number {
    // NOSONAR: S4790 - MD5 used only for numeric lock key generation, not for security
    const hash = crypto.createHash("md5").update(`wo_history:${orgId}:${workOrderId}`).digest();
    // Use first 4 bytes as int32, offset by 1 billion to avoid audit trail locks
    return hash.readInt32BE(0) + 1000000000;
  }

  /**
   * Create a new hash-chained work order history entry
   * This method uses createEntryWithTransaction internally for safety
   *
   * CRITICAL: Hash is computed using the PERSISTED timestamp from the database,
   * not an in-memory timestamp, to ensure deterministic verification.
   */
  async createEntry(entry: HashChainEntry): Promise<{
    id: string;
    sequenceNumber: number;
    entryHash: string;
    previousHash: string | null;
  }> {
    // Delegate to transaction-based method for proper locking and timestamp handling
    return this.createEntryWithTransaction(entry);
  }

  /**
   * Create a hash-chained entry within a transaction wrapper
   * This ensures proper locking and rollback on failure
   *
   * CRITICAL: Hash is computed using the PERSISTED timestamp from the database,
   * not an in-memory timestamp, to ensure deterministic verification.
   */
  async createEntryWithTransaction(entry: HashChainEntry): Promise<{
    id: string;
    sequenceNumber: number;
    entryHash: string;
    previousHash: string | null;
  }> {
    // Use raw SQL transaction for PostgreSQL
    return db.transaction(async (tx) => {
      // Acquire advisory lock within transaction
      const lockKey = this.computeLockKey(entry.orgId, entry.workOrderId);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      // Get the last entry for this work order
      const lastEntries = await tx
        .select({
          id: workOrderHistory.id,
          sequenceNumber: workOrderHistory.sequenceNumber,
          entryHash: workOrderHistory.entryHash,
        })
        .from(workOrderHistory)
        .where(
          and(
            eq(workOrderHistory.orgId, entry.orgId),
            eq(workOrderHistory.workOrderId, entry.workOrderId)
          )
        )
        .orderBy(sql`${workOrderHistory.sequenceNumber} DESC`)
        .limit(1);

      const lastEntry = lastEntries[0];
      const previousHash = lastEntry?.entryHash ?? null;
      const sequenceNumber = (lastEntry?.sequenceNumber ?? 0) + 1;

      const id = crypto.randomUUID();

      // STEP 1: Insert entry WITHOUT entryHash (let DB set created_at)
      await tx.insert(workOrderHistory).values({
        id,
        orgId: entry.orgId,
        workOrderId: entry.workOrderId,
        eventType: entry.eventType,
        previousValue: entry.previousValue,
        newValue: entry.newValue,
        fieldName: entry.fieldName,
        description: entry.description,
        performedBy: entry.performedBy,
        performedByName: entry.performedByName,
        metadata: entry.metadata,
        sequenceNumber,
        previousHash,
        entryHash: null, // Will be set in step 3
      });

      // STEP 2: Fetch the PERSISTED timestamp from the database
      const insertedEntries = await tx
        .select({ createdAt: workOrderHistory.createdAt })
        .from(workOrderHistory)
        .where(eq(workOrderHistory.id, id))
        .limit(1);

      const persistedCreatedAt = insertedEntries[0]?.createdAt;
      if (!persistedCreatedAt) {
        throw new Error("Failed to retrieve persisted created_at timestamp");
      }

      // STEP 3: Compute hash using the PERSISTED timestamp
      const entryHash = this.computeHash(previousHash, entry, persistedCreatedAt);

      // STEP 4: Update the entry with the computed hash
      await tx.update(workOrderHistory).set({ entryHash }).where(eq(workOrderHistory.id, id));

      logger.info(`[WorkOrderHistoryHash] Created entry (tx): org=${entry.orgId}, wo=${entry.workOrderId}, seq=${sequenceNumber}`);

      return { id, sequenceNumber, entryHash, previousHash };
    });
  }

  /**
   * Verify the hash chain integrity for a specific work order
   */
  async verifyChain(orgId: string, workOrderId: string): Promise<VerificationResult> {
    const entries = await db
      .select()
      .from(workOrderHistory)
      .where(and(eq(workOrderHistory.orgId, orgId), eq(workOrderHistory.workOrderId, workOrderId)))
      .orderBy(workOrderHistory.sequenceNumber);

    if (entries.length === 0) {
      return {
        isValid: true,
        totalEntries: 0,
        verifiedCount: 0,
      };
    }

    let verifiedCount = 0;
    let expectedPreviousHash: string | null = null;

    for (const entry of entries) {
      // Skip entries without hash chain (legacy data before hash chaining was added)
      if (!entry.entryHash) {
        verifiedCount++;
        continue;
      }

      // Verify previous hash matches
      if (entry.previousHash !== expectedPreviousHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          verifiedCount,
          firstInvalidEntry: {
            id: entry.id,
            sequenceNumber: entry.sequenceNumber ?? 0,
            expectedHash: expectedPreviousHash ?? "GENESIS",
            actualHash: entry.previousHash ?? "null",
          },
          chainStartDate: entries[0]?.createdAt ?? undefined,
          chainEndDate: entries[entries.length - 1]?.createdAt ?? undefined,
        };
      }

      // Recompute hash and verify
      const computedHash = this.computeHash(
        entry.previousHash,
        {
          orgId: entry.orgId,
          workOrderId: entry.workOrderId,
          eventType: entry.eventType,
          previousValue: entry.previousValue,
          newValue: entry.newValue,
          fieldName: entry.fieldName,
          description: entry.description,
          performedBy: entry.performedBy,
          performedByName: entry.performedByName,
          metadata: entry.metadata,
        },
        entry.createdAt ?? new Date()
      );

      if (computedHash !== entry.entryHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          verifiedCount,
          firstInvalidEntry: {
            id: entry.id,
            sequenceNumber: entry.sequenceNumber ?? 0,
            expectedHash: computedHash,
            actualHash: entry.entryHash,
          },
          chainStartDate: entries[0]?.createdAt ?? undefined,
          chainEndDate: entries[entries.length - 1]?.createdAt ?? undefined,
        };
      }

      expectedPreviousHash = entry.entryHash;
      verifiedCount++;
    }

    return {
      isValid: true,
      totalEntries: entries.length,
      verifiedCount,
      chainStartDate: entries[0]?.createdAt ?? undefined,
      chainEndDate: entries[entries.length - 1]?.createdAt ?? undefined,
    };
  }

  /**
   * Verify all hash chains for an organization
   */
  async verifyAllChains(orgId: string): Promise<{
    isValid: boolean;
    totalWorkOrders: number;
    totalEntries: number;
    invalidWorkOrders: Array<{
      workOrderId: string;
      result: VerificationResult;
    }>;
  }> {
    // Get all unique work orders with history for this org
    const workOrders = await db
      .selectDistinct({ workOrderId: workOrderHistory.workOrderId })
      .from(workOrderHistory)
      .where(eq(workOrderHistory.orgId, orgId));

    const invalidWorkOrders: Array<{
      workOrderId: string;
      result: VerificationResult;
    }> = [];
    let totalEntries = 0;

    for (const wo of workOrders) {
      const result = await this.verifyChain(orgId, wo.workOrderId);
      totalEntries += result.totalEntries;

      if (!result.isValid) {
        invalidWorkOrders.push({
          workOrderId: wo.workOrderId,
          result,
        });
      }
    }

    return {
      isValid: invalidWorkOrders.length === 0,
      totalWorkOrders: workOrders.length,
      totalEntries,
      invalidWorkOrders,
    };
  }

  /**
   * Get chain statistics for a work order
   */
  async getChainStats(
    orgId: string,
    workOrderId: string
  ): Promise<{
    entryCount: number;
    hasHashChain: boolean;
    firstEntry?: Date;
    lastEntry?: Date;
    latestSequence?: number;
  }> {
    const entries = await db
      .select({
        count: sql<number>`count(*)::int`,
        hasHash: sql<boolean>`bool_or(entry_hash IS NOT NULL)`,
        firstEntry: sql<Date>`min(created_at)`,
        lastEntry: sql<Date>`max(created_at)`,
        latestSequence: sql<number>`max(sequence_number)`,
      })
      .from(workOrderHistory)
      .where(and(eq(workOrderHistory.orgId, orgId), eq(workOrderHistory.workOrderId, workOrderId)));

    const stats = entries[0];
    return {
      entryCount: stats?.count ?? 0,
      hasHashChain: stats?.hasHash ?? false,
      firstEntry: stats?.firstEntry,
      lastEntry: stats?.lastEntry,
      latestSequence: stats?.latestSequence,
    };
  }
}

export const workOrderHistoryHashService = WorkOrderHistoryHashService.getInstance();
