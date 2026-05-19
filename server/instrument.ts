/**
 * Wave 0.4 — Sentry server-side init.
 *
 * Sentry's automatic instrumentation (Express, http, pg, etc.) hooks
 * into Node module loading, so this file MUST be imported before any
 * other application module that touches those subsystems. It's the
 * very first import in `server/index.ts` for that reason.
 *
 * Init is gated on `SENTRY_DSN`. When the env var is absent (local
 * dev, CI) we skip init entirely so there's no overhead and no
 * accidental error-stream pollution. `tracesSampleRate: 0.1` gives
 * us a 10% sample of transactions — enough to spot regressions
 * without paying for full-fidelity OTel infra yet (per gap plan).
 */

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  // Lazy require so that environments without the dep installed
  // (unusual, but defensive) still boot. We can't use a dynamic
  // import here because that defers init past the point where
  // auto-instrumentation needs to attach.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sentry = require("@sentry/node");

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE ?? process.env.npm_package_version,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Profiles are off by default — opt in via env var. The CPU
    // profiler integration is shipped separately (@sentry/profiling-node)
    // and we haven't installed it, so leaving this 0 is intentional.
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0),
    // Defense in depth — the PII redactor in the LLM gateway
    // (Wave 3.6) handles outbound model traffic, but errors carry
    // their own free-text. Sentry's beforeSend hook lets us strip
    // anything that looks like an obvious credential before upload.
    beforeSend(event: { request?: { headers?: Record<string, unknown> } }) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-api-key"];
      }
      return event;
    },
  });
}
