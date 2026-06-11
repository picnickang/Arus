/**
 * Wave 5.9 — Web Vitals receipt endpoint.
 *
 * Accepts a single beacon POST per page-hide from the browser. The
 * payload is small (one summary per vital) so we don't rate-limit
 * aggressively; helmet+CORS already protect us. Entries are recorded
 * into Prometheus and a single info-level log line per beacon — that's
 * enough for the dashboard and PR-regression chart.
 *
 * Public path (registered in bootstrap/public-api-paths.ts) because
 * `navigator.sendBeacon` cannot always attach cookies and the data is
 * intrinsically untrusted anyway.
 */

import { Router, type Request, type Response } from "express";
import client from "prom-client";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Observability:WebVitals");

export const webVitalsHistogram = new client.Histogram({
  name: "arus_web_vitals_value",
  help: "Browser-reported Core Web Vitals per metric and route.",
  labelNames: ["metric", "route", "rating"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 12, 20],
});

export const webVitalsBreaches = new client.Counter({
  name: "arus_web_vitals_breaches_total",
  help: "Count of Web Vitals beacons rated poor.",
  labelNames: ["metric", "route"],
});

interface BeaconEntry {
  name: string;
  value: number;
  rating?: string;
  route?: string;
}

interface BeaconPayload {
  entries?: BeaconEntry[];
}

const MAX_ENTRIES = 16;
const MAX_NAME_LEN = 24;
const MAX_ROUTE_LEN = 256;

function sanitizeName(n: unknown): string {
  if (typeof n !== "string") {
    return "unknown";
  }
  return n.slice(0, MAX_NAME_LEN).replace(/[^A-Za-z0-9_-]/g, "_");
}
function sanitizeRoute(r: unknown): string {
  if (typeof r !== "string") {
    return "/";
  }
  return r.slice(0, MAX_ROUTE_LEN);
}

export function createWebVitalsRouter(): Router {
  const router = Router();
  router.post("/observability/web-vitals", (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as BeaconPayload;
      const entries = Array.isArray(body.entries) ? body.entries.slice(0, MAX_ENTRIES) : [];
      for (const e of entries) {
        const metric = sanitizeName(e?.name);
        const route = sanitizeRoute(e?.route);
        const value = typeof e?.value === "number" && Number.isFinite(e.value) ? e.value : NaN;
        if (Number.isNaN(value)) {
          continue;
        }
        const rating = sanitizeName(e?.rating ?? "unknown");
        const scaled = metric === "CLS" ? value * 100 : value / 1000;
        webVitalsHistogram.observe({ metric, route, rating }, scaled);
        if (rating === "poor") {
          webVitalsBreaches.inc({ metric, route });
        }
      }
      logger.info?.("web-vitals beacon", {
        count: entries.length,
        route: sanitizeRoute(entries[0]?.route),
      });
      res.status(204).end();
    } catch (err) {
      logger.warn("web-vitals receipt failed — swallowing", {
        err: err instanceof Error ? err.message : String(err),
      });
      res.status(204).end();
    }
  });
  return router;
}
