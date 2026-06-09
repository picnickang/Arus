/**
 * Request-Scoped Span Tracking
 * Lightweight tracing for individual operations within a request lifecycle
 * with Prometheus metrics integration
 *
 * Usage:
 *   const span = startSpan("db_query", "getCrewRestRange");
 *   try {
 *     const result = await query();
 *     span.end();
 *     return result;
 *   } catch (error) {
 *     span.end({ error: true });
 *     throw error;
 *   }
 *
 * Or use the wrapper:
 *   const result = await withSpan("db_query", "getCrewRestRange", async () => {
 *     return query();
 *   });
 */

import { getCorrelationId } from "./correlation-context";
import client from "prom-client";

const spanDurationHistogram = new client.Histogram({
  name: "arus_span_duration_seconds",
  help: "Duration of operation spans in seconds",
  labelNames: ["category", "operation", "status"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const spanCounter = new client.Counter({
  name: "arus_spans_total",
  help: "Total number of operation spans",
  labelNames: ["category", "operation", "status"],
});

const activeSpansGauge = new client.Gauge({
  name: "arus_active_spans",
  help: "Number of currently active spans",
  labelNames: ["category"],
});

export interface Span {
  id: string;
  category: string;
  name: string;
  startTime: number;
  endTime?: number | undefined;
  durationMs?: number | undefined;
  error?: boolean | undefined;
  metadata?: Record<string, unknown> | undefined;
  parentSpanId?: string | undefined;
}

export interface SpanContext {
  requestId: string;
  spans: Span[];
  currentSpanId?: string | undefined;
}

const requestSpans = new Map<string, SpanContext>();

let spanIdCounter = 0;
function generateSpanId(): string {
  return `span_${++spanIdCounter}_${Date.now().toString(36)}`;
}

const activeSpanCounts = new Map<string, number>();

function safeIncActiveSpans(category: string): void {
  const current = activeSpanCounts.get(category) ?? 0;
  activeSpanCounts.set(category, current + 1);
  activeSpansGauge.set({ category }, current + 1);
}

function safeDecActiveSpans(category: string): void {
  const current = activeSpanCounts.get(category) ?? 0;
  const newCount = Math.max(0, current - 1);
  activeSpanCounts.set(category, newCount);
  activeSpansGauge.set({ category }, newCount);
}

export function startSpan(
  category: string,
  name: string,
  metadata?: Record<string, unknown>
): {
  span: Span;
  end: (result?: { error?: boolean; metadata?: Record<string, unknown> }) => void;
} {
  const requestId = getCorrelationId();

  let existing = requestSpans.get(requestId);
  if (!existing) {
    existing = { requestId, spans: [] };
    requestSpans.set(requestId, existing);
  }
  const context = existing;

  const span: Span = {
    id: generateSpanId(),
    category,
    name,
    startTime: Date.now(),
    parentSpanId: context.currentSpanId,
    metadata,
  };

  context.spans.push(span);
  const previousSpanId = context.currentSpanId;
  context.currentSpanId = span.id;

  safeIncActiveSpans(category);

  let ended = false;

  return {
    span,
    end: (result?: { error?: boolean; metadata?: Record<string, unknown> }) => {
      if (ended) {
        return;
      }
      ended = true;

      span.endTime = Date.now();
      span.durationMs = span.endTime - span.startTime;
      span.error = result?.error;
      if (result?.metadata) {
        span.metadata = { ...span.metadata, ...result.metadata };
      }
      context.currentSpanId = previousSpanId;

      const status = span.error ? "error" : "success";
      spanDurationHistogram.observe({ category, operation: name, status }, span.durationMs / 1000);
      spanCounter.inc({ category, operation: name, status });
      safeDecActiveSpans(category);
    },
  };
}

export async function withSpan<T>(
  category: string,
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const { end } = startSpan(category, name, metadata);
  try {
    const result = await fn();
    end();
    return result;
  } catch (err) {
    end({
      error: true,
      metadata: { errorMessage: err instanceof Error ? err.message : "Unknown error" },
    });
    throw err;
  }
}

export function syncSpan<T>(
  category: string,
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  const { end } = startSpan(category, name, metadata);
  try {
    const result = fn();
    end();
    return result;
  } catch (error) {
    end({ error: true });
    throw error;
  }
}

export function getRequestSpans(requestId?: string): Span[] {
  const id = requestId || getCorrelationId();
  const context = requestSpans.get(id);
  return context?.spans ?? [];
}

export function getRequestSpanSummary(requestId?: string): {
  totalSpans: number;
  byCategory: Record<string, { count: number; totalMs: number; maxMs: number }>;
  slowestSpans: Span[];
  errorSpans: Span[];
} {
  const spans = getRequestSpans(requestId);

  const byCategory: Record<string, { count: number; totalMs: number; maxMs: number }> = {};
  const slowSpans: Span[] = [];
  const errorSpans: Span[] = [];

  for (const span of spans) {
    if (!span.durationMs) {
      continue;
    }

    const cat = byCategory[span.category] ?? { count: 0, totalMs: 0, maxMs: 0 };
    cat.count++;
    cat.totalMs += span.durationMs;
    cat.maxMs = Math.max(cat.maxMs, span.durationMs);
    byCategory[span.category] = cat;

    if (span.durationMs > 50) {
      slowSpans.push(span);
    }

    if (span.error) {
      errorSpans.push(span);
    }
  }

  slowSpans.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));

  return {
    totalSpans: spans.length,
    byCategory,
    slowestSpans: slowSpans.slice(0, 10),
    errorSpans,
  };
}

export function clearRequestSpans(requestId?: string): void {
  const id = requestId || getCorrelationId();
  requestSpans.delete(id);
}

const SPAN_RETENTION_MS = 60000;
const SPAN_MAX_REQUESTS = 1000;

export function cleanupOldSpans(): void {
  const cutoff = Date.now() - SPAN_RETENTION_MS;
  const toDelete: string[] = [];

  for (const [requestId, context] of requestSpans) {
    const lastSpan = context.spans[context.spans.length - 1];
    if (lastSpan && (lastSpan.endTime || lastSpan.startTime) < cutoff) {
      toDelete.push(requestId);
    }
  }

  for (const requestId of toDelete) {
    requestSpans.delete(requestId);
  }

  if (requestSpans.size > SPAN_MAX_REQUESTS) {
    const entries = Array.from(requestSpans.entries());
    entries.sort((a, b) => {
      const aTime = a[1].spans[0]?.startTime ?? 0;
      const bTime = b[1].spans[0]?.startTime ?? 0;
      return aTime - bTime;
    });

    const excess = requestSpans.size - SPAN_MAX_REQUESTS;
    for (let i = 0; i < excess; i++) {
      const entry = entries[i];
      if (entry) {
        requestSpans.delete(entry[0]);
      }
    }
  }
}

let cleanupInterval: NodeJS.Timeout | undefined;
if (process.env["DISABLE_OBSERVABILITY_TIMERS"] !== "true" && process.env["NODE_ENV"] !== "test") {
  cleanupInterval = setInterval(cleanupOldSpans, 30000);
  cleanupInterval.unref?.();
}

export const _internals = {
  stopCleanupInterval() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = undefined;
    }
  },
};

export function getRecentSlowRequests(thresholdMs: number = 200): Array<{
  requestId: string;
  totalDurationMs: number;
  spanCount: number;
  slowestCategory: string;
  path?: string;
}> {
  const results: Array<{
    requestId: string;
    totalDurationMs: number;
    spanCount: number;
    slowestCategory: string;
    path?: string;
  }> = [];

  for (const [requestId, context] of requestSpans) {
    if (context.spans.length === 0) {
      continue;
    }

    const firstSpan = context.spans[0];
    const lastSpan = context.spans[context.spans.length - 1];
    if (!firstSpan || !lastSpan) {
      continue;
    }
    const totalDuration = (lastSpan.endTime || Date.now()) - firstSpan.startTime;

    if (totalDuration > thresholdMs) {
      let slowestCategory = "";
      let maxCategoryTime = 0;

      const categoryTotals: Record<string, number> = {};
      for (const span of context.spans) {
        if (!span.durationMs) {
          continue;
        }
        categoryTotals[span.category] = (categoryTotals[span.category] ?? 0) + span.durationMs;
      }

      for (const [cat, time] of Object.entries(categoryTotals)) {
        if (time > maxCategoryTime) {
          maxCategoryTime = time;
          slowestCategory = cat;
        }
      }

      results.push({
        requestId,
        totalDurationMs: totalDuration,
        spanCount: context.spans.length,
        slowestCategory,
      });
    }
  }

  results.sort((a, b) => b.totalDurationMs - a.totalDurationMs);
  return results.slice(0, 20);
}
