import { ApiError } from "@/lib/api-error";

/**
 * React Query `retry` predicate: never retry client errors (4xx). A 401/403/404
 * won't turn into a success by trying again, so retrying only fires redundant
 * requests — e.g. the pre-auth `/api/permissions/me` probe, which on a fresh
 * (unauthenticated) load otherwise storms the network log with repeated 401s.
 * Transient failures (network drop, 5xx, non-ApiError throws) still retry up to
 * `maxRetries`.
 */
export function retryUnlessClientError(maxRetries: number) {
  return (failureCount: number, error: unknown): boolean => {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      return false;
    }
    return failureCount <= maxRetries;
  };
}
