/**
 * Shared SPA auth + fixture helpers for the Playwright lanes.
 *
 * Lifted (behaviour-preserving) from `nav-matrix.spec.ts` and
 * `mobile-readiness-control-crawl.spec.ts`, which previously duplicated these.
 * `installRoleFixtures` is parameterised so each caller reproduces its exact
 * prior mock surface (permission shape, viewport, perf-overlay hiding,
 * diagnostics) — no assertion changes in the refactored specs.
 */

import { expect, type Page, type Route } from "@playwright/test";
import { ROLE_STORAGE_KEY } from "../../../client/src/config/roles";

const nowIso = "2026-06-12T00:00:00.000Z";

/**
 * Narrowly-scoped allowlist of known benign dev-only console noise — the
 * superset of the `smoke.spec.ts` / `nav-matrix.spec.ts` lists. Never broaden
 * to a whole-subsystem prefix (e.g. blanket `[vite]`): that would hide real
 * bundle / HMR failures.
 */
export function isBenignConsoleError(text: string): boolean {
  if (text.includes("Failed to load resource") && text.includes("favicon")) {
    return true;
  }
  // Authz responses the app handles (login redirect / permission gate), not crashes.
  if (
    text.includes("Failed to load resource") &&
    (text.includes("401 (Unauthorized)") || text.includes("403 (Forbidden)"))
  ) {
    return true;
  }
  // Egress-blocked external asset (font/CDN) in the sandbox — environment, not app.
  if (text.includes("Failed to load resource") && text.includes("ERR_CERT")) {
    return true;
  }
  // Vite dev-server HMR noise (only the DEV renderer; never the production bundle).
  if (text.includes("[vite] connecting...")) {
    return true;
  }
  if (text.includes("[vite] connected.")) {
    return true;
  }
  if (text.includes("WebSocket connection to 'ws") && text.includes("handshake")) {
    return true;
  }
  if (
    text.includes("Failed to construct 'WebSocket'") &&
    text.includes("ws://localhost:undefined")
  ) {
    return true;
  }
  return false;
}

export async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** Fixture diagnostics payloads so `/system` health panels render deterministically. */
export const diagnosticsResponses: Record<string, unknown> = {
  "/api/diagnostics/health": {
    status: "healthy",
    timestamp: nowIso,
    version: "playwright",
    uptime: 3600,
    checks: {
      database: { status: "pass", responseTimeMs: 4, message: "Fixture database healthy" },
      telemetry: { status: "pass", details: { bufferUtilization: 0 } },
      memory: { status: "pass", details: { utilizationPercent: 22, heapUsedMB: 128 } },
      services: [{ name: "API", status: "running", lastHealthCheck: nowIso }],
    },
  },
  "/api/diagnostics/metrics": {
    memory: { heapUsedMB: 128, heapTotalMB: 512, externalMB: 16, utilizationPercent: 22 },
    uptime: 3600,
    nodeVersion: "v20-playwright",
    timestamp: nowIso,
  },
  "/api/diagnostics/telemetry/stats": {
    batchWriter: {
      bufferSize: 0,
      totalQueued: 0,
      totalFlushed: 0,
      totalEvicted: 0,
      totalErrors: 0,
      totalDropped: 0,
      lastFlushTime: null,
      lastFlushDurationMs: 0,
      lastFlushCount: 0,
      avgFlushDurationMs: 0,
      isRunning: true,
    },
    health: { bufferUtilization: 0, evictionRate: 0, writeSuccessRate: 100 },
    timestamp: nowIso,
  },
  "/api/diagnostics/test-suites": { suites: [] },
  "/api/diagnostics/config": {
    telemetry: { batchIntervalMs: 1000, bufferSize: 1000, evictionPercent: 0.1, maxRetries: 3 },
    environment: { nodeEnv: "test", deploymentMode: "playwright" },
    features: { dualDatabase: false, mlPredictions: false, fmccIntegration: false },
  },
};

export type PermissionMatrix = Record<string, unknown>;

export interface RoleFixtureOptions {
  role: string;
  /** Defaults to true for system_admin / super_admin. */
  adminCapable?: boolean;
  /** Override the permission matrix; defaults to a broad admin/empty matrix. */
  permissions?: PermissionMatrix;
  orgId?: string;
  /** Inject the perf-overlay-hiding MutationObserver (control-crawl parity). */
  hidePerfOverlay?: boolean;
  /** Pin a viewport before fixtures install (control-crawl parity). */
  viewport?: { width: number; height: number };
  /** Serve fixture diagnostics payloads (nav-matrix) vs `[]` (control-crawl). */
  serveDiagnostics?: boolean;
}

/**
 * Intercept all `/api` requests and fulfill login + permissions deterministically
 * so a lane renders without a live backend. Everything else returns `[]`.
 */
export async function installRoleFixtures(page: Page, options: RoleFixtureOptions): Promise<void> {
  const { role } = options;
  const adminCapable = options.adminCapable ?? (role === "system_admin" || role === "super_admin");
  const orgId = options.orgId ?? "default-org-id";
  const serveDiagnostics = options.serveDiagnostics ?? true;

  if (options.viewport) {
    await page.setViewportSize(options.viewport);
  }

  await page.addInitScript(
    ({ key, value, hidePerf }) => {
      try {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem(key, value);
        localStorage.setItem("arus-ui-theme", "dark");
        localStorage.setItem("arus-setup-complete", "true");
      } catch {
        /* private mode — fine */
      }
      if (!hidePerf) {
        return;
      }
      const hidePerfOverlay = () => {
        document.querySelectorAll('[data-testid="button-show-perf-overlay"]').forEach((button) => {
          const container = button.parentElement;
          if (container instanceof HTMLElement) {
            container.style.display = "none";
            container.style.pointerEvents = "none";
          }
        });
      };
      const install = () => {
        hidePerfOverlay();
        if (document.documentElement) {
          new MutationObserver(hidePerfOverlay).observe(document.documentElement, {
            childList: true,
            subtree: true,
          });
        }
      };
      if (document.documentElement) {
        install();
      } else {
        window.addEventListener("DOMContentLoaded", install, { once: true });
      }
    },
    { key: ROLE_STORAGE_KEY, value: role, hidePerf: Boolean(options.hidePerfOverlay) }
  );

  const defaultPermissions: PermissionMatrix = adminCapable
    ? {
        system: ["view", "create", "edit", "delete", "manage"],
        admin: ["view", "create", "edit", "delete", "manage"],
      }
    : {};

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/portal/login" && request.method() === "POST") {
      await fulfillJson(route, {
        sessionToken: `playwright-${role}`,
        expiresIn: 3600,
        mustChangePassword: false,
        user: {
          id: `playwright-${role}`,
          name: adminCapable ? "Playwright Admin" : role,
          role,
          orgId,
        },
      });
      return;
    }

    if (path === "/api/permissions/me") {
      await fulfillJson(route, {
        userId: `playwright-${role}`,
        orgId,
        roles: [{ id: `role-${role}`, name: role, displayName: role }],
        permissions: options.permissions ?? defaultPermissions,
        hubAdmin: adminCapable,
        hubAccess: adminCapable ? null : [],
        isDevMode: false,
      });
      return;
    }

    if (serveDiagnostics && Object.prototype.hasOwnProperty.call(diagnosticsResponses, path)) {
      await fulfillJson(route, diagnosticsResponses[path]);
      return;
    }

    await fulfillJson(route, []);
  });
}

/** Log in through the real portal-login form (works against mocked or live auth). */
export async function loginRole(page: Page, role: string, adminCapable?: boolean): Promise<void> {
  const isAdmin = adminCapable ?? (role === "system_admin" || role === "super_admin");
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  if (isAdmin) {
    await page.getByTestId("button-card-portal-admin").click();
    await page.getByTestId("input-admin-username").fill(`playwright-${role}`);
    await page.getByTestId("input-admin-password").fill("playwright-password");
    await page.getByTestId("button-admin-login").click();
  } else {
    await page.getByTestId("button-card-portal-user").click();
    await page.getByTestId("input-login-username").fill(`playwright-${role}`);
    await page.getByTestId("input-login-password").fill("playwright-password");
    await page.getByTestId("button-login").click();
  }
  await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
}

/**
 * Navigate within the already-authenticated SPA via the History API so wouter
 * commits a client-side route — no full reload, which would wipe the in-memory
 * session token.
 */
export async function navigateWithinAuthenticatedSpa(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

/** Imperatively hide the dev perf overlay (some pages re-mount it post-nav). */
export async function hideDevPerfOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('[data-testid="button-show-perf-overlay"]').forEach((button) => {
      const container = button.parentElement;
      if (container instanceof HTMLElement) {
        container.style.display = "none";
        container.style.pointerEvents = "none";
      }
    });
  });
}
