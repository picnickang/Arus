/**
 * Wave 2.1 — Trace-context propagation across pg-boss job boundaries
 * and any other async dispatch where the W3C traceparent header would
 * otherwise be dropped.
 *
 * The OTel auto-instrumentations cover synchronous Express / http / pg
 * spans, but a queued job runs in its own JS task with no parent ctx.
 * Producers call `injectTraceContext(data)` to stamp the current span
 * onto the job payload; consumers call `withTraceContext(data, fn)` to
 * resume execution under that parent span.
 *
 * Designed to be a no-op when OTel is disabled — the API is always
 * available so call sites need no conditional wrapping.
 */
import { context, propagation, trace, type Span } from "@opentelemetry/api";

const CARRIER_KEY = "__otel";

export interface TraceCarrier {
  [CARRIER_KEY]?: Record<string, string>;
}

export function injectTraceContext<T extends object>(data: T): T & TraceCarrier {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  if (Object.keys(carrier).length === 0) {
    return data as T & TraceCarrier;
  }
  return { ...data, [CARRIER_KEY]: carrier } as T & TraceCarrier;
}

export async function withTraceContext<T>(
  data: TraceCarrier | undefined | null,
  spanName: string,
  fn: (span: Span) => Promise<T> | T
): Promise<T> {
  const carrier = data?.[CARRIER_KEY];
  const parent = carrier ? propagation.extract(context.active(), carrier) : context.active();
  const tracer = trace.getTracer("arus-pgboss");
  return context.with(parent, () =>
    tracer.startActiveSpan(spanName, async (span) => {
      try {
        return await fn(span);
      } catch (e) {
        span.recordException(e as Error);
        throw e;
      } finally {
        span.end();
      }
    })
  );
}
