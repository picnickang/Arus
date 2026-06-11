import type { ReactNode } from "react";
import { LoadingState, type LoadingVariant } from "./LoadingState";
import { ErrorState, type NormalizedError } from "./ErrorState";

export interface QueryBoundaryProps<T> {
  isLoading: boolean;
  error: NormalizedError | Error | string | null | undefined;
  /**
   * Optional data. When provided together with function children, enables
   * the empty state (`data == null` renders `emptyFallback`) and passes the
   * narrowed, non-null value to the children function.
   */
  data?: T | null | undefined;
  /**
   * Node children render as-is on success. IMPORTANT: node children are
   * evaluated eagerly even while loading — if the success JSX dereferences
   * possibly-undefined query data, use the function form instead, which is
   * only called once `data` is non-null.
   */
  children: ReactNode | ((data: T) => ReactNode);
  /** LoadingState pass-through (ignored when loadingFallback is given) */
  loadingVariant?: LoadingVariant | undefined;
  loadingRows?: number | undefined;
  loadingCols?: number | undefined;
  loadingClassName?: string | undefined;
  /** Replaces the default LoadingState entirely */
  loadingFallback?: ReactNode | undefined;
  /** ErrorState pass-through (ignored when errorFallback is given) */
  errorTitle?: string | undefined;
  errorVariant?: "inline" | "page" | undefined;
  onRetry?: (() => void | Promise<void>) | undefined;
  onBack?: (() => void) | undefined;
  /** Replaces the default ErrorState entirely */
  errorFallback?: ReactNode | undefined;
  /** Rendered when function children are given and `data == null` */
  emptyFallback?: ReactNode | undefined;
  /** Wraps the loading/error/empty fallbacks only; success children are untouched */
  "data-testid"?: string | undefined;
}

/**
 * Standard wrapper for the ubiquitous `useQuery → loading skeleton → error
 * card → content` branching. Composes the existing LoadingState/ErrorState
 * pattern components; adopt opportunistically when touching a view rather
 * than as a mass refactor (see docs/ui-assessment.md §5).
 */
export function QueryBoundary<T = unknown>({
  isLoading,
  error,
  data,
  children,
  loadingVariant = "card",
  loadingRows,
  loadingCols,
  loadingClassName,
  loadingFallback,
  errorTitle,
  errorVariant = "inline",
  onRetry,
  onBack,
  errorFallback,
  emptyFallback = null,
  "data-testid": dataTestId,
}: QueryBoundaryProps<T>) {
  const wrap = (node: ReactNode) =>
    dataTestId !== undefined ? <div data-testid={dataTestId}>{node}</div> : <>{node}</>;

  if (isLoading) {
    return wrap(
      loadingFallback ?? (
        <LoadingState
          variant={loadingVariant}
          {...(loadingRows !== undefined && { rows: loadingRows })}
          {...(loadingCols !== undefined && { cols: loadingCols })}
          {...(loadingClassName !== undefined && { className: loadingClassName })}
        />
      )
    );
  }

  if (error) {
    return wrap(
      errorFallback ?? (
        <ErrorState
          error={error}
          variant={errorVariant}
          {...(errorTitle !== undefined && { title: errorTitle })}
          {...(onRetry !== undefined && { onRetry })}
          {...(onBack !== undefined && { onBack })}
        />
      )
    );
  }

  if (typeof children === "function") {
    if (data == null) {
      return wrap(emptyFallback);
    }
    return <>{children(data)}</>;
  }

  return <>{children}</>;
}
