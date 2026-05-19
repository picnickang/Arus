/**
 * Wave 2.1 — OpenTelemetry server tracing.
 *
 * Imported VERY EARLY (before instrument.ts / structured-logger / any
 * domain code) so auto-instrumentation can hook the module loader for
 * Express / http / pg / pg-boss before they are first required.
 *
 * Gated on OTEL_EXPORTER_OTLP_ENDPOINT — if absent, this module is a
 * complete no-op so local dev / CI / self-host without a collector pay
 * zero cost. Sentry (Wave 0.4) remains the always-on error sink.
 *
 * Mutual-exclusion note: when both Sentry and OTel are enabled, Sentry
 * v10 uses OpenTelemetry under the hood and will reuse this SDK's
 * tracer provider rather than registering a second one. To minimize
 * surprise we still let each init independently — Sentry no-ops the
 * duplicate registration internally.
 */
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const enabled = Boolean(endpoint);

let started = false;

if (enabled && endpoint) {
  try {
    // Lazy require so the SDK is not pulled in when the env var is
    // absent. Keeps cold-start cost at zero for the common case.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require("@opentelemetry/sdk-node");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");

    const sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME || "arus-server",
      traceExporter: new OTLPTraceExporter({
        url: `${endpoint.replace(/\/$/, "")}/v1/traces`,
        headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
          ? parseHeaderEnv(process.env.OTEL_EXPORTER_OTLP_HEADERS)
          : undefined,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // fs instrumentation is extremely noisy and rarely useful
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    sdk.start();
    started = true;

    process.on("SIGTERM", () => {
      sdk
        .shutdown()
        .catch((e: unknown) => console.warn("[otel] shutdown failed:", e));
    });

    // Defer logging to avoid yanking structured-logger before it's ready.
    queueMicrotask(() => {
      // eslint-disable-next-line no-console
      console.log(
        `[otel] tracing enabled → ${endpoint} (service=${process.env.OTEL_SERVICE_NAME || "arus-server"})`,
      );
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[otel] failed to initialise; continuing without tracing:", err);
  }
}

function parseHeaderEnv(raw: string): Record<string, string> {
  // Format: key1=val1,key2=val2
  const out: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export const otelEnabled = enabled && started;
