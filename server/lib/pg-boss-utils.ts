/**
 * pg-boss helpers shared by background-jobs.ts and its cron-schedule
 * modules (extracted verbatim to keep background-jobs.ts under the
 * long-file ratchet).
 */

import type PgBoss from "pg-boss";

/**
 * Task #88: pull the tenant `orgId` out of a job payload if present.
 * Convention: every tenant-scoped job packs `{ orgId: "...", ... }` into
 * its data (matches the `pgboss-trace` shape). Returns `undefined` for
 * fleet-wide jobs that intentionally have no tenant scope.
 */
export function extractOrgId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const candidate = (data as Record<string, unknown>)["orgId"];
  if (typeof candidate === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(candidate)) {
    return candidate;
  }
  return undefined;
}

/**
 * pg-boss v10 requires queues to be created explicitly before
 * `schedule()` or `send()` will accept them. `createQueue` is
 * idempotent in normal cases but throws on a true race; we treat
 * any "already exists" surface as success so a restart never
 * surfaces a spurious warning.
 */
export async function ensureQueue(boss: PgBoss, queueName: string): Promise<void> {
  try {
    await boss.createQueue(queueName);
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      return;
    }
    throw err;
  }
}
