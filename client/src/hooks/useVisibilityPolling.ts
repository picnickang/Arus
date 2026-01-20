/**
 * useVisibilityPolling Hook
 *
 * Smart query refetching that pauses when the browser tab is hidden.
 * This reduces unnecessary network requests and improves battery life on mobile devices.
 *
 * Usage:
 * ```typescript
 * const { data, isLoading } = useVisibilityPolling({
 *   queryKey: ['equipment', 'list'],
 *   queryFn: () => apiRequest('GET', '/api/equipment'),
 *   interval: 30000, // Poll every 30 seconds
 * });
 * ```
 */

import { useQuery, QueryKey, QueryFunction, UseQueryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface UseVisibilityPollingOptions<TData = unknown, TError = unknown> {
  queryKey: QueryKey;
  queryFn?: QueryFunction<TData, QueryKey>;
  interval?: number;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  select?: (data: TData) => unknown;
  onError?: (error: TError) => void;
  onSuccess?: (data: TData) => void;
}

/**
 * Custom hook that detects if the page is visible to the user
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Enhanced useQuery hook that pauses polling when the page is hidden
 *
 * Benefits:
 * - Reduces network usage when user isn't looking at the page
 * - Improves battery life on mobile devices
 * - Automatically resumes when user returns to the tab
 * - Maintains TanStack Query's cache and refetch behavior
 */
export function useVisibilityPolling<TData = unknown, TError = unknown>({
  queryKey,
  queryFn,
  interval,
  enabled = true,
  staleTime,
  gcTime,
  select,
  onError: _onError,
  onSuccess: _onSuccess,
}: UseVisibilityPollingOptions<TData, TError>) {
  const isVisible = usePageVisibility();

  // Only poll if:
  // 1. An interval is specified
  // 2. The page is visible
  // 3. The query is enabled
  const shouldPoll = interval !== undefined && isVisible && enabled;

  return useQuery({
    queryKey,
    queryFn,
    refetchInterval: shouldPoll ? interval : false,
    enabled,
    staleTime,
    gcTime,
    select,
  } as UseQueryOptions<TData, TError>);
}

/**
 * Helper function to create visibility-aware polling intervals
 *
 * Example:
 * ```typescript
 * const interval = getPollingInterval({ base: 30000, visible: true });
 * // Returns 30000 if visible, false if not
 * ```
 */
export function getPollingInterval(options: {
  base: number;
  visible: boolean;
  enabled?: boolean;
}): number | false {
  const { base, visible, enabled = true } = options;
  return enabled && visible ? base : false;
}
