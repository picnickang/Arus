/**
 * Permissions Mapper — Unit Tests
 *
 * Tests the pure mapping from compileUserPermissions() output to the
 * client contract shape, plus response-schema validation of the result.
 */

import { describe, it, expect, jest } from "@jest/globals";
import {
  mapCompiledToContract,
  type CompiledPermissionsInput,
  type RoleMetadata,
} from "../../server/domains/permissions/mapper.js";
import { permissionsMeResponseSchema } from "../../server/domains/permissions/response-schemas.js";

const orgRoles: RoleMetadata[] = [
  { id: "role-admin", name: "admin", displayName: "Administrator" },
  { id: "role-tech", name: "technician", displayName: "Marine Technician" },
  { id: "role-viewer", name: "viewer", displayName: "Read-Only Viewer" },
];

function baseCompiled(overrides: Partial<CompiledPermissionsInput> = {}): CompiledPermissionsInput {
  return {
    userId: "user-1",
    orgId: "org-1",
    roles: ["role-admin"],
    grants: {
      vessels: {
        view: { allowed: true },
        edit: { allowed: false },
      },
      work_orders: {
        complete: { allowed: true, conditions: { assignedOnly: true } },
      },
    },
    ...overrides,
  };
}

describe("Permissions Mapper", () => {
  describe("mapCompiledToContract", () => {
    it("maps role IDs to role metadata objects", () => {
      const result = mapCompiledToContract(
        baseCompiled({ roles: ["role-admin", "role-tech"] }),
        orgRoles
      );
      expect(result.roles).toEqual([
        { id: "role-admin", name: "admin", displayName: "Administrator" },
        { id: "role-tech", name: "technician", displayName: "Marine Technician" },
      ]);
    });

    it("preserves role order from compiled input", () => {
      const result = mapCompiledToContract(
        baseCompiled({ roles: ["role-viewer", "role-admin"] }),
        orgRoles
      );
      expect(result.roles.map((r) => r.id)).toEqual(["role-viewer", "role-admin"]);
    });

    it("flattens grants matrix to boolean permissions matrix", () => {
      const result = mapCompiledToContract(baseCompiled(), orgRoles);
      expect(result.permissions).toEqual({
        vessels: { view: true, edit: false },
        work_orders: { complete: true },
      });
    });

    it("treats grant.allowed !== true as false (e.g. undefined, null, missing)", () => {
      const result = mapCompiledToContract(
        baseCompiled({
          grants: {
            equipment: {
              view: { allowed: true },
              edit: undefined,
              delete: { allowed: false },
              export: {} as { allowed: boolean },
            },
          },
        }),
        orgRoles
      );
      expect(result.permissions["equipment"]).toEqual({
        view: true,
        edit: false,
        delete: false,
        export: false,
      });
    });

    it("drops unknown role IDs and logs them via the supplied logger", () => {
      const warn = jest.fn();
      const result = mapCompiledToContract(
        baseCompiled({ roles: ["role-admin", "role-ghost", "role-missing"] }),
        orgRoles,
        { warn }
      );
      expect(result.roles.map((r) => r.id)).toEqual(["role-admin"]);
      expect(warn).toHaveBeenCalledTimes(1);
      const [message, context] = warn.mock.calls[0] as [string, Record<string, unknown>];
      expect(message).toMatch(/possible data drift/i);
      expect(context["metadata"].missingRoleIds).toEqual(["role-ghost", "role-missing"]);
      expect(context["metadata"].userId).toBe("user-1");
      expect(context["metadata"].orgId).toBe("org-1");
    });

    it("does NOT log when all role IDs resolve", () => {
      const warn = jest.fn();
      mapCompiledToContract(baseCompiled({ roles: ["role-admin"] }), orgRoles, { warn });
      expect(warn).not.toHaveBeenCalled();
    });

    it("does not throw when no logger is supplied and IDs are missing", () => {
      expect(() =>
        mapCompiledToContract(baseCompiled({ roles: ["role-ghost"] }), orgRoles)
      ).not.toThrow();
    });

    it("preserves userId and orgId from compiled input", () => {
      const result = mapCompiledToContract(
        baseCompiled({ userId: "u-42", orgId: "o-99" }),
        orgRoles
      );
      expect(result.userId).toBe("u-42");
      expect(result.orgId).toBe("o-99");
    });

    it("handles an empty grants matrix", () => {
      const result = mapCompiledToContract(baseCompiled({ grants: {} }), orgRoles);
      expect(result.permissions).toEqual({});
    });

    it("handles an empty roles list", () => {
      const result = mapCompiledToContract(baseCompiled({ roles: [] }), orgRoles);
      expect(result.roles).toEqual([]);
    });
  });

  describe("contract validation", () => {
    it("mapped output passes permissionsMeResponseSchema (with isDevMode added)", () => {
      const mapped = mapCompiledToContract(
        baseCompiled({ roles: ["role-admin", "role-tech"] }),
        orgRoles
      );
      const parsed = permissionsMeResponseSchema.safeParse({
        ...mapped,
        isDevMode: false,
        hubAdmin: false,
        hubAccess: null,
      });
      expect(parsed.success).toBe(true);
    });

    it("schema rejects payload that wasn't mapped (raw compiled shape)", () => {
      const raw = baseCompiled();
      const parsed = permissionsMeResponseSchema.safeParse({ ...raw, isDevMode: false });
      expect(parsed.success).toBe(false);
    });
  });
});
