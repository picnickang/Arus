import type { QueryFunction } from "@tanstack/react-query";
import { isSuccessEnvelope } from "@shared/api-envelope";
import { apiErrorFromResponse } from "@/lib/api-error";
import { backendCircuit } from "@/lib/circuit-breaker";
import { getCurrentDeviceId } from "@/hooks/useDeviceId";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { getBackendUrlSync } from "@/lib/desktopFetch";
import { getApiSessionToken } from "@/lib/sessionToken";
import {
  generateClientMutationId,
  isOnline,
  isQueueableMutation,
  queueApiOperation,
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

    let errorData: unknown;
    try {
      errorData = JSON.parse(text);
    } catch {
      errorData = undefined;
    }

    if (res.status === 429) {
      const exceeded = parseQuotaExceeded(res, errorData);
      if (exceeded) {
        notifyQuotaExceeded(exceeded);
        throw new TenantQuotaExceededError(exceeded);
      }
    }

    throw apiErrorFromResponse(res.status, text, errorData);
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
  /** Abort the request after this many ms. GETs default to 30s; pass 0 to disable. */
  timeoutMs?: number;
}

export const DEFAULT_GET_TIMEOUT_MS = 30_000;

// Uploads legitimately run longer than a GET, but should still not hang forever
// on a dropped link. Callers can override via `options.timeoutMs`.
export const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Composes a caller/TanStack signal with a default timeout. Falls back
 * gracefully where AbortSignal.timeout/any are unavailable (older webviews).
 */
function composeSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined
): AbortSignal | undefined {
  const timeoutSignal =
    timeoutMs !== undefined &&
    timeoutMs > 0 &&
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
  if (signal && timeoutSignal) {
    return typeof AbortSignal.any === "function"
      ? AbortSignal.any([signal, timeoutSignal])
      : signal;
  }
  return signal ?? timeoutSignal;
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

const legacyBodyUrls = new Set<string>();

/**
 * Unwraps the canonical {success: true, data} envelope (shared/api-envelope).
 * Every /api response is enveloped since the WS4 endgame flip except the
 * pinned exclusions, so a non-envelope object body is logged once per URL as
 * a burndown signal before being passed through unchanged.
 */
function unwrapEnvelope<T>(result: unknown, url: string): T {
  if (isSuccessEnvelope(result)) {
    return result.data as T;
  }
  if (result && typeof result === "object" && !legacyBodyUrls.has(url)) {
    legacyBodyUrls.add(url);
    console.info(`[api] non-envelope body from ${url} (excluded or legacy endpoint)`);
  }
  return result as T;
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
  const method = typeof second === "string" ? first : (second?.method ?? "GET");
  const url = typeof second === "string" ? second : first;
  const data = typeof second === "string" ? third : second?.body;
  const options = typeof second === "string" ? fourth : second;
  const body =
    typeof data === "string" ? data : data !== undefined ? JSON.stringify(data) : undefined;
  const includeContentType = body !== undefined;

  const shouldQueueOffline = isQueueableMutation(method, url);

  // Queueable mutations carry an idempotency key from the very first attempt, so a
  // request that succeeds server-side but fails client-side (timeout, dropped link)
  // replays to the same cached response instead of double-writing.
  const payloadRecord = shouldQueueOffline ? asPayloadRecord(data) : undefined;
  const clientMutationId = shouldQueueOffline
    ? ((payloadRecord?.["clientMutationId"] as string | undefined) ??
      (payloadRecord?.["__clientMutationId"] as string | undefined) ??
      generateClientMutationId())
    : undefined;

  if (shouldQueueOffline && !isOnline()) {
    return (await queueOfflineApiRequest(method, url, data, clientMutationId)) as T;
  }

  // Fail fast when the breaker is open: the backend is presumed unreachable, so
  // there's no point burning the full timeout. Queueable mutations divert to the
  // offline outbox immediately rather than surfacing an error to the operator.
  if (!backendCircuit.canRequest()) {
    if (shouldQueueOffline) {
      return (await queueOfflineApiRequest(method, url, data, clientMutationId)) as T;
    }
    throw new Error("Backend unavailable (circuit open)");
  }

  // GETs time out by default; mutations only when the caller opts in -
  // aborting a long-running write client-side doesn't stop it server-side.
  const effectiveSignal = composeSignal(
    options?.signal,
    options?.timeoutMs ?? (method === "GET" ? DEFAULT_GET_TIMEOUT_MS : undefined)
  );

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
      ...(effectiveSignal !== undefined ? { signal: effectiveSignal } : {}),
    });
  } catch (error) {
    // Only connection-level failures trip the breaker; a reachable server that
    // returns 4xx/5xx is handled below and must not count against it.
    if (isNetworkFailure(error)) {
      backendCircuit.recordFailure();
    }
    if (shouldQueueOffline && isNetworkFailure(error)) {
      return (await queueOfflineApiRequest(method, url, data, clientMutationId)) as T;
    }
    throw error;
  }

  // Reaching a response — even an error status — proves the backend is up.
  backendCircuit.recordSuccess();

  inspectQuotaWarning(res);
  await throwIfResNotOk(res);

  if (res.status === 204) {
    return null as T;
  }

  const text = await res.text();
  const result = text ? JSON.parse(text) : null;
  return unwrapEnvelope<T>(result, url);
}

export async function apiFormDataRequest<T = unknown>(
  method: string,
  url: string,
  body: FormData,
  options?: ApiRequestOptions
): Promise<T> {
  const effectiveSignal = composeSignal(
    options?.signal,
    options?.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS
  );
  const res = await fetch(resolveUrl(url), {
    method,
    headers: { ...createHeaders(false), ...(options?.headers ?? {}) },
    body,
    credentials: "include",
    ...(effectiveSignal !== undefined ? { signal: effectiveSignal } : {}),
  });

  inspectQuotaWarning(res);
  await throwIfResNotOk(res);

  if (res.status === 204) {
    return null as T;
  }

  const text = await res.text();
  const result = text ? JSON.parse(text) : null;
  return unwrapEnvelope<T>(result, url);
}

// Re-exported so existing `@/lib/queryClient` consumers keep a single import site.
export { retryUnlessClientError } from "@/lib/query-retry";

export type UnauthorizedBehavior = "returnNull" | "throw";

export function getQueryFn<T>(options: { on401: UnauthorizedBehavior }): QueryFunction<T> {
  const { on401: unauthorizedBehavior } = options;
  return async ({ queryKey, signal }) => {
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
      if (process.env["NODE_ENV"] === "development") {
        console.warn(
          `[QueryClient] Legacy queryKey format detected: ${url}. Use array segments for proper cache invalidation.`
        );
      }
    }

    // Forwarding TanStack's signal lets unmounted/superseded queries cancel
    // their in-flight fetches instead of completing into a dead cache entry.
    const effectiveSignal = composeSignal(signal, DEFAULT_GET_TIMEOUT_MS);
    const res = await fetch(resolveUrl(url), {
      headers: createHeaders(false),
      credentials: "include",
      ...(effectiveSignal !== undefined ? { signal: effectiveSignal } : {}),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // Callers opting into returnNull type their useQuery data as nullable.
      return null as T;
    }

    inspectQuotaWarning(res);
    await throwIfResNotOk(res);
    const result: unknown = await res.json();
    return unwrapEnvelope<T>(result, url);
  };
}
