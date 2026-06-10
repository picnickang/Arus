/**
 * Admin API Utilities
 *
 * Thin wrappers over apiRequest for admin operations: they add the
 * admin-session precondition and friendlier 401 messaging, and inherit
 * everything else (real org/device headers, desktop URL resolution, envelope
 * unwrapping, typed ApiError) from the shared client.
 */

import { apiRequest } from "@/lib/queryClient";
import { ApiError } from "@/lib/api-error";
import { getApiSessionToken } from "@/lib/sessionToken";

function requireAdminSession(): void {
  if (!getApiSessionToken()) {
    throw new Error("Admin session not active. Please unlock admin mode first.");
  }
}

function rethrowAdminError(error: unknown): never {
  if (error instanceof ApiError && error.status === 401) {
    throw new ApiError({
      status: 401,
      detail: "Admin session expired. Please unlock admin mode again.",
      code: error.code,
      correlationId: error.correlationId,
      body: error.body,
    });
  }
  throw error;
}

/**
 * Admin API request function with session-based authentication.
 *
 * Generic on the response shape: callers may pass a type argument to narrow
 * the result, e.g. `adminApiRequest<{ message: string }>("POST", url, body)`.
 * Defaults to `unknown` to preserve safe-by-default semantics for callers
 * that don't supply a type.
 */
export async function adminApiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown
): Promise<T> {
  requireAdminSession();
  try {
    return await apiRequest<T>(method, url, data);
  } catch (error) {
    rethrowAdminError(error);
  }
}

/**
 * Admin query function factory for TanStack Query. Generic so the result
 * type flows from the `useQuery<T>` context; defaults to `unknown`.
 */
export function adminQueryFn<T = unknown>(queryKey: readonly string[]): () => Promise<T> {
  return async () => {
    requireAdminSession();
    try {
      return await apiRequest<T>("GET", queryKey.join("/"));
    } catch (error) {
      rethrowAdminError(error);
    }
  };
}
