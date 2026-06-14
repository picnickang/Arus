/**
 * Visual + behavioural journey for the live PdM equipment detail page.
 *
 * The /pdm/equipment/:id and /pdm/equipment/:id/telemetry routes used to render
 * a static Figma-fidelity board with hardcoded readings. They now render the
 * data-driven PdmEquipmentDetail (Overview / Sensors / Anomalies / Maintenance).
 *
 * Auth + navigation mirror mobile-readiness-visual-fidelity.spec.ts (the
 * CI-proven pattern for these hub-gated mobile-readiness routes): stub the whole
 * /api surface, log in through the portal form, then navigate *within* the SPA
 * via pushState so the in-memory session token survives (a full page.goto after
 * login drops it and bounces to the login screen). Every equipment-specific read
 * is stubbed, so the assertions and screenshots are deterministic. Screenshots
 * are written under test-results/pdm-visual and attached to the report.
 */

import { test, expect, type Page, type Route, type TestInfo } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

import { ROLE_STORAGE_KEY } from "../../../client/src/config/roles";

const EQUIP_ID = "EQUIP-VIS";
const OUT_DIR = path.resolve(process.cwd(), "test-results/pdm-visual");

/** Recognizable per-sensor values so the screenshots prove live data. */
const SENSOR_VALUES: Record<string, { value: number; unit: string }> = {
  temperature: { value: 87.3, unit: "°C" },
  pressure: { value: 4.2, unit: "bar" },
  vibration: { value: 7.8, unit: "mm/s" },
  flow_rate: { value: 120.5, unit: "L/min" },
  oil_quality: { value: 95.1, unit: "%" },
};

// Captured `?hours=` query strings hitting the telemetry-history endpoint, so a
// test can assert the time-window picker actually re-queries with a new window.
const historyHits: string[] = [];

function healthPayload(lastUpdatedIso: string, status = "warning") {
  return {
    equipmentId: EQUIP_ID,
    healthScore: 72,
    rul: 45,
    rulUncertainty: 9,
    status,
    pFail30d: 0.18,
    aiSummary: "Bearing temperature trending above the expected envelope.",
    lastUpdated: lastUpdatedIso,
    confidence: "high",
  };
}

function telemetryRows(sensorType: string) {
  const spec = SENSOR_VALUES[sensorType];
  if (!spec) {
    return [];
  }
  const now = Date.now();
  return [
    {
      id: `${sensorType}-1`,
      ts: new Date(now - 3_600_000).toISOString(),
      sensorType,
      value: spec.value - 0.6,
      unit: spec.unit,
    },
    {
      id: `${sensorType}-2`,
      ts: new Date(now - 600_000).toISOString(),
      sensorType,
      value: spec.value,
      unit: spec.unit,
    },
  ];
}

function fixtureFor(pathname: string): unknown {
  if (pathname === `/api/equipment/${EQUIP_ID}`) {
    return {
      id: EQUIP_ID,
      name: "MV Atlas — Port Generator",
      type: "Diesel Generator",
      vesselName: "MV Atlas",
      status: "active",
      isActive: true,
      location: "Engine Room",
    };
  }
  if (pathname === `/api/telemetry/baseline/${EQUIP_ID}`) {
    return {
      baselines: Object.entries(SENSOR_VALUES).map(([sensorType, spec]) => ({
        sensorType,
        p50: spec.value,
        avg: spec.value,
        stddev: 1,
        min: spec.value - 2,
        max: spec.value + 2,
        sampleCount: 100,
        bandLow: spec.value - 2,
        bandHigh: spec.value + 2,
      })),
    };
  }
  if (pathname === "/api/sensor-config") {
    return [
      {
        id: "sc-1",
        equipmentId: EQUIP_ID,
        sensorType: "temperature",
        targetUnit: "°C",
        enabled: true,
      },
      {
        id: "sc-2",
        equipmentId: EQUIP_ID,
        sensorType: "vibration",
        targetUnit: "mm/s",
        enabled: false,
      },
    ];
  }
  if (pathname === "/api/analytics/anomaly-detections") {
    return [
      {
        id: "an-1",
        sensorKind: "temperature",
        severity: "high",
        description: "Bearing temp above 2σ envelope",
      },
    ];
  }
  if (pathname === "/api/work-orders") {
    return [
      {
        id: "wo-1",
        reason: "Bearing inspection",
        description: "Inspect generator DE bearing",
        status: "open",
        maintenanceType: "corrective",
      },
    ];
  }
  return [];
}

async function installFixtures(
  page: Page,
  opts: { lastUpdated: string; healthStatus?: string }
): Promise<void> {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.addInitScript(
    ({ key }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(key, "super_admin");
      localStorage.setItem("arus-ui-theme", "dark");
      localStorage.setItem("arus-setup-complete", "true");
    },
    { key: ROLE_STORAGE_KEY }
  );

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

    if (pathname === "/api/portal/login" && request.method() === "POST") {
      return json({
        sessionToken: "pdm-visual-session-token",
        expiresIn: 3600,
        mustChangePassword: false,
        user: { id: "visual-admin", name: "Visual Admin", role: "super_admin" },
      });
    }

    if (pathname === "/api/permissions/me") {
      return json({
        userId: "visual-admin",
        orgId: "org-visual",
        roles: [{ id: "role-admin", name: "super_admin", displayName: "Super Admin" }],
        permissions: {},
        hubAdmin: true,
        hubAccess: null,
        isDevMode: false,
      });
    }

    if (pathname === `/api/pdm/health/${EQUIP_ID}`) {
      return json(healthPayload(opts.lastUpdated, opts.healthStatus));
    }

    if (pathname.startsWith(`/api/telemetry/history/${EQUIP_ID}/`)) {
      historyHits.push(url.search);
      const sensorType = pathname.split("/").pop() ?? "";
      return json(telemetryRows(sensorType));
    }

    return json(fixtureFor(pathname));
  });
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.getByTestId("input-admin-username").fill("visual-admin");
  await page.getByTestId("input-admin-password").fill("playwright-password");
  await page.getByTestId("button-admin-login").click();
  await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible();
}

/** Navigate inside the authenticated SPA so the in-memory session survives. */
async function gotoInApp(page: Page, route: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

const FRESH = () => new Date(Date.now() - 3 * 3_600_000).toISOString();
const STALE = () => new Date(Date.now() - 30 * 3_600_000).toISOString();

test.describe("PdM equipment detail — live data journey", () => {
  test("Overview renders live multi-sensor telemetry, not the static board", async ({
    page,
  }, testInfo) => {
    historyHits.length = 0;
    await installFixtures(page, { lastUpdated: FRESH() });
    await loginAdmin(page);
    await gotoInApp(page, `/pdm/equipment/${EQUIP_ID}/telemetry`);

    // Continuity: the mobile-readiness marker is preserved on the new screen.
    await expect(page.getByTestId("mobile-readiness-screen-pdm-telemetry")).toBeVisible();
    await expect(page.getByTestId("pdm-equipment-detail")).toBeVisible();
    await expect(page.getByTestId("pdm-health-header")).toBeVisible();

    // Live values from the stub, not the old hardcoded board.
    await expect(page.getByTestId("sensor-latest-temperature")).toContainText("87.3");
    await expect(page.getByText("Vibration DE (RMS) mm/s")).toHaveCount(0);

    await capture(page, testInfo, "pdm-overview-live");
  });

  test("time-window picker re-queries history with a wider window", async ({ page }, testInfo) => {
    historyHits.length = 0;
    await installFixtures(page, { lastUpdated: FRESH() });
    await loginAdmin(page);
    await gotoInApp(page, `/pdm/equipment/${EQUIP_ID}/telemetry`);

    await expect(page.getByTestId("multi-sensor-chart")).toBeVisible();
    await capture(page, testInfo, "pdm-timewindow-24h");
    // Default window is 24h.
    expect(historyHits.some((search) => search.includes("hours=24"))).toBe(true);

    historyHits.length = 0;
    await page.getByTestId("time-window-7d").click();
    await expect.poll(() => historyHits.some((search) => search.includes("hours=168"))).toBe(true);
    await capture(page, testInfo, "pdm-timewindow-7d");
  });

  test("health header surfaces a freshness signal", async ({ page }, testInfo) => {
    await installFixtures(page, { lastUpdated: FRESH() });
    await loginAdmin(page);
    await gotoInApp(page, `/pdm/equipment/${EQUIP_ID}`);

    await expect(page.getByTestId("health-freshness")).toContainText("computed");
    await expect(page.getByTestId("health-stale-warning")).toHaveCount(0);
    await capture(page, testInfo, "pdm-health-freshness");
  });

  test("health header flags a stale (>24h) score", async ({ page }, testInfo) => {
    await installFixtures(page, { lastUpdated: STALE() });
    await loginAdmin(page);
    await gotoInApp(page, `/pdm/equipment/${EQUIP_ID}`);

    await expect(page.getByTestId("health-stale-warning")).toBeVisible();
    await capture(page, testInfo, "pdm-health-stale");
  });

  test("tabs reveal sensors, anomalies, and maintenance", async ({ page }, testInfo) => {
    await installFixtures(page, { lastUpdated: FRESH() });
    await loginAdmin(page);
    await gotoInApp(page, `/pdm/equipment/${EQUIP_ID}`);

    await expect(page.getByTestId("pdm-equipment-detail")).toBeVisible();
    await page.getByTestId("tab-anomalies").click();
    await expect(page.getByTestId("anomalies-table")).toBeVisible();
    await expect(page.getByText("Bearing temp above 2σ envelope")).toBeVisible();
    await capture(page, testInfo, "pdm-tabs-anomalies");

    await page.getByTestId("tab-maintenance").click();
    await expect(page.getByTestId("maintenance-table")).toBeVisible();

    await page.getByTestId("tab-sensors").click();
    await expect(page.getByTestId("sensors-table")).toBeVisible();
  });
});
