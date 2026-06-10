import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, type RenderHookResult } from "@testing-library/react";

/**
 * Fresh QueryClient per test: no retries (fail fast), no GC surprises, and no
 * global error toasts leaking between tests.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderHookWithClient<Result, Props>(
  callback: (props: Props) => Result,
  options?: { client?: QueryClient }
): RenderHookResult<Result, Props> & { client: QueryClient } {
  const client = options?.client ?? createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const result = renderHook(callback, { wrapper });
  return { ...result, client };
}
