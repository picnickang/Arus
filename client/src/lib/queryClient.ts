import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCurrentDeviceId } from "@/hooks/useDeviceId";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { getBackendUrlSync } from "@/lib/desktopFetch";
import { getApiSessionToken } from "@/lib/sessionToken";
import {
  addConflict,
  generateClientMutationId,
  getPendingOperations,
  getUnresolvedConflictOperationIds,
  isOnline,
  isQueueableMutation,
  markOperationFailed,
  queueApiOperation,
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

export class TenantQuotaExceededError extends Error {
  readonly status = 429;
  readonly code = "TENANT_QUOTA_EXCEEDED";
  readonly metric: string;
  readonly retryAfterSeconds: number;
  readonly limit?: number | undefined;
  readonly used?: number | undefined;

  constructor(info: {
    metric: string;
    retryAfterSeconds: number;
    limit?: number | undefined;
    used?: number | undefined;
  }) {
    super(formatQuotaExceededMessage(info));
    this.name = "TenantQuotaExceededError";
    this.metric = info.metric;
    this.retryAfterSeconds = info.retryAfterSeconds;
    this.limit = info.limit;
    this.used = info.used;
  }
}

export function resolveUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const base = getBackendUrlSync();
  if (!base) {
    return url;
  }
  const separator = url.startsWith("/") ? "" : "/";
  return `${base}${separator}${url}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const statusPrefix = `${res.status}`;

    let errorData: unknown;
    try {
      errorData = JSON.parse(text);
    } catch {
      if (res.status === 429) {
        const exceeded = parseQuotaExceeded(res, undefined);
        if (exceeded) {
          notifyQuotaExceeded(exceeded);
          throw new TenantQuotaExceededError(exceeded);
        }
      }
      throw new Error(`${statusPrefix}: ${text || res.statusText}`);
    }

    if (res.status === 429) {
      const exceeded = parseQuotaExceeded(res, errorData);
      if (exceeded) {
        notifyQuotaExceeded(exceeded);
        throw new TenantQuotaExceededError(exceeded);
      }
    }

    const errorObj = (errorData ?? {}) as {
      errors?: { path?: string[]; message: string }[];
      message?: string;
      error?: string;
    };

    if (errorObj.errors && Array.isArray(errorObj.errors)) {
      const fieldErrors = errorObj.errors
        .map(
          (err) =>
            `${err.path?.join(".") || "Field"}: ${err.message}`
        )
        .join(", ");
      throw new Error(`${statusPrefix}: ${fieldErrors || errorObj.message || text}`);
    }

    const message = errorObj.message || errorObj.error || text || res.statusText;
    throw new Error(`${statusPrefix}: ${message}`);
  }
}

export function createHeaders(includeContentType: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  const orgId = getCurrentOrgId();
  if (orgId) {
    headers["x-org-id"] = orgId;
  }

  const deviceId = getCurrentDeviceId();
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }

  const sessionToken = getApiSessionToken();
  if (sessionToken) {
    // Workflow guard marker: headers.Authorization is intentionally represented
    // with bracket access because headers has an index signature.
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  return headers;
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface ApiRequestInit extends ApiRequestOptions {
  method?: string;
  body?: unknown;
}
export interface QueuedApiResponse {
  queuedForSync: true;
  offline: true;
  id: string;
  entityType: string;
  entityId: string;
  message: string;
}

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === "AbortError") ||
    String(error).toLowerCase().includes("failed to fetch") ||
    String(error).toLowerCase().includes("network")
  );
}

function asPayloadRecord(data: unknown): Record<string, unknown> | undefined {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;
}

async function queueOfflineApiRequest(
  method: string,
  url: string,
  data: unknown,
  clientMutationId?: string
): Promise<QueuedApiResponse> {
  const payload = asPayloadRecord(data);
  const operation = await queueApiOperation(
    method,
    url,
    clientMutationId ? { ...(payload ?? {}), __clientMutationId: clientMutationId } : payload
  );
  return {
    queuedForSync: true,
    offline: true,
    id: operation.id,
    entityType: operation.entityType,
    entityId: operation.entityId,
    message: "Saved to the offline outbox. It will sync when the vessel is connected.",
  };
}


export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown,
  options?: ApiRequestOptions
): Promise<T>;
export async function apiRequest<T = unknown>(url: string, init?: ApiRequestInit): Promise<T>;
export async function apiRequest<T = unknown>(
  first: string,
  second?: string | ApiRequestInit,
  third?: unknown,
  fourth?: ApiRequestOptions
): Promise<T> {
  const method = typeof second === "string" ? first : second?.method ?? "GET";
  const url = typeof second === "string" ? second : first;
  const data = typeof second === "string" ? third : second?.body;
  const options = typeof second === "string" ? fourth : second;
  const body = typeof data === "string" ? data : data !== undefined ? JSON.stringify(data) : undefined;
  const includeContentType = body !== undefined;

  const shouldQueueOffline = isQueueableMutation(method, url);

  // Queueable mutations carry an idempotency key from the very first attempt, so a
  // request that succeeds server-side but fails client-side (timeout, dropped link)
  // replays to the same cached response instead of double-writing.
  const payloadRecord = shouldQueueOffline ? asPayloadRecord(data) : undefined;
  const clientMutationId = shouldQueueOffline
    ? (payloadRecord?.["clientMutationId"] as string | undefined) ??
      (payloadRecord?.["__clientMutationId"] as string | undefined) ??
      generateClientMutationId()
    : undefined;

  if (shouldQueueOffline && !isOnline()) {
    return (await queueOfflineApiRequest(method, url, data, clientMutationId)) as T;
  }

  let res: Response;
  try {
    res = await fetch(resolveUrl(url), {
      method,
      headers: {
        ...createHeaders(includeContentType),
        ...(clientMutationId ? { "Idempotency-Key": clientMutationId } : {}),
        ...(options?.headers ?? {}),
      },
      ...(body !== undefined ? { body } : {}),
      credentials: "include",
      ...(options?.signal !== undefined ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (shouldQueueOffline && isNetworkFailure(error)) {
      return (await queueOfflineApiRequest(method, url, data, clientMutationId)) as T;
    }
    throw error;
  }

  inspectQuotaWarning(res);
  await throwIfResNotOk(res);

  if (res.status === 204) {
    return null as T;
  }

  const text = await res.text();
  const result = text ? JSON.parse(text) : null;

  if (result && typeof result === "object" && "success" in result && "data" in result) {
    return result.data as T;
  }

  return result as T;
}

export async function apiFormDataRequest<T = unknown>(
  method: string,
  url: string,
  body: FormData,
  options?: ApiRequestOptions
): Promise<T> {
  const res = await fetch(resolveUrl(url), {
    method,
    headers: { ...createHeaders(false), ...(options?.headers ?? {}) },
    body,
    credentials: "include",
    ...(options?.signal !== undefined ? { signal: options.signal } : {}),
  });

  inspectQuotaWarning(res);
  await throwIfResNotOk(res);

  if (res.status === 204) {
    return null as T;
  }

  const text = await res.text();
  const result = text ? JSON.parse(text) : null;

  if (result && typeof result === "object" && "success" in result && "data" in result) {
    return result.data as T;
  }

  return result as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url: string;

    if (queryKey.length === 1) {
      url = queryKey[0] as string;
    } else if (queryKey.length === 2 && typeof queryKey[1] === "object" && queryKey[1] !== null) {
      const baseUrl = queryKey[0] as string;
      const params = queryKey[1] as Record<string, string | number | boolean | null | undefined>;
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          searchParams.append(key, String(value));
        }
      });

      const queryString = searchParams.toString();
      url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    } else {
      url = queryKey.join("/");
      if (process.env['NODE_ENV'] === "development") {
        console.warn(
          `[QueryClient] Legacy queryKey format detected: ${url}. Use array segments for proper cache invalidation.`
        );
      }
    }

    const res = await fetch(resolveUrl(url), {
      headers: createHeaders(false),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    inspectQuotaWarning(res);
    await throwIfResNotOk(res);
    const result = await res.json();

    if (result && typeof result === "object" && "success" in result && "data" in result) {
      return result.data;
    }

    return result;
  };

export const CACHE_TIMES = {
  REALTIME: 30000,
  MODERATE: 300000,
  STABLE: 3600000,
  EXPENSIVE: 86400000,
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: CACHE_TIMES.MODERATE,
      retry: 1,
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
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  for (const op of apiOperations) {
    if (!op.request || op.retryCount >= 5 || op.conflictPaused || unresolvedConflictIds.has(op.id)) {
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

    try {
      const response = await fetch(resolveUrl(op.request.url), {
        method: op.request.method,
        headers: {
          ...createHeaders(op.request.method !== "DELETE"),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(op.request.method !== "DELETE" ? { body: JSON.stringify(payload) } : {}),
        credentials: "include",
      });

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
          serverVersion = await response.json();
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
      await markOperationFailed(op.id, error instanceof Error ? error.message : "Unknown sync error");
      failed++;
    }
  }

  if (synced > 0) {
    await setLastSyncTime(new Date());
  }

  return { synced, failed, conflicts };
}
