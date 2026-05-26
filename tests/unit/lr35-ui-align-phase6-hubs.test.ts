/**
 * UI Align Phase 6 — Module Overview Hubs (task #190).
 *
 * Same source-scan harness as the other LR-3.5 client-side tests
 * (Jest `testEnvironment: "node"` with swc/ESM — no React mount).
 * The hubs are thin overview wrappers; we pin:
 *   - each hub binds to the documented existing endpoint(s);
 *   - the hub renders the panel-spec field set
 *     (headline counters, list, jump grid, CTA);
 *   - deep-link routes are still reachable (the hub LINKs to the
 *     canonical paths — it does not own RBAC, that lives in
 *     `role-navigation-policy.ts`);
 *   - the page does NOT pretend a backend or invent data
 *     (no `apiRequest(`, no `fetch(`, no `setInterval(` driving
 *     a fake progress bar).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..");
const PAGES = {
  maintenance: resolve(REPO_ROOT, "client/src/pages/maintenance-hub.tsx"),
  crew: resolve(REPO_ROOT, "client/src/pages/crew-hub.tsx"),
  logistics: resolve(REPO_ROOT, "client/src/pages/logistics-hub.tsx"),
  system: resolve(REPO_ROOT, "client/src/pages/system-hub.tsx"),
  analytics: resolve(REPO_ROOT, "client/src/pages/analytics-hub.tsx"),
  rolePolicy: resolve(
    REPO_ROOT,
    "client/src/application/navigation/role-navigation-policy.ts",
  ),
} as const;

async function loadPage(key: keyof typeof PAGES): Promise<string> {
  return readFile(PAGES[key], "utf8");
}

describe("UI Align Phase 6 — Maintenance hub (panel 5)", () => {
  it("binds to the work-order summary + list endpoints", async () => {
    const src = await loadPage("maintenance");
    expect(src).toContain('"/api/work-orders/summary"');
    expect(src).toContain('"/api/work-orders"');
  });

  it("renders the status chips + new-work-order CTA + recent list", async () => {
    const src = await loadPage("maintenance");
    expect(src).toContain('"status-chip-open"');
    expect(src).toContain('"status-chip-in-progress"');
    expect(src).toContain('"status-chip-planned"');
    expect(src).toContain('"status-chip-completed"');
    expect(src).toContain('"status-chip-overdue"');
    expect(src).toContain('"button-new-work-order"');
    expect(src).toContain('data-testid="list-recent-work-orders"');
  });

  it("links to existing deep-link routes (no in-hub RBAC)", async () => {
    const src = await loadPage("maintenance");
    expect(src).toContain('href="/work-orders"');
    expect(src).toContain('href="/maintenance"');
    expect(src).toContain('href="/maintenance-templates"');
    expect(src).toContain('href="/equipment-intelligence"');
    expect(src).not.toMatch(/PermissionGate|RoleGate|requireRole/);
  });
});

describe("UI Align Phase 6 — Crew hub (panel 6)", () => {
  it("binds to the crew + expiring-certifications endpoints", async () => {
    const src = await loadPage("crew");
    expect(src).toContain('"/api/crew"');
    expect(src).toContain('"/api/crew-certifications/expiring"');
  });

  it("renders the four counters + two lists", async () => {
    const src = await loadPage("crew");
    expect(src).toContain('"counter-total-crew"');
    expect(src).toContain('"counter-onboard"');
    expect(src).toContain('"counter-on-leave"');
    expect(src).toContain('"counter-certs-due"');
    expect(src).toContain('data-testid="list-expiring-certifications"');
    expect(src).toContain('data-testid="list-crew-on-leave"');
  });

  it("links to existing deep-link routes (no in-hub RBAC)", async () => {
    const src = await loadPage("crew");
    expect(src).toContain('href="/crew-management"');
    expect(src).toContain('href="/schedule-planner"');
    expect(src).toContain('href="/hours-of-rest"');
    expect(src).not.toMatch(/PermissionGate|RoleGate|requireRole/);
  });
});

describe("UI Align Phase 6 — Logistics hub (panel 4 / row 10)", () => {
  it("binds to the low-stock suggestions endpoint", async () => {
    const src = await loadPage("logistics");
    expect(src).toContain('"/api/parts-inventory/low-stock-suggestions"');
  });

  it("renders blocker counter + low-stock list + vendors/service jump cards", async () => {
    const src = await loadPage("logistics");
    expect(src).toContain('data-testid="counter-blockers"');
    expect(src).toContain('data-testid="counter-reorder-cost"');
    expect(src).toContain('data-testid="list-low-stock"');
    expect(src).toContain('"jump-inventory"');
    expect(src).toContain('"jump-service-orders"');
    expect(src).toContain('"jump-vendors"');
  });

  it("links to existing deep-link routes (no in-hub RBAC)", async () => {
    const src = await loadPage("logistics");
    expect(src).toContain('href="/inventory-management"');
    expect(src).toContain('href="/service-orders"');
    expect(src).toContain('href="/vendors"');
    expect(src).not.toMatch(/PermissionGate|RoleGate|requireRole/);
  });
});

describe("UI Align Phase 6 — System hub (panel 8)", () => {
  it("binds to the diagnostics health + admin audit endpoints", async () => {
    const src = await loadPage("system");
    expect(src).toContain('"/api/diagnostics/health"');
    expect(src).toContain('"/api/admin/audit"');
  });

  it("renders service-health grid + audit log list + system metrics", async () => {
    const src = await loadPage("system");
    expect(src).toContain('data-testid="service-health-grid"');
    expect(src).toContain('data-testid="list-audit-logs"');
    expect(src).toContain('data-testid="system-metrics"');
  });

  it("links to existing deep-link routes (no in-hub RBAC)", async () => {
    const src = await loadPage("system");
    expect(src).toContain('href="/system-administration"');
    expect(src).toContain('href="/configuration"');
    expect(src).toContain('href="/admin/3d-models"');
    expect(src).not.toMatch(/PermissionGate|RoleGate|requireRole/);
  });
});

describe("UI Align Phase 6 — AI Intelligence (panel 7) on analytics hub", () => {
  it("adds a Predictive Insights card bound to the failure-predictions endpoint", async () => {
    const src = await loadPage("analytics");
    expect(src).toContain('"/api/analytics/failure-predictions"');
    expect(src).toContain('data-testid="predictive-insights"');
    expect(src).toContain('data-testid="button-predictive-create-wo"');
  });
});

describe("UI Align Phase 6 — integrity checks", () => {
  it("no hub invents data via setInterval / fake polling", async () => {
    for (const key of ["maintenance", "crew", "logistics", "system"] as const) {
      const src = await loadPage(key);
      expect(src).not.toMatch(/setInterval\(/);
    }
  });

  it("only system-hub uses raw fetch (deliberate — health endpoint returns HTTP 503 on degraded and we need the body)", async () => {
    for (const key of ["maintenance", "crew", "logistics"] as const) {
      const src = await loadPage(key);
      expect(src).not.toMatch(/\bfetch\(/);
    }
    const sys = await loadPage("system");
    expect(sys).toContain("healthQueryFn");
    expect(sys).toMatch(/fetch\(["']\/api\/diagnostics\/health/);
  });

  it("role-navigation-policy.ts remains the sole source of role→portal mapping", async () => {
    const src = await loadPage("rolePolicy");
    expect(src).toContain("getPortalForRole");
    expect(src).toContain("getPrimaryCategoriesForRole");
  });
});
