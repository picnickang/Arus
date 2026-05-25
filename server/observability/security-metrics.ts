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
