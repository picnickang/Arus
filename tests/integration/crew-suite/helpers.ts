/**
 * Shared helpers for the crew-management / RBAC integration suite.
 *
 * Two-track strategy:
 *   - Positive CRUD + workflow tests run against the LIVE dev server
 *     (NODE_ENV=development → every request is the fixed dev admin, so
 *     these exercise real persistence with full permissions). They reuse
 *     the forms-suite HTTP client + pg pool + RUN_ID cleanup convention.
 *   - Negative permission/role tests run IN-PROCESS (see rbac-harness.ts)
 *     where NODE_ENV=test makes the route gates enforce.
 *
 * Every row a test creates carries the suite RUN_ID in a string column so
 * cleanupCrewSuite() can cascade-delete via direct SQL without touching
 * unrelated tenant data.
 */
import {
  api,
  pool,
  makeRunId,
  retry,
  cleanupByRunId,
  BASE_URL,
  TEST_ORG_ID,
  type ApiResult,
} from "../forms/_helpers";

export { api, pool, makeRunId, retry, cleanupByRunId, BASE_URL, TEST_ORG_ID };
export type { ApiResult };

/** Children-first so best-effort, FK-respecting deletes succeed. */
export const CREW_SUITE_TABLES = [
  "vessel_safety_alarms",
  "safety_alarm_types",
  "role_dashboard_configs",
  "crew_employment_history",
  "crew",
  "users",
];

export async function cleanupCrewSuite(runId: string): Promise<void> {
  await cleanupByRunId(runId, CREW_SUITE_TABLES);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 50);
}

export interface CrewRecord {
  id: string;
  name: string;
  userId: string | null;
  active: boolean;
  onDuty: boolean;
  rank?: string | null;
  vesselId?: string | null;
  terminationType: string | null;
  terminationDate?: string | null;
  reinstatedAt?: string | null;
  [k: string]: unknown;
}

/** Create an active crew member tagged with runId in its name. */
export async function createCrew(
  runId: string,
  overrides: Record<string, unknown> = {},
): Promise<CrewRecord> {
  const res = await api<CrewRecord>("POST", "/api/crew", {
    name: `Crew ${runId} ${Math.random().toString(36).slice(2, 6)}`,
    rank: "engineer",
    ...overrides,
  });
  if (!res.ok) {
    throw new Error(`createCrew failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export interface CrewAccount {
  id: string;
  role?: string;
  loginEnabled?: boolean;
  [k: string]: unknown;
}

/**
 * Create a crew member AND a linked login account. The account username /
 * email carry runId so the users row is cleaned up too.
 */
export async function createCrewWithAccount(
  runId: string,
  opts: { role?: string; loginEnabled?: boolean; vesselId?: string | null } = {},
): Promise<{ crew: CrewRecord; account: CrewAccount }> {
  const crew = await createCrew(runId);
  const username = slug(`u_${runId}_${Math.random().toString(36).slice(2, 6)}`);
  const res = await api<{ account: CrewAccount }>(
    "POST",
    `/api/admin/crew/members/${crew.id}/account`,
    {
      username,
      password: "Test1234!secret",
      role: opts.role ?? "crew_member",
      name: crew.name,
      email: `${username}@example.com`,
      loginEnabled: opts.loginEnabled ?? true,
      vesselId: opts.vesselId ?? null,
      skipVesselAssignment: opts.vesselId == null,
    },
  );
  if (!res.ok) {
    throw new Error(
      `createCrewWithAccount: account failed (${res.status}): ${JSON.stringify(res.data)}`,
    );
  }
  const refreshed = await api<CrewRecord>("GET", `/api/crew/${crew.id}`);
  return { crew: refreshed.ok ? refreshed.data : crew, account: res.data.account };
}

export const listCrew = (vesselId?: string): Promise<ApiResult<CrewRecord[]>> =>
  api<CrewRecord[]>("GET", `/api/crew${vesselId ? `?vesselId=${vesselId}` : ""}`);
export const getCrew = (id: string): Promise<ApiResult<CrewRecord>> =>
  api<CrewRecord>("GET", `/api/crew/${id}`);
export const updateCrew = (id: string, body: Record<string, unknown>): Promise<ApiResult<CrewRecord>> =>
  api<CrewRecord>("PUT", `/api/crew/${id}`, body);
export const deleteCrew = (id: string): Promise<ApiResult> => api("DELETE", `/api/crew/${id}`);
export const toggleDuty = (id: string): Promise<ApiResult<{ success: boolean; crew: CrewRecord }>> =>
  api<{ success: boolean; crew: CrewRecord }>("POST", `/api/crew/${id}/toggle-duty`, {});

export const retireCrew = (id: string, body: Record<string, unknown> = {}): Promise<ApiResult<CrewRecord>> =>
  api<CrewRecord>("POST", `/api/crew/${id}/retire`, body);
export const cancelCrew = (id: string, body: Record<string, unknown> = {}): Promise<ApiResult<CrewRecord>> =>
  api<CrewRecord>("POST", `/api/crew/${id}/cancel`, body);
export const reinstateCrew = (id: string, body: Record<string, unknown> = {}): Promise<ApiResult<CrewRecord>> =>
  api<CrewRecord>("POST", `/api/crew/${id}/reinstate`, body);
export const listFormerCrew = (): Promise<ApiResult<CrewRecord[]>> =>
  api<CrewRecord[]>("GET", "/api/crew/former");

export interface FormerAccessRisk {
  crewId: string;
  crewName: string;
  userId: string | null;
  hasLinkedLogin: boolean;
  accountActive: boolean;
  loginEnabled: boolean;
  vesselAccessCount: number;
  hasFleetAccess: boolean;
  hubAdmin: boolean;
  hubAccess: unknown;
  role: string | null;
  additionalRoles: string[];
  hasHighRiskRole: boolean;
  hasAccessRisk: boolean;
  reasons: string[];
}
export const listFormerAccessRisks = (): Promise<ApiResult<FormerAccessRisk[]>> =>
  api<FormerAccessRisk[]>("GET", "/api/admin/crew/former-access-risks");

export interface AccessReadiness {
  crewId: string;
  crewName: string;
  userId: string | null;
  status: string;
  reasons: string[];
  loginEnabled: boolean;
  mustChangePassword?: boolean;
  hasPassword?: boolean;
  vesselScope?: string;
  [k: string]: unknown;
}
export const listAccessReadiness = (): Promise<ApiResult<AccessReadiness[]>> =>
  api<AccessReadiness[]>("GET", "/api/admin/crew/access-readiness");

export const setLoginEnabled = (userId: string, enabled: boolean): Promise<ApiResult> =>
  api("PATCH", `/api/admin/crew/users/${userId}/login-enabled`, { enabled });
export const setHubAccess = (
  userId: string,
  hubAdmin: boolean,
  hubAccess: string[] | null = null,
): Promise<ApiResult> =>
  api("PATCH", `/api/admin/crew/users/${userId}/hub-access`, { hubAdmin, hubAccess });

/* ----------------------------- Safety alarms ----------------------------- */

export interface AlarmType {
  id: string;
  key: string;
  displayName: string;
  defaultSeverity: string;
  requiresAcknowledgement: boolean;
  isProtected: boolean;
  isActive: boolean;
  [k: string]: unknown;
}
export const createAlarmType = (
  runId: string,
  overrides: Record<string, unknown> = {},
): Promise<ApiResult<AlarmType>> =>
  api<AlarmType>("POST", "/api/admin/safety-alarm-types", {
    key: slug(`atype_${runId}_${Math.random().toString(36).slice(2, 6)}`),
    displayName: `Alarm Type ${runId}`,
    defaultSeverity: "warning",
    ...overrides,
  });
export const listAlarmTypes = (includeInactive = false): Promise<ApiResult<AlarmType[]>> =>
  api<AlarmType[]>(
    "GET",
    `/api/admin/safety-alarm-types${includeInactive ? "?includeInactive=true" : ""}`,
  );
export const updateAlarmType = (id: string, body: Record<string, unknown>): Promise<ApiResult<AlarmType>> =>
  api<AlarmType>("PATCH", `/api/admin/safety-alarm-types/${id}`, body);
export const deleteAlarmType = (id: string): Promise<ApiResult> =>
  api("DELETE", `/api/admin/safety-alarm-types/${id}`);

export interface Alarm {
  id: string;
  severity: string;
  mode: string;
  status?: string;
  title?: string;
  message?: string | null;
  resolutionNote?: string | null;
  vesselId?: string | null;
  [k: string]: unknown;
}
export const triggerAlarm = (body: Record<string, unknown>): Promise<ApiResult<Alarm>> =>
  api<Alarm>("POST", "/api/admin/safety-alarms", body);
export const clearAlarm = (id: string, body: Record<string, unknown> = {}): Promise<ApiResult<Alarm>> =>
  api<Alarm>("POST", `/api/admin/safety-alarms/${id}/clear`, body);
export const listAlarms = (includeCleared = false): Promise<ApiResult<Alarm[]>> =>
  api<Alarm[]>(
    "GET",
    `/api/admin/safety-alarms${includeCleared ? "?includeCleared=true" : ""}`,
  );

/* -------------------------------- Roles --------------------------------- */

export interface RoleRecord {
  id: string;
  name: string;
  displayName: string;
  [k: string]: unknown;
}

/** Create a custom role (name slugified + tagged with runId). */
export async function createRole(
  runId: string,
  overrides: Record<string, unknown> = {},
): Promise<RoleRecord> {
  const name = slug(`role_${runId}_${Math.random().toString(36).slice(2, 5)}`);
  const res = await api<RoleRecord>("POST", "/api/admin/crew/roles", {
    name,
    displayName: `Role ${runId}`,
    ...overrides,
  });
  if (!res.ok) {
    throw new Error(`createRole failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

/**
 * Hard-delete a role and its dashboard config by id. The dashboard config
 * row is keyed by the role's uuid (not the runId), so RUN_ID cleanup can't
 * reach it — callers that create roles must call this in afterAll.
 */
export async function deleteRoleHard(roleId: string): Promise<void> {
  await pool.query("DELETE FROM role_dashboard_configs WHERE role_id = $1", [roleId]);
  await pool.query("DELETE FROM user_role_assignments WHERE role_id = $1", [roleId]);
  await pool.query("DELETE FROM roles WHERE id = $1", [roleId]);
}

/* ---------------------------- Role dashboards ---------------------------- */

export const listRoleDashboards = (): Promise<ApiResult<unknown[]>> =>
  api<unknown[]>("GET", "/api/admin/role-dashboards");
export const getRoleDashboard = (roleId: string): Promise<ApiResult> =>
  api("GET", `/api/admin/role-dashboards/${roleId}`);
export const saveRoleDashboard = (roleId: string, body: Record<string, unknown>): Promise<ApiResult> =>
  api("PUT", `/api/admin/role-dashboards/${roleId}`, body);
export const resetRoleDashboard = (roleId: string): Promise<ApiResult> =>
  api("POST", `/api/admin/role-dashboards/${roleId}/reset`, {});
