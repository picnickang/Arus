import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-error";
import { computeBackoffDelay } from "@/lib/backoff";
import { backendCircuit } from "@/lib/circuit-breaker";
import { toast } from "@/hooks/use-toast";
import {
  addConflict,
  getPendingOperations,
  getUnresolvedConflictOperationIds,
  isOnline,
  markOperationFailed,
  removeOperation,
  setLastSyncTime,
  type PendingOperation,
} from "@/lib/offline-sync";
import {
  formatQuotaExceededMessage,
  inspectQuotaWarning,
  notifyQuotaExceeded,
  parseQuotaExceeded,
} from "@/lib/tenant-quota-notifications";
import {
  createHeaders,
  DEFAULT_GET_TIMEOUT_MS,
  getQueryFn,
  resolveUrl,
  TenantQuotaExceededError,
} from "@/lib/queryClient-request";

export {
  apiFormDataRequest,
  apiRequest,
  createHeaders,
  DEFAULT_GET_TIMEOUT_MS,
  getQueryFn,
  resolveUrl,
  TenantQuotaExceededError,
  type ApiRequestInit,
  type ApiRequestOptions,
  type QueuedApiResponse,
  type UnauthorizedBehavior,
} from "@/lib/queryClient-request";

export const CACHE_TIMES = {
  REALTIME: 30000,
  MODERATE: 300000,
  STABLE: 3600000,
  EXPENSIVE: 86400000,
} as const;

const recentErrorToasts = new Map<string, number>();
const ERROR_TOAST_DEDUPE_MS = 5000;

/**
 * Last-resort error surface for queries/mutations without their own handling.
 * Opt out per query/mutation with `meta: { suppressGlobalError: true }`, or
 * override the text with `meta: { errorMessage: "..." }`.
 */
function showGlobalErrorToast(
  error: unknown,
  meta: Record<string, unknown> | undefined,
  kind: "query" | "mutation"
): void {
  if (meta?.["suppressGlobalError"] === true) {
    return;
  }
  // Quota errors already notify through tenant-quota-notifications.
  if (error instanceof TenantQuotaExceededError) {
    return;
  }
  // 401s are handled by auth flows (redirect/login), not toasts.
  if (error instanceof ApiError && error.status === 401) {
    return;
  }

  const description =
    typeof meta?.["errorMessage"] === "string"
      ? meta["errorMessage"]
      : error instanceof Error
        ? error.message
        : String(error);

  const now = Date.now();
  const lastShown = recentErrorToasts.get(description);
  if (lastShown !== undefined && now - lastShown < ERROR_TOAST_DEDUPE_MS) {
    return;
  }
  for (const [key, shownAt] of recentErrorToasts) {
    if (now - shownAt > ERROR_TOAST_DEDUPE_MS) {
      recentErrorToasts.delete(key);
    }
  }
  recentErrorToasts.set(description, now);

  toast({
    title: kind === "mutation" ? "Action failed" : "Failed to load data",
    description,
    variant: "destructive",
  });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      showGlobalErrorToast(error, query.meta, "query");
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Mutations with their own onError already surface the failure; the
      // global toast only covers the silent ones.
      if (mutation.options.onError) {
        return;
      }
      showGlobalErrorToast(error, mutation.meta, "mutation");
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: CACHE_TIMES.MODERATE,
      retry: 1,
      retryDelay: (attempt) => computeBackoffDelay(attempt),
    },
    mutations: {
      // Never auto-retry mutations: most POSTs are not idempotent, and queueable
      // mutations already get exactly-once replay via the offline outbox.
      // Idempotent calls can opt back in with a per-mutation `retry`.
      retry: 0,
    },
  },
});

let replayInFlight: Promise<{ synced: number; failed: number; conflicts: number }> | null = null;

/**
 * Replays the offline outbox. Concurrent callers (connectivity listeners, manual
 * sync button, app mount) share a single in-flight replay so an operation can
 * never be submitted twice in parallel.
 */
export function replayQueuedApiRequests(): Promise<{
  synced: number;
  failed: number;
  conflicts: number;
}> {
  if (replayInFlight) {
    return replayInFlight;
  }
  replayInFlight = doReplayQueuedApiRequests().finally(() => {
    replayInFlight = null;
  });
  return replayInFlight;
}

async function doReplayQueuedApiRequests(): Promise<{
  synced: number;
  failed: number;
  conflicts: number;
}> {
  if (!isOnline()) {
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  const operations = await getPendingOperations();
  const unresolvedConflictIds = await getUnresolvedConflictOperationIds();
  const apiOperations = operations.filter((op: PendingOperation) => op.request);
  const now = Date.now();
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  for (const op of apiOperations) {
    if (
      !op.request ||
      op.retryCount >= 5 ||
      op.conflictPaused ||
      unresolvedConflictIds.has(op.id)
    ) {
      continue;
    }

    // Previously-failed ops wait out a jittered backoff window before being
    // retried, so a flaky link doesn't get hammered by every replay pass.
    if (
      op.retryCount > 0 &&
      now < (op.lastAttemptedAt ?? 0) + computeBackoffDelay(op.retryCount)
    ) {
      continue;
    }

    const payload = { ...op.payload };
    Object.keys(payload).forEach((key) => {
      if (key.startsWith("__")) {
        delete payload[key];
      }
    });

    // The key travels as a header because `__`-prefixed payload keys are stripped
    // above. Older queue records only stored it in the payload, so fall back there.
    const idempotencyKey =
      op.clientMutationId ??
      (typeof op.payload["__clientMutationId"] === "string"
        ? op.payload["__clientMutationId"]
        : undefined);

    // A replay must not hang forever on a half-open link; bound each attempt.
    const replaySignal =
      typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(DEFAULT_GET_TIMEOUT_MS)
        : undefined;

    try {
      const response = await fetch(resolveUrl(op.request.url), {
        method: op.request.method,
        headers: {
          ...createHeaders(op.request.method !== "DELETE"),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(op.request.method !== "DELETE" ? { body: JSON.stringify(payload) } : {}),
        credentials: "include",
        ...(replaySignal !== undefined ? { signal: replaySignal } : {}),
      });

      // Got a response — the backend is reachable even if it returns an error.
      backendCircuit.recordSuccess();
      inspectQuotaWarning(response);

      if (response.status === 429) {
        let body: unknown;
        try {
          body = await response.clone().json();
        } catch {
          body = undefined;
        }
        const exceeded = parseQuotaExceeded(response, body);
        if (exceeded) {
          notifyQuotaExceeded(exceeded);
          await markOperationFailed(op.id, formatQuotaExceededMessage(exceeded));
          failed++;
          continue;
        }
      }

      if (response.status === 409 || response.status === 412) {
        let serverVersion: Record<string, unknown> = {};
        try {
          const raw = (await response.json()) as Record<string, unknown> | null;
          // Enveloped conflicts carry the domain payload in error.details;
          // store that (or the error object) so the conflict UI keeps showing
          // server-side fields rather than envelope plumbing.
          if (raw && raw["success"] === false && raw["error"] && typeof raw["error"] === "object") {
            const errorDetail = raw["error"] as Record<string, unknown>;
            const details = errorDetail["details"];
            serverVersion =
              details && typeof details === "object" && !Array.isArray(details)
                ? (details as Record<string, unknown>)
                : errorDetail;
          } else {
            serverVersion = raw ?? {};
          }
        } catch {
          serverVersion = { status: response.status, message: response.statusText };
        }
        await addConflict(op.id, op.entityType, op.entityId, payload, serverVersion);
        conflicts++;
        continue;
      }

      if (!response.ok) {
        const message = (await response.text()) || response.statusText;
        await markOperationFailed(op.id, message);
        failed++;
        continue;
      }

      await removeOperation(op.id);
      synced++;
    } catch (error) {
      // fetch only rejects on connection/abort failures (not HTTP status), so a
      // throw here means the backend is unreachable — count it against the breaker.
      backendCircuit.recordFailure();
      await markOperationFailed(
        op.id,
        error instanceof Error ? error.message : "Unknown sync error"
      );
      failed++;
    }
  }

  if (synced > 0) {
    await setLastSyncTime(new Date());
  }

  return { synced, failed, conflicts };
}
