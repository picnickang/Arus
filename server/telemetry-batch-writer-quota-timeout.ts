/**
 * P0 #4 — isolated quota-increment timeout wrapper.
 *
 * Extracted from `telemetry-batch-writer.ts` so it can be unit-tested
 * without dragging the writer's transitive drizzle-pg / pool init into
 * the test runtime. The writer imports `withQuotaTimeout` from here
 * and uses it to bound every per-org `quotaService.incrementUsage(...)`
 * call after a successful batch write — see writer for the policy
 * (fail-open ingest, failure counted on
 * `arus_telemetry_quota_increment_failed_total{org_id,reason}`).
 */

export const QUOTA_INCREMENT_TIMEOUT_MS = 2_000;

export function withQuotaTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`quota_increment_timeout_${QUOTA_INCREMENT_TIMEOUT_MS}ms`)),
      QUOTA_INCREMENT_TIMEOUT_MS
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}
