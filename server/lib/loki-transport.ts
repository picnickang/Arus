/**
 * Wave 2.2 — Loki log shipping.
 *
 * Optional Pino transport that forwards structured-logger output to a
 * Grafana Loki instance. The existing `structured-logger.ts` JSON
 * output is preserved unchanged on stdout (the Kubernetes / Docker
 * scrape path stays a valid fallback); this module just adds a second
 * destination when `LOKI_URL` is set.
 *
 * The Pino transport runs in a Worker — failures isolated from the
 * main event loop. Auth via `LOKI_BASIC_AUTH` ("user:pass") or
 * `LOKI_BEARER_TOKEN`. Default labels include `service=arus-server`
 * + `env={NODE_ENV}` so Grafana dashboards can pivot on environment.
 */
const url = process.env.LOKI_URL;
export const lokiEnabled = Boolean(url);

export function createLokiPinoTransport(): unknown | undefined {
  if (!lokiEnabled || !url) return undefined;
  // Lazy require so pino-loki isn't loaded when the env var is absent.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pino = require("pino");
  return pino.transport({
    target: "pino-loki",
    options: {
      host: url.replace(/\/$/, ""),
      batching: true,
      interval: 5,
      labels: {
        service: process.env.OTEL_SERVICE_NAME || "arus-server",
        env: process.env.NODE_ENV || "development",
      },
      basicAuth: process.env.LOKI_BASIC_AUTH
        ? (() => {
            const idx = process.env.LOKI_BASIC_AUTH!.indexOf(":");
            return idx > 0
              ? {
                  username: process.env.LOKI_BASIC_AUTH!.slice(0, idx),
                  password: process.env.LOKI_BASIC_AUTH!.slice(idx + 1),
                }
              : undefined;
          })()
        : undefined,
      headers: process.env.LOKI_BEARER_TOKEN
        ? { Authorization: `Bearer ${process.env.LOKI_BEARER_TOKEN}` }
        : undefined,
    },
  });
}

/**
 * Returns a Pino logger pre-wired with the Loki transport when enabled,
 * or undefined when not. Callers should treat the return value as a
 * best-effort secondary sink — the canonical log path remains
 * structured-logger's stdout JSON output.
 */
export function createLokiPinoLogger(): unknown | undefined {
  if (!lokiEnabled) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pino = require("pino");
    const transport = createLokiPinoTransport();
    if (!transport) return undefined;
    return pino({ level: process.env.LOG_LEVEL || "info" }, transport);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[loki] init failed; continuing without Loki transport", err);
    return undefined;
  }
}
