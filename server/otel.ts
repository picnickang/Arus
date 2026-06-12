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
import { createRequire } from "node:module";
import type { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import type { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { NodeSDK } from "@opentelemetry/sdk-node";

const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
const enabled = Boolean(endpoint);

// P2 #24 — Observability warn-once. Match instrument.ts for Sentry.
if (!endpoint && process.env["NODE_ENV"] === "production") {
  console.warn(
    "[otel] OTEL_EXPORTER_OTLP_ENDPOINT is not set in production — distributed tracing is DISABLED."
  );
}

let started = false;

// `createRequire` keeps the lazy-load behaviour (the SDK is not pulled in
// when the env var is absent) while avoiding `require` in this ESM module.
const requireFromHere = createRequire(
  typeof import.meta.url === "string" ? import.meta.url : __filename
);

interface NodeSDKLike {
  start(): void;
  shutdown(): Promise<void>;
}
interface NodeSDKModule {
  NodeSDK: new (...args: ConstructorParameters<typeof NodeSDK>) => NodeSDKLike;
}
interface AutoInstrumentationsModule {
  getNodeAutoInstrumentations: typeof getNodeAutoInstrumentations;
}
interface OTLPExporterModule {
  OTLPTraceExporter: new (
    ...args: ConstructorParameters<typeof OTLPTraceExporter>
  ) => OTLPTraceExporter;
}
type OTLPTraceExporterConfig = ConstructorParameters<typeof OTLPTraceExporter>[0];

if (enabled && endpoint) {
  try {
    const { NodeSDK: NodeSDKCtor } = requireFromHere("@opentelemetry/sdk-node") as NodeSDKModule;
    const { getNodeAutoInstrumentations: getNodeAutoInstrumentationsForNode } = requireFromHere(
      "@opentelemetry/auto-instrumentations-node"
    ) as AutoInstrumentationsModule;
    const { OTLPTraceExporter: OTLPTraceExporterCtor } = requireFromHere(
      "@opentelemetry/exporter-trace-otlp-http"
    ) as OTLPExporterModule;
    const traceExporterConfig: OTLPTraceExporterConfig = {
      url: `${endpoint.replace(/\/$/, "")}/v1/traces`,
    };
    if (process.env["OTEL_EXPORTER_OTLP_HEADERS"]) {
      traceExporterConfig.headers = parseHeaderEnv(process.env["OTEL_EXPORTER_OTLP_HEADERS"]);
    }

    const sdk = new NodeSDKCtor({
      serviceName: process.env["OTEL_SERVICE_NAME"] || "arus-server",
      traceExporter: new OTLPTraceExporterCtor(traceExporterConfig),
      instrumentations: [
        getNodeAutoInstrumentationsForNode({
          // fs instrumentation is extremely noisy and rarely useful
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    sdk.start();
    started = true;

    process.on("SIGTERM", () => {
      sdk.shutdown().catch((e: unknown) => console.warn("[otel] shutdown failed:", e));
    });

    // Defer logging to avoid yanking structured-logger before it's ready.
    queueMicrotask(() => {
      console.log(
        `[otel] tracing enabled → ${endpoint} (service=${process.env["OTEL_SERVICE_NAME"] || "arus-server"})`
      );
    });
  } catch (err) {
    console.warn("[otel] failed to initialise; continuing without tracing:", err);
  }
}

function parseHeaderEnv(raw: string): Record<string, string> {
  // Format: key1=val1,key2=val2
  const out: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) {
      out[k] = v;
    }
  }
  return out;
}
