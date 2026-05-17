import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCurrentDeviceId } from "@/hooks/useDeviceId";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { getBackendUrlSync } from "@/lib/desktopFetch";
import { getApiSessionToken } from "@/lib/sessionToken";
import {
  addConflict,
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

    let errorData;
    try {
      errorData = JSON.parse(text);
    } catch {
      throw new Error(`${statusPrefix}: ${text || res.statusText}`);
    }

    if (errorData.errors && Array.isArray(errorData.errors)) {
      const fieldErrors = errorData.errors
        .map(
          (err: { path?: string[]; message: string }) =>
            `${err.path?.join(".") || "Field"}: ${err.message}`
        )
        .join(", ");
      throw new Error(`${statusPrefix}: ${fieldErrors || errorData.message || text}`);
    }

    const message = errorData.message || errorData.error || text || res.statusText;
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
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  return headers;
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
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
  data: unknown
): Promise<QueuedApiResponse> {
  const operation = await queueApiOperation(method, url, asPayloadRecord(data));
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
  data?: unknown | undefined,
  options?: ApiRequestOptions
): Promise<T> {
  const shouldQueueOffline = isQueueableMutation(method, url);

  if (shouldQueueOffline && !isOnline()) {
    return (await queueOfflineApiRequest(method, url, data)) as T;
  }

  let res: Response;
  try {
    res = await fetch(resolveUrl(url), {
      method,
      headers: { ...createHeaders(!!data), ...(options?.headers ?? {}) },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: options?.signal,
    });
  } catch (error) {
    if (shouldQueueOffline && isNetworkFailure(error)) {
      return (await queueOfflineApiRequest(method, url, data)) as T;
    }
    throw error;
  }

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
      if (process.env.NODE_ENV === "development") {
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
      retry: 1,
    },
  },
});

export function optimisticUpdate<TData, TVariables>(
  queryKey: string | string[],
  updater: (oldData: TData | undefined, variables: TVariables) => TData
) {
  return async (variables: TVariables) => {
    const key = Array.isArray(queryKey) ? queryKey : [queryKey];

    await queryClient.cancelQueries({ queryKey: key });

    const previousData = queryClient.getQueryData<TData>(key);

    queryClient.setQueryData<TData>(key, (old) => updater(old, variables));

    return { previousData, queryKey: key };
  };
}

export function rollbackUpdate<TData>(_queryKey: string | string[]) {
  return (
    _error: Error,
    _variables: unknown,
    context?: { previousData?: TData; queryKey: string[] }
  ) => {
    if (context?.previousData !== undefined) {
      queryClient.setQueryData(context.queryKey, context.previousData);
    }
  };
}


export async function replayQueuedApiRequests(): Promise<{
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

    try {
      const response = await fetch(resolveUrl(op.request.url), {
        method: op.request.method,
        headers: createHeaders(op.request.method !== "DELETE"),
        body: op.request.method === "DELETE" ? undefined : JSON.stringify(payload),
        credentials: "include",
      });

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
