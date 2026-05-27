/**
 * LR-3.5 / V3 — Public-API allowlist audit.
 *
 * Pins:
 * - The bootstrap auth + setup endpoints remain reachable without a
 *   session (positive control).
 * - NO sensitive prefix is silently treated as public. If someone
 *   adds `/admin` (bare) or `/api/v1/ml`/`/api/rag`/`/api/work-orders`/
 *   `/api/maintenance-schedules`/`/api/inventory`/`/api/crew`/
 *   `/api/audit*` to the allowlist, this test fires.
 * - The `/api`-prefix stripping done by `toApiPath` does not collapse
 *   a sensitive prefix onto an allowlisted one (eg. `/api/admin/foo`
 *   must NOT be treated as public just because `/admin/auth/setup`
 *   is).
 */

import { describe, it, expect } from "@jest/globals";
import { isPublicApiPath, toApiPath } from "../../server/bootstrap/public-api-paths";

describe("LR-3.5 V3 — public-api allowlist positive controls", () => {
  it.each([
    "/api/admin/auth/verify",
    "/api/admin/auth/status",
    "/api/admin/auth/setup",
    "/api/setup/status",
    "/api/setup/complete",
    "/api/health",
    "/api/healthz",
    "/api/readyz",
    "/api/metrics",
    "/api/observability/web-vitals",
    "/api/observability/web-vitals/lcp",
  ])("is public: %s", (path) => {
    expect(isPublicApiPath(path)).toBe(true);
  });

  it("query string is stripped before allowlist matching", () => {
    expect(isPublicApiPath("/api/healthz?probe=1")).toBe(true);
    expect(isPublicApiPath("/api/admin/auth/status?from=ui")).toBe(true);
  });
});

describe("LR-3.5 V3 — public-api allowlist negative pins", () => {
  // Representative sensitive routes — if any of these resolves as
  // public, the request will hit the router with no session, no
  // orgId, and no RBAC. That is a tenant-isolation / privilege-
  // escalation regression. Each one MUST stay locked to false.
  it.each([
    // /admin/* must NOT be globally public — only the three exact
    // bootstrap auth paths are.
    "/api/admin/users",
    "/api/admin/sessions",
    "/api/admin/2fa/setup",
    "/api/admin/audit-log",
    "/api/admin/feature-flags",
    "/api/admin/tenants",
    "/api/admin/billing",

    // ML promotion / rollback (covered by SEC cluster — these MUST
    // require admin / chief_engineer, never run unauthenticated).
    "/api/v1/ml/models/m1/promote",
    "/api/v1/ml/models/m1/rollback",
    "/api/v1/ml/models/m1/promote/request",
    "/api/v1/ml/training/runs/r1/promote",
    "/api/pdm/training/runs/r1/promote",
    "/api/pdm/models/deployments/1/rollback",

    // RAG / knowledge base — leaks cross-tenant content if unauth.
    "/api/rag/answer",
    "/api/rag/security/config",
    "/api/rag/security/audit",
    "/api/kb/documents",
    "/api/kb/upload",

    // Domain mutation surfaces — orgId gate must run.
    "/api/work-orders",
    "/api/work-orders/wo-1/complete",
    "/api/maintenance-schedules",
    "/api/maintenance-schedules/upcoming",
    "/api/maintenance-templates",
    "/api/inventory",
    "/api/inventory/items",
    "/api/crew",
    "/api/crew/members",
    "/api/audit",
    "/api/audit/log",
    "/api/audit-events",

    // Tenant management / billing.
    "/api/orgs/o1/members",
    "/api/tenants/t1/settings",

    // Telemetry write paths.
    "/api/telemetry/readings",
    "/api/telemetry/bulk",
  ])("is NOT public: %s", (path) => {
    expect(isPublicApiPath(path)).toBe(false);
  });

  it("does not collapse /api/admin/<anything> onto bootstrap allowlist", () => {
    // toApiPath strips the /api prefix; we verify the stripped path
    // is what we expect AND that it is correctly classified.
    expect(toApiPath("/api/admin/auth/setup")).toBe("/admin/auth/setup");
    expect(toApiPath("/api/admin/auth/extra")).toBe("/admin/auth/extra");
    expect(isPublicApiPath("/api/admin/auth/setup")).toBe(true);
    expect(isPublicApiPath("/api/admin/auth/extra")).toBe(false);
  });

  it("does not treat /api/setup/<other> as public beyond the two listed exact paths", () => {
    expect(isPublicApiPath("/api/setup/status")).toBe(true);
    expect(isPublicApiPath("/api/setup/complete")).toBe(true);
    expect(isPublicApiPath("/api/setup/escalate")).toBe(false);
    expect(isPublicApiPath("/api/setup/admin/new")).toBe(false);
  });
});
