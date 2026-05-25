/**
 * Wave 2.1 — Browser-side OpenTelemetry tracing.
 *
 * Gated on VITE_OTEL_EXPORTER_OTLP_ENDPOINT. When absent the module
 * exports a no-op so call sites need no conditional wrapping.
 *
 * Instruments fetch + XHR so frontend → backend traces are stitched
 * via W3C traceparent propagation, joining the spans emitted by
 * server/otel.ts on the same trace.
 */
const endpoint = import.meta.env['VITE_OTEL_EXPORTER_OTLP_ENDPOINT'] as string | undefined;

// P2 #24 — Observability warn-once on missing endpoint in production
// builds, so an operator inspecting the console sees the gap rather
// than having to grep the bundle for a missing env var.
let warnedMissingEndpoint = false;
function warnOnceMissingEndpoint(): void {
  if (warnedMissingEndpoint) {
    return;
  }
  warnedMissingEndpoint = true;
  if (import.meta.env.PROD && !endpoint) {
    console.warn(
      "[otel] VITE_OTEL_EXPORTER_OTLP_ENDPOINT is not set in a production build — browser tracing is DISABLED.",
    );
  }
}

let initialised = false;

export async function initBrowserOtel(): Promise<void> {
  if (!endpoint) {
    warnOnceMissingEndpoint();
    return;
  }
  if (initialised) {
    return;
  }
  initialised = true;

  try {
    const [
      { WebTracerProvider, BatchSpanProcessor },
      { OTLPTraceExporter },
      { ZoneContextManager },
      { registerInstrumentations },
      { FetchInstrumentation },
      { XMLHttpRequestInstrumentation },
    ] = await Promise.all([
      import("@opentelemetry/sdk-trace-web"),
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@opentelemetry/context-zone"),
      import("@opentelemetry/instrumentation"),
      import("@opentelemetry/instrumentation-fetch"),
      import("@opentelemetry/instrumentation-xml-http-request"),
    ]);

    const provider = new WebTracerProvider({
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: `${endpoint.replace(/\/$/, "")}/v1/traces`,
          }),
        ),
      ],
    });

    provider.register({ contextManager: new ZoneContextManager() });

    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: [/.*/],
        }),
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: [/.*/],
        }),
      ],
    });
  } catch (err) {
    // Tracing is best-effort: never block app boot.
    console.warn("[otel] browser init failed; continuing without tracing", err);
  }
}
