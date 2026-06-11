/**
 * Pure date helpers for the telemetry warehouse export.
 *
 * Extracted into a leaf module so unit tests can exercise the math without
 * pulling in `db`, object storage, or `@dsnp/parquetjs` transitively.
 */

/** UTC midnight + ISO date string for the day before `now` (UTC). */
export function previousUtcDate(now: Date): { dayStart: Date; dateStr: string } {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  return { dayStart, dateStr: dayStart.toISOString().slice(0, 10) };
}

/** Parse a YYYY-MM-DD string into the UTC-midnight Date it represents. */
export function dateStrToUtcStart(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date string (expected YYYY-MM-DD): ${dateStr}`);
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}
