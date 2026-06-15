/**
 * Monthly part-usage bucketing.
 *
 * Pure helper shared by the inventory storage implementations so the real (DB)
 * path and the typed adapter bucket recorded work-order consumption identically
 * — and so the logic is unit-testable without a database. Replaces the previous
 * `cryptoRandom`-simulated usage history (see #99 / auto-optimization).
 */

export interface UsageRow {
  quantityUsed: number | null;
  usedAt: Date | string | null;
  createdAt: Date | string | null;
}

/** Start (UTC) of the oldest month bucket for a `months`-length window ending in `now`. */
export function usageWindowStart(months: number, now: Date = new Date()): Date {
  const m = Math.max(1, Math.min(months, 60));
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (m - 1), 1));
}

/**
 * Aggregate consumption rows into a `months`-length array of monthly totals,
 * ordered oldest → newest. Each row is dated by `usedAt`, falling back to
 * `createdAt`; rows that are undated, unparseable, or fall outside the window are
 * ignored. `months` is clamped to [1, 60].
 */
export function bucketMonthlyUsage(
  rows: UsageRow[],
  months: number,
  now: Date = new Date()
): number[] {
  const m = Math.max(1, Math.min(months, 60));
  const windowStart = usageWindowStart(m, now);
  const buckets = new Array<number>(m).fill(0);
  for (const row of rows) {
    const when = row.usedAt ?? row.createdAt;
    if (!when) {
      continue;
    }
    const d = when instanceof Date ? when : new Date(when);
    if (Number.isNaN(d.getTime())) {
      continue;
    }
    const idx =
      (d.getUTCFullYear() - windowStart.getUTCFullYear()) * 12 +
      (d.getUTCMonth() - windowStart.getUTCMonth());
    if (idx >= 0 && idx < m) {
      buckets[idx] = (buckets[idx] ?? 0) + (row.quantityUsed ?? 0);
    }
  }
  return buckets;
}
