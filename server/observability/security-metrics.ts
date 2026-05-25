import client from "prom-client";

// ===== API CONTRACT / RESPONSE-VALIDATION METRICS =====
/**
 * P2 #25 — Production response-contract drift counter. Incremented by
 * `validateResponse()` (server/lib/api-helpers.ts) every time a Zod
 * outbound-schema check fails in production. Tolerant policy: traffic
 * is NOT broken (the original payload is sent as-is), but the
 * violation is both logged and counted so dashboards/alerts can
 * detect silent drift between code and shipped contract.
 */
export const apiResponseValidationFailuresTotal = new client.Counter({
  name: "arus_api_response_validation_failures_total",
  help: "Outbound API responses that failed their Zod schema check (production tolerant mode)",
  labelNames: ["context"],
});

// ===== SECURITY & TENANT ISOLATION METRICS =====
export const tenantIsolationDeniedTotal = new client.Counter({
  name: "arus_tenant_isolation_denied_total",
  help: "Cross-tenant access attempts blocked",
  labelNames: ["org_requested", "user_org"],
});

export const authFailureTotal = new client.Counter({
  name: "arus_auth_failure_total",
  help: "Authentication failures by reason",
  labelNames: ["reason"],
});

export const crossOrgAccessBlockedTotal = new client.Counter({
  name: "arus_cross_org_access_blocked_total",
  help: "Cross-organization access attempts blocked",
});

export const suspiciousOrgIdRejectedTotal = new client.Counter({
  name: "arus_suspicious_orgid_rejected_total",
  help: "Suspicious org ID patterns rejected (SQL injection, invalid format)",
});

export const forbiddenOrgIdBlockedTotal = new client.Counter({
  name: "arus_forbidden_orgid_blocked_total",
  help: "Hard-coded forbidden org IDs blocked (default-org-id, test-org-id)",
});

// Helper functions
export function recordTenantIsolationDenied(orgRequested: string, userOrg: string) {
  tenantIsolationDeniedTotal.inc({ org_requested: orgRequested, user_org: userOrg });
  crossOrgAccessBlockedTotal.inc();
}

export function recordAuthFailure(
  reason:
    | "missing_org_id"
    | "invalid_token"
    | "expired_session"
    | "unauthenticated"
    | "invalid_org_id_format"
) {
  authFailureTotal.inc({ reason });
}

export function recordSuspiciousOrgId() {
  suspiciousOrgIdRejectedTotal.inc();
}

export function recordForbiddenOrgIdBlocked() {
  forbiddenOrgIdBlockedTotal.inc();
}

// ===== P2 #31 — USER-VISIBLE STUB OBSERVABILITY =====
/**
 * Counts every time a safe-degraded code path returns a stub/default
 * value that a user can observe in a core workflow (scheduling buffer,
 * compliance report, ERP import). The TODOs in the call sites remain;
 * this counter just makes their frequency visible to operators so the
 * "silently degraded" state stops being silent.
 *
 * Labels (kept low-cardinality):
 *   workflow   — pdm_schedule | crew_compliance_report | amos_import
 *   stub       — short identifier (e.g. telemetry_freshness_default,
 *                hours_of_rest_unwired, crew_rotation_unwired,
 *                maintenance_plan_unmapped)
 */
export const userVisibleStubInvokedTotal = new client.Counter({
  name: "arus_user_visible_stub_invoked_total",
  help: "Safe-degraded stub returned in a user-visible core workflow (P2 #31)",
  labelNames: ["workflow", "stub"],
});

export function recordUserVisibleStub(
  workflow: "pdm_schedule" | "crew_compliance_report" | "amos_import",
  stub: string
): void {
  userVisibleStubInvokedTotal.inc({ workflow, stub });
}
