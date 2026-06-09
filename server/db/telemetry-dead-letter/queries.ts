/**
 * Storage queries for the telemetry dead-letter queue
 * (services/dead-letter-queue/repository.ts). Holds the raw `db` access so the
 * DLQ service depends on this storage module rather than the db handle
 * (hexagonal storage boundary). The service keeps its own PERSISTENCE_DISABLED
 * guard + fire-and-forget error logging; these helpers are the bare queries.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { telemetryDeadLetter } from "@shared/schema-runtime";

export interface DeadLetterPersistInput {
  id: string;
  queueName: string;
  payload: unknown;
  error: string;
  source: string;
  retryCount: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  lastRetryAt: Date | null;
}

export function insertDeadLetterRow(row: DeadLetterPersistInput): Promise<unknown> {
  return db.insert(telemetryDeadLetter).values(row);
}

export function deleteDeadLetterRow(queueName: string, id: string): Promise<unknown> {
  return db
    .delete(telemetryDeadLetter)
    .where(and(eq(telemetryDeadLetter.id, id), eq(telemetryDeadLetter.queueName, queueName)));
}

export function updateDeadLetterRetry(
  queueName: string,
  id: string,
  retryCount: number,
  lastRetryAt: Date | null,
): Promise<unknown> {
  return db
    .update(telemetryDeadLetter)
    .set({ retryCount, lastRetryAt })
    .where(and(eq(telemetryDeadLetter.id, id), eq(telemetryDeadLetter.queueName, queueName)));
}

export function deleteDeadLetterOlderThan(queueName: string, cutoff: Date): Promise<unknown> {
  return db
    .delete(telemetryDeadLetter)
    .where(
      and(
        eq(telemetryDeadLetter.queueName, queueName),
        sql`${telemetryDeadLetter.createdAt} < ${cutoff}`,
      ),
    );
}

export function deleteDeadLetterQueue(queueName: string): Promise<unknown> {
  return db
    .delete(telemetryDeadLetter)
    .where(eq(telemetryDeadLetter.queueName, queueName));
}

export function selectDeadLetterRows(queueName: string) {
  return db
    .select()
    .from(telemetryDeadLetter)
    .where(eq(telemetryDeadLetter.queueName, queueName));
}
