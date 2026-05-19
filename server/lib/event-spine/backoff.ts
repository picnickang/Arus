export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_CAP_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 12;

export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_CAP_MS);
}
