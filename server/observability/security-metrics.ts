import client from "prom-client";

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

export function recordAuthFailure(reason: "missing_org_id" | "invalid_token" | "expired_session" | "unauthenticated" | "invalid_org_id_format") {
  authFailureTotal.inc({ reason });
}

export function recordSuspiciousOrgId() {
  suspiciousOrgIdRejectedTotal.inc();
}

export function recordForbiddenOrgIdBlocked() {
  forbiddenOrgIdBlockedTotal.inc();
}
