/**
 * Admin API Utilities
 *
 * Provides authenticated API request functions for admin operations.
 * Dev mode: bypasses session checks for development access.
 */

import { getApiSessionToken } from "@/lib/sessionToken";

// Development mode: bypass session checks
// Use Vite's built-in environment detection for safety
const DEV_MODE = import.meta.env.DEV === true;
const DEV_SESSION_TOKEN = "dev-admin-session-token";

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
  // In dev mode, use dev token; otherwise require session
  const sessionToken = DEV_MODE ? DEV_SESSION_TOKEN : getApiSessionToken();

  if (!sessionToken && !DEV_MODE) {
    throw new Error("Admin session not active. Please unlock admin mode first.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${sessionToken}`,
    "x-org-id": "default-org-id",
  };

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
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
    // In dev mode, use dev token; otherwise require session
    const sessionToken = DEV_MODE ? DEV_SESSION_TOKEN : getApiSessionToken();

    if (!sessionToken && !DEV_MODE) {
      throw new Error("Admin session not active. Please unlock admin mode first.");
    }

    const url = queryKey.join("/");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${sessionToken}`,
      "x-org-id": "default-org-id",
    };

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
