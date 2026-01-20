/**
 * Transaction boundary helpers for multi-table operations
 * Ensures data integrity across complex operations
 */

import { db } from "../db";

/**
 * Execute multiple operations within a database transaction
 * Automatically rolls back on error
 */
export async function withTransaction<T>(operations: (tx: typeof db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    return operations(tx);
  });
}

/**
 * Transaction wrapper with error logging
 */
export async function safeTransaction<T>(
  operationName: string,
  operations: (tx: typeof db) => Promise<T>
): Promise<T> {
  try {
    return await withTransaction(operations);
  } catch (error) {
    console.error(`[Transaction ${operationName}] Failed:`, error);
    throw error;
  }
}
