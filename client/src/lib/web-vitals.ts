/**
 * Wave 5.9 — Web Vitals + route budgets.
 *
 * Captures Core Web Vitals (LCP, INP-proxy via Event Timing, CLS, FCP,
 * TTFB) using the native PerformanceObserver API — no `web-vitals`
 * package install required. Posts a single beacon per page-hide to
 * `/api/v1/observability/web-vitals` for server-side aggregation; on
 * the dev server the route is a no-op accepting any payload.
 *
 * Route budgets are evaluated client-side and logged as a console warn
 * when exceeded so PR previews can spot regressions before merge.
 * Server-side regression gating belongs in CI, not in the browser.
 *
 * Budgets (per the gap doc):
 *   LCP < 2.5s, INP < 200ms, CLS < 0.1
 */

interface VitalEntry {
  name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  route: string;
}

const BUDGETS: Record<VitalEntry["name"], { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

function rate(name: VitalEntry["name"], value: number): VitalEntry["rating"] {
  const b = BUDGETS[name];
  if (value <= b.good) return "good";
  if (value <= b.poor) return "needs-improvement";
  return "poor";
}

const collected: VitalEntry[] = [];

function record(name: VitalEntry["name"], value: number): void {
  const entry: VitalEntry = {
    name,
    value: Number(value.toFixed(2)),
    rating: rate(name, value),
    route: typeof window === "undefined" ? "" : window.location.pathname,
  };
  collected.push(entry);
  if (entry.rating === "poor") {
    // eslint-disable-next-line no-console
    console.warn(`[web-vitals] ${name}=${entry.value} on ${entry.route} (budget breached)`);
  }
}

function safeObserve(type: string, cb: (entries: PerformanceEntryList) => void): void {
  try {
    const supported = (PerformanceObserver as object as { supportedEntryTypes?: string[] })
      .supportedEntryTypes;
    if (supported && !supported.includes(type)) return;
    const obs = new PerformanceObserver((list) => cb(list.getEntries()));
    obs.observe({ type, buffered: true } as PerformanceObserverInit);
  } catch {
    // PerformanceObserver not available — quietly bail.
  }
}

function flush(): void {
  if (collected.length === 0) return;
  const payload = JSON.stringify({
    sentAt: Date.now(),
    href: window.location.href,
    entries: collected.splice(0),
  });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/v1/observability/web-vitals", blob);
      return;
    }
  } catch {
    // sendBeacon can throw under strict CSP — fall through to fetch.
  }
  try {
    fetch("/api/v1/observability/web-vitals", {
      method: "POST",
      body: payload,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore — observability must never break the page.
  }
}

let initialized = false;

export function initWebVitals(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // LCP: latest entry wins per the spec.
  let lastLcp = 0;
  safeObserve("largest-contentful-paint", (entries) => {
    for (const e of entries) {
      const lcp = e as PerformanceEntry & { renderTime?: number };
      lastLcp = lcp.renderTime || lcp.startTime || lastLcp;
    }
  });

  // INP proxy: largest event-timing duration observed.
  let largestEventDuration = 0;
  safeObserve("event", (entries) => {
    for (const e of entries) {
      const d = (e as PerformanceEntry & { duration: number }).duration;
      if (typeof d === "number" && d > largestEventDuration) largestEventDuration = d;
    }
  });

  // CLS: running sum of layout-shift values that aren't input-induced.
  let clsValue = 0;
  safeObserve("layout-shift", (entries) => {
    for (const e of entries) {
      const ls = e as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      if (!ls.hadRecentInput) clsValue += ls.value || 0;
    }
  });

  // FCP: paint entry named "first-contentful-paint".
  safeObserve("paint", (entries) => {
    for (const e of entries) {
      if (e.name === "first-contentful-paint") record("FCP", e.startTime);
    }
  });

  // TTFB from the navigation entry.
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) record("TTFB", nav.responseStart);
  } catch {
    // ignore
  }

  const finalize = () => {
    if (lastLcp > 0) record("LCP", lastLcp);
    if (largestEventDuration > 0) record("INP", largestEventDuration);
    record("CLS", clsValue);
    flush();
  };

  // visibilitychange + pagehide are the recommended terminals for vitals.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") finalize();
  });
  window.addEventListener("pagehide", finalize, { once: true });
}
