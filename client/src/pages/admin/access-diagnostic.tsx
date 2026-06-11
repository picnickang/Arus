/**
 * Super-admin Access Diagnostic (Task #282).
 *
 * Read-only panel over `GET /api/permissions/dev-diagnostic`. It answers
 * "why does this user have the access they have?" by laying the live session
 * identity next to the canonical DB user row, the effective/primary/assigned
 * roles, hub access, the permission-grant summary, and any crew link — and it
 * highlights a session-vs-DB role mismatch loudly.
 *
 * The backend endpoint is itself super-admin gated and returns 404 in
 * production, so this page mirrors that: it never renders in production builds
 * and surfaces a clear forbidden/unavailable state instead of a blank screen.
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

interface SessionIdentity {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  orgId: string | null;
}

interface DbUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  isActive: boolean | null;
  loginEnabled: boolean | null;
  mustChangePassword: boolean | null;
  hubAdmin: boolean | null;
  hubAccess: string[] | null;
}

interface AssignedRole {
  id: string;
  name: string;
  displayName: string;
}

interface CrewLink {
  id: string;
  name: string | null;
  vesselId: string | null;
  roleId: string | null;
}

interface DiagnosticResponse {
  generatedAt: string;
  devBypassActive: boolean;
  session: SessionIdentity | null;
  dbUser: DbUser | null;
  mismatches: {
    userMissingInDb: boolean;
    roleSessionVsDb: boolean;
  };
  effectiveRole: string | null;
  primaryRole: string | null;
  assignedRoles: AssignedRole[];
  hubAdmin: boolean;
  hubAccess: string[] | null;
  permissionSummary: {
    resourcesWithAnyGrant: number;
    grantedActions: number;
  };
  crewLink: CrewLink | null;
}

const DIAGNOSTIC_PATH = "/api/permissions/dev-diagnostic";

async function fetchDiagnostic(): Promise<DiagnosticResponse> {
  // ApiError carries the same "{status}: {message}" text the manual parser
  // built, plus envelope unwrapping on the success path.
  return apiRequest<DiagnosticResponse>("GET", DIAGNOSTIC_PATH);
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleString();
}

function boolLabel(value: boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value ? "Yes" : "No";
}

function DefRow({
  label,
  value,
  testId,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  testId?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground shrink-0">{label}</dt>
      <dd
        className={`text-sm text-right break-all ${highlight ? "font-semibold text-rose-600" : "font-medium"}`}
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  );
}

export default function AccessDiagnosticPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<DiagnosticResponse>({
    queryKey: [DIAGNOSTIC_PATH],
    queryFn: fetchDiagnostic,
    enabled: !import.meta.env.PROD,
    retry: false,
    staleTime: 0,
  });

  // Mirror the backend: the endpoint is 404 in production. Never render the
  // panel there — show a clear "not available" state instead.
  if (import.meta.env.PROD) {
    return (
      <div className="p-4 lg:p-6" data-testid="page-access-diagnostic-prod">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto" />
            <h1 className="text-lg font-semibold">Not available in production</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The access diagnostic is a development and staging tool only. It is disabled in
              production builds.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const err = error;
  const isForbidden = !!err && (/^403/.test(err.message) || /super-admin/i.test(err.message));
  const isNotFound = !!err && /^404/.test(err.message);

  if (isForbidden || isNotFound) {
    return (
      <div className="p-4 lg:p-6" data-testid="page-access-diagnostic-forbidden">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto" />
            <h1 className="text-lg font-semibold">Super-admin only</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You need a super-admin role to view the access diagnostic.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleMismatch = data?.mismatches.roleSessionVsDb ?? false;
  const userMissing = data?.mismatches.userMissingInDb ?? false;
  const anyMismatch = roleMismatch || userMissing;

  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="page-access-diagnostic">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Access Diagnostic</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Why does this user have the access they have? Session vs. database identity, roles, hub
            access, and permission grants.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-diagnostic"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {err && !isForbidden && !isNotFound && (
        <div
          className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm"
          data-testid="diagnostic-error"
        >
          <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
          <span>Could not load the diagnostic: {err.message}</span>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Verdict banner — mismatch is the headline */}
          {anyMismatch ? (
            <div
              className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4"
              data-testid="diagnostic-mismatch-banner"
            >
              <ShieldAlert className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="font-semibold text-rose-700">Identity mismatch detected</div>
                <ul className="text-sm text-rose-700/90 list-disc pl-5 space-y-0.5">
                  {roleMismatch && (
                    <li data-testid="mismatch-role">
                      Session role <code>{data.session?.role ?? "—"}</code> does not match the
                      database role <code>{data.dbUser?.role ?? "—"}</code>. Server-side guards
                      authorize against the database role.
                    </li>
                  )}
                  {userMissing && (
                    <li data-testid="mismatch-missing">
                      The signed-in user has no matching row in the database for this organization.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4"
              data-testid="diagnostic-ok-banner"
            >
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="font-semibold text-emerald-700">
                Session and database identity are consistent.
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span data-testid="diagnostic-generated-at">
              Generated {formatTimestamp(data.generatedAt)}
            </span>
            {data.devBypassActive && (
              <Badge variant="secondary" data-testid="badge-dev-bypass">
                Dev bypass active
              </Badge>
            )}
          </div>

          {/* Effective access summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Effective access</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <DefRow
                  label="Effective role"
                  value={data.effectiveRole ?? "—"}
                  testId="text-effective-role"
                />
                <DefRow
                  label="Primary role (DB)"
                  value={data.primaryRole ?? "—"}
                  testId="text-primary-role"
                />
                <DefRow
                  label="Hub admin"
                  value={
                    <span className="inline-flex items-center gap-1">
                      {data.hubAdmin ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      {boolLabel(data.hubAdmin)}
                    </span>
                  }
                  testId="text-hub-admin"
                />
                <DefRow
                  label="Hub access"
                  value={
                    data.hubAccess === null
                      ? "All hubs"
                      : data.hubAccess.length === 0
                        ? "None"
                        : data.hubAccess.join(", ")
                  }
                  testId="text-hub-access"
                />
                <DefRow
                  label="Permission grants"
                  value={`${data.permissionSummary.grantedActions} actions across ${data.permissionSummary.resourcesWithAnyGrant} resources`}
                  testId="text-permission-summary"
                />
              </dl>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Session identity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Session identity</CardTitle>
              </CardHeader>
              <CardContent>
                {data.session ? (
                  <dl className="divide-y">
                    <DefRow label="User ID" value={data.session.id} testId="text-session-id" />
                    <DefRow label="Name" value={data.session.name ?? "—"} />
                    <DefRow label="Email" value={data.session.email ?? "—"} />
                    <DefRow
                      label="Role"
                      value={data.session.role ?? "—"}
                      highlight={roleMismatch}
                      testId="text-session-role"
                    />
                    <DefRow label="Org ID" value={data.session.orgId ?? "—"} />
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-session">
                    No active session (running as the dev-bypass identity).
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Database user */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Database user</CardTitle>
              </CardHeader>
              <CardContent>
                {data.dbUser ? (
                  <dl className="divide-y">
                    <DefRow label="User ID" value={data.dbUser.id} testId="text-db-id" />
                    <DefRow label="Name" value={data.dbUser.name ?? "—"} />
                    <DefRow label="Email" value={data.dbUser.email ?? "—"} />
                    <DefRow
                      label="Role"
                      value={data.dbUser.role ?? "—"}
                      highlight={roleMismatch}
                      testId="text-db-role"
                    />
                    <DefRow label="Active" value={boolLabel(data.dbUser.isActive)} />
                    <DefRow label="Login enabled" value={boolLabel(data.dbUser.loginEnabled)} />
                    <DefRow
                      label="Must change password"
                      value={boolLabel(data.dbUser.mustChangePassword)}
                    />
                  </dl>
                ) : (
                  <p className="text-sm text-rose-600" data-testid="text-no-db-user">
                    No matching database row for this user in this organization.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Assigned roles */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Assigned roles</CardTitle>
              </CardHeader>
              <CardContent>
                {data.assignedRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-assigned-roles">
                    No assignment-derived roles. Access comes from the primary role only.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2" data-testid="list-assigned-roles">
                    {data.assignedRoles.map((r) => (
                      <Badge key={r.id} variant="outline" data-testid={`badge-role-${r.id}`}>
                        {r.displayName}
                        <span className="ml-1 text-muted-foreground">({r.name})</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Crew link */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Crew link</CardTitle>
              </CardHeader>
              <CardContent>
                {data.crewLink ? (
                  <dl className="divide-y">
                    <DefRow label="Crew ID" value={data.crewLink.id} testId="text-crew-id" />
                    <DefRow label="Name" value={data.crewLink.name ?? "—"} />
                    <DefRow label="Vessel ID" value={data.crewLink.vesselId ?? "—"} />
                    <DefRow label="Crew role ID" value={data.crewLink.roleId ?? "—"} />
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-crew-link">
                    This login account is not linked to a crew member.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
