/**
 * Permission audit read — getPermissionAuditLog maps the immutable trail.
 *
 * The unified Roles & Dashboards surface fetches `GET /api/permissions/audit`,
 * which delegates to `permissionRepository.getPermissionAuditLog`. That used to
 * return `[]` unconditionally, so permission/hub-access changes were logged but
 * never viewable. This test pins the new behaviour: the repository reads the
 * tamper-evident immutable audit trail (eventType "permission_changed") and
 * maps each record into a displayable audit entry (action / target / before /
 * after / timestamp).
 *
 * Runs without Postgres: the immutable audit service's `queryEvents` is mocked
 * to return fixtures, and `server/db` is stubbed (the read path never touches
 * the db directly — it goes through the audit service). Mocked via
 * `jest.unstable_mockModule` + dynamic import because the integration suite
 * runs under `--experimental-vm-modules` (ESM).
 */

import { jest, describe, it, expect, beforeAll } from "@jest/globals";

const ORG = "test-org-audit-read";

type QueryOptions = { orgId: string; eventType?: string; limit?: number };
let lastQuery: QueryOptions | undefined;

// Two fixtures mirroring the two real write paths: a role grant change and a
// hub-access change. Shaped like the immutable-trail AuditRecord rows the real
// queryEvents returns (parsed JSON states).
const fixtures = [
  {
    id: "audit-2",
    orgId: ORG,
    eventCategory: "security_event",
    eventType: "permission_changed",
    entityType: "role",
    entityId: "role-fm",
    previousState: { hubAdmin: true, hubAccess: ["operations"] },
    newState: { hubAdmin: true, hubAccess: ["operations", "fleet"] },
    performedBy: "admin-1",
    ipAddress: "10.0.0.1",
    eventTimestamp: new Date("2026-06-01T12:00:00.000Z"),
  },
  {
    id: "audit-1",
    orgId: ORG,
    eventCategory: "security_event",
    eventType: "permission_changed",
    entityType: "role",
    entityId: "role-fm",
    previousState: { roleName: "fleet_manager", grants: [] },
    newState: {
      roleName: "fleet_manager",
      grants: [{ resourceCode: "vessels", actionCode: "view" }],
    },
    performedBy: "admin-1",
    ipAddress: null,
    eventTimestamp: new Date("2026-05-30T09:00:00.000Z"),
  },
];

type GetPermissionAuditLog = (
  orgId: string,
  limit?: number
) => Promise<
  Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string | null;
    previousValue: string | null;
    newValue: string | null;
    ipAddress: string | null;
    createdAt: Date | null;
  }>
>;

let getPermissionAuditLog: GetPermissionAuditLog;

beforeAll(async () => {
  jest.unstable_mockModule("../../server/compliance/immutable-audit.service", () => ({
    auditService: {
      queryEvents: async (options: QueryOptions) => {
        lastQuery = options;
        return fixtures;
      },
    },
  }));

  // The read path goes through the audit service, not the db — stub the full
  // server/db re-export surface so module linking succeeds in the ESM sandbox.
  jest.unstable_mockModule("../../server/db", () => ({
    db: {},
    pool: {},
    isLocalMode: false,
    deploymentMode: "cloud",
    libsqlClient: undefined,
  }));

  const repo = await import("../../server/domains/permissions/repository");
  getPermissionAuditLog = repo.getPermissionAuditLog as GetPermissionAuditLog;
});

describe("getPermissionAuditLog — reads the immutable trail", () => {
  it("queries the trail for permission_changed events scoped to the org", async () => {
    await getPermissionAuditLog(ORG, 50);
    expect(lastQuery).toMatchObject({
      orgId: ORG,
      eventType: "permission_changed",
      limit: 50,
    });
  });

  it("maps each trail record into a displayable audit entry", async () => {
    const entries = await getPermissionAuditLog(ORG, 100);
    expect(entries).toHaveLength(2);

    const hubChange = entries[0]!;
    expect(hubChange.id).toBe("audit-2");
    expect(hubChange.action).toBe("permission_changed");
    expect(hubChange.targetType).toBe("role");
    expect(hubChange.targetId).toBe("role-fm");
    expect(hubChange.ipAddress).toBe("10.0.0.1");
    expect(hubChange.createdAt).toEqual(new Date("2026-06-01T12:00:00.000Z"));
    // before/after are serialised so the UI can show what changed.
    expect(JSON.parse(hubChange.previousValue!)).toEqual({
      hubAdmin: true,
      hubAccess: ["operations"],
    });
    expect(JSON.parse(hubChange.newValue!)).toEqual({
      hubAdmin: true,
      hubAccess: ["operations", "fleet"],
    });
  });

  it("tolerates a null previous/ip on a grant-change record", async () => {
    const entries = await getPermissionAuditLog(ORG, 100);
    const grantChange = entries[1]!;
    expect(grantChange.ipAddress).toBeNull();
    expect(JSON.parse(grantChange.newValue!).grants).toHaveLength(1);
  });
});
