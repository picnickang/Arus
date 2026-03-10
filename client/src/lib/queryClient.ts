import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCurrentDeviceId } from "@/hooks/useDeviceId";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { getBackendUrlSync } from "@/lib/desktopFetch";

function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = getBackendUrlSync();
  return base ? `${base}${url}` : url;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const statusPrefix = `${res.status}`;

    // Try to parse JSON error response for better error messages
    let errorData;
    try {
      errorData = JSON.parse(text);
    } catch {
      // Not JSON - use text with status code for diagnostics
      throw new Error(`${statusPrefix}: ${text || res.statusText}`);
    }

    // Handle Zod validation errors with specific field messages
    if (errorData.errors && Array.isArray(errorData.errors)) {
      const fieldErrors = errorData.errors
        .map((err: { path?: string[]; message: string }) => `${err.path?.join(".") || "Field"}: ${err.message}`)
        .join(", ");
      throw new Error(`${statusPrefix}: ${fieldErrors || errorData.message || text}`);
    }

    // Extract message from JSON error response with status prefix
    const message = errorData.message || errorData.error || text || res.statusText;
    throw new Error(`${statusPrefix}: ${message}`);
  }
}

// Helper function to create headers with device ID and organization ID
function createHeaders(includeContentType: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {};

  // Add Content-Type if needed
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  // SINGLE-TENANT MODE: Always include org-id header (defaults to default-org-id)
  const orgId = getCurrentOrgId() || "default-org-id";
  headers["x-org-id"] = orgId;

  // Add X-Device-Id header if available (Hub & Sync functionality)
  const deviceId = getCurrentDeviceId();
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }

  return headers;
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: ApiRequestOptions
): Promise<unknown> {
  const res = await fetch(resolveUrl(url), {
    method,
    headers: createHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: options?.signal,
  });

  await throwIfResNotOk(res);

  // Handle 204 No Content responses (e.g., successful DELETE operations)
  if (res.status === 204) {
    return null;
  }

  // Only parse JSON if there's a response body
  const text = await res.text();
  const result = text ? JSON.parse(text) : null;
  
  // Handle standardized API response format (unwrap { success, data } envelope)
  if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
    return result.data;
  }
  
  return result;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL with proper query parameter handling
    let url: string;

    if (queryKey.length === 1) {
      // Simple query key - just use as URL
      url = queryKey[0] as string;
    } else if (queryKey.length === 2 && typeof queryKey[1] === "object" && queryKey[1] !== null) {
      // Query key with parameters object - convert to query string
      const baseUrl = queryKey[0] as string;
      const params = queryKey[1] as Record<string, string | number | boolean | null | undefined>;
      const searchParams = new URLSearchParams();

      // Add non-null/undefined parameters to query string
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          searchParams.append(key, String(value));
        }
      });

      const queryString = searchParams.toString();
      url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    } else {
      // Legacy format - join with slashes (for backward compatibility)
      url = queryKey.join("/");
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
    
    // Handle standardized API response format (unwrap { success, data } envelope)
    if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
      return result.data;
    }
    
    return result;
  };

// Cache time constants for different data types (OPTIMIZED Oct 2025)
export const CACHE_TIMES = {
  REALTIME: 30000, // 30s - telemetry, truly real-time data
  MODERATE: 300000, // 5min - devices, work orders, fleet status
  STABLE: 3600000, // 60min - vessels, equipment catalog, users (was 30min)
  EXPENSIVE: 86400000, // 24hr - AI insights, reports, heavy computations (was 1hr)
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false, // Disable global polling - set per query based on data type
      refetchOnWindowFocus: false,
      staleTime: CACHE_TIMES.MODERATE, // 5min default - reasonable for most data
      retry: 1, // Single retry for network issues
    },
    mutations: {
      retry: 1, // Single retry for mutations
    },
  },
});

/**
 * Helper for optimistic mutations with automatic rollback on error
 *
 * @example
 * const mutation = useMutation({
 *   mutationFn: (data) => apiRequest('POST', '/api/work-orders', data),
 *   onMutate: optimisticUpdate('/api/work-orders', (old, newData) => [...(old ?? []), newData]),
 *   onError: rollbackUpdate('/api/work-orders'),
 *   onSettled: () => queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] }),
 * });
 */
export function optimisticUpdate<TData, TVariables>(
  queryKey: string | string[],
  updater: (oldData: TData | undefined, variables: TVariables) => TData
) {
  return async (variables: TVariables) => {
    const key = Array.isArray(queryKey) ? queryKey : [queryKey];

    // Cancel any outgoing refetches
    await queryClient.cancelQueries({ queryKey: key });

    // Snapshot the previous value
    const previousData = queryClient.getQueryData<TData>(key);

    // Optimistically update to the new value
    queryClient.setQueryData<TData>(key, (old) => updater(old, variables));

    // Return a context with the previous value
    return { previousData, queryKey: key };
  };
}

/**
 * Helper to rollback optimistic updates on error
 */
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
