import {
  DEFAULT_ROLE_TEMPLATES,
  getTemplateByName,
  getTemplatesByDepartment,
} from "../../server/config/default-role-templates";
import {
  ACTIONS,
  RESOURCES,
  RESOURCE_CATEGORIES,
  getActionsForResource,
  getAllActions,
  getResourceByCode,
} from "../../server/config/permission-registry";

describe("permission and role template config barrels", () => {
  it("preserves array-shaped permission registry exports", () => {
    expect(Array.isArray(RESOURCES)).toBe(true);
    expect(Array.isArray(RESOURCE_CATEGORIES)).toBe(true);
    expect(Object.keys(ACTIONS)).toEqual(
      expect.arrayContaining(["view", "create", "edit", "delete"])
    );
    expect(getAllActions().map((action) => action.code)).toEqual(
      expect.arrayContaining(["view", "create", "edit", "delete"])
    );
  });

  it("keeps resource helper lookups wired to the moved registry data", () => {
    const dashboard = getResourceByCode("dashboard");
    expect(dashboard?.actions).toEqual(["view"]);
    expect(getActionsForResource("dashboard").map((action) => action.code)).toEqual(["view"]);
    expect(getActionsForResource("missing-resource")).toEqual([]);
  });

  it("preserves default role template helpers and ordering", () => {
    expect(DEFAULT_ROLE_TEMPLATES.slice(0, 5).map((template) => template.name)).toEqual([
      "company_admin",
      "super_admin",
      "admin",
      "fleet_manager",
      "captain",
    ]);
    expect(getTemplateByName("captain")?.displayName).toBe("Captain / Master");
    expect(getTemplatesByDepartment("engine").map((template) => template.name)).toEqual(
      expect.arrayContaining(["chief_engineer", "second_engineer", "third_engineer"])
    );
  });
});
