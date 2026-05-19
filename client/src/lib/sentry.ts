/**
 * Wave 0.4 — Sentry browser-side init.
 *
 * Gated on `VITE_SENTRY_DSN` so local dev, CI and self-hosted
 * deployments without a Sentry org just no-op. The Vite env-var
 * prefix is mandatory — without `VITE_` the value is stripped from
 * the client bundle.
 *
 * BrowserTracing is enabled with a 10% trace sample so we get
 * page-load + navigation transactions without paying for full
 * fidelity. Replay is OFF by default because session replay can
 * carry deep PII (sensor screens, crew names) and needs an explicit
 * customer-side opt-in before we send anything off-vessel.
 */

import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Don't capture console.log noise — only actual errors and warns.
    // The structured logger on the server side is the canonical log
    // surface; the client only needs to report what blew up.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console" && breadcrumb.level !== "error") {
        return null;
      }
      return breadcrumb;
    },
  });
}
