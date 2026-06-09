/**
 * Admin API Utilities
 *
 * Provides authenticated API request functions for admin operations.
 */

import { getApiSessionToken } from "@/lib/sessionToken";

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
  const sessionToken = getApiSessionToken();

  if (!sessionToken) {
    throw new Error("Admin session not active. Please unlock admin mode first.");
  }

  const headers: Record<string, string> = {
    "x-org-id": "default-org-id",
  };
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(data ? { body: JSON.stringify(data) } : {}),
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();

    if (res.status === 401) {
      throw new Error("Admin session expired. Please unlock admin mode again.");
    }

    throw new Error(`${res.status}: ${text}`);
  }

  if (res.status === 204) {
    return null as T;
  }

  const text = await res.text();
  const result = text ? JSON.parse(text) : null;

  // Handle standardized API response format (unwrap { success, data } envelope)
  if (result && typeof result === "object" && "success" in result && "data" in result) {
    return result.data as T;
  }

  return result as T;
}

/**
 * Admin query function factory for TanStack Query
 */
export function adminQueryFn(queryKey: readonly string[]) {
  return async () => {
    const sessionToken = getApiSessionToken();

    if (!sessionToken) {
      throw new Error("Admin session not active. Please unlock admin mode first.");
    }

    const url = queryKey.join("/");

    const headers: Record<string, string> = {
      "x-org-id": "default-org-id",
    };
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();

      if (res.status === 401) {
        throw new Error("Admin session expired. Please unlock admin mode again.");
      }

      throw new Error(`${res.status}: ${text}`);
    }

    const result = await res.json();

    // Handle standardized API response format (unwrap { success, data } envelope)
    if (result && typeof result === "object" && "success" in result && "data" in result) {
      return result.data;
    }

    return result;
  };
}
