import { beforeAll, describe, expect, it, jest } from "@jest/globals";

const listDistinctRoleOrgIdsMock = jest.fn(async () => ["default-org-id"]);
const provisionTemplatesForOrgMock = jest.fn(async () => []);

let seedAccessForAllOrgs: (typeof import("../../server/composition/access-seeding"))["seedAccessForAllOrgs"];

beforeAll(async () => {
  jest.unstable_mockModule("../../server/db", () => ({
    __esModule: true,
    isLocalMode: true,
  }));
  jest.unstable_mockModule("../../server/domains/permissions/repository", () => ({
    __esModule: true,
    listDistinctRoleOrgIds: listDistinctRoleOrgIdsMock,
    listOrgRolesForSeeding: jest.fn(async () => []),
    listUnlinkedCrewForSeeding: jest.fn(async () => []),
    provisionTemplatesForOrg: provisionTemplatesForOrgMock,
    setCrewRoleId: jest.fn(async () => undefined),
    setRoleHubDefaults: jest.fn(async () => undefined),
  }));

  ({ seedAccessForAllOrgs } = await import("../../server/composition/access-seeding"));
});

describe("access seeding in local SQLite mode", () => {
  it("skips cloud-only role seeding instead of touching undefined runtime role tables", async () => {
    await seedAccessForAllOrgs();

    expect(listDistinctRoleOrgIdsMock).not.toHaveBeenCalled();
    expect(provisionTemplatesForOrgMock).not.toHaveBeenCalled();
  });
});
