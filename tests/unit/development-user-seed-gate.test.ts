import { describe, expect, it } from "@jest/globals";
import type { InStatement, ResultSet } from "@libsql/client";
import {
  DEFAULT_DEVELOPMENT_ADMIN_ROLE,
  isDevelopmentUserSeedEnabled,
  linkDevelopmentUserToLocalCrewRoster,
} from "../../server/bootstrap/services";
import { isSuperAdminRole } from "../../shared/role-dashboard";

describe("development user seed gate", () => {
  const emptyResultSet: ResultSet = {
    columns: [],
    columnTypes: [],
    rows: [],
    rowsAffected: 0,
    lastInsertRowid: undefined,
    toJSON: () => ({
      columns: [],
      columnTypes: [],
      rows: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    }),
  };

  it("allows the seed in normal development mode", () => {
    expect(isDevelopmentUserSeedEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("allows the seed for local preview auth even when NODE_ENV is test", () => {
    expect(isDevelopmentUserSeedEnabled({ NODE_ENV: "test", ARUS_DEV_LOGIN: "1" })).toBe(true);
  });

  it("keeps the seed disabled outside development/local-preview auth", () => {
    expect(isDevelopmentUserSeedEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("uses an admin-portal-capable role for the seeded local account", () => {
    expect(isSuperAdminRole(DEFAULT_DEVELOPMENT_ADMIN_ROLE)).toBe(true);
  });

  it("links the seeded admin to the local SQLite crew schema with normalized login columns", async () => {
    const executed: Array<{ sql: string; args: unknown[] }> = [];
    const client = {
      execute: async (statement: InStatement): Promise<ResultSet> => {
        if (typeof statement === "string") {
          throw new Error("Expected object statement for local crew roster link");
        }
        const args = Array.isArray(statement.args)
          ? statement.args
          : Object.values(statement.args ?? {});
        executed.push({ sql: statement.sql, args });
        return emptyResultSet;
      },
    };

    const result = await linkDevelopmentUserToLocalCrewRoster(client, {
      crewId: "dev-admin-crew",
      email: "admin@example.com",
      name: "Development Admin",
      orgId: "default-org-id",
      rank: "Administrator",
      userId: "dev-admin-user",
      now: new Date("2026-06-12T00:00:00.000Z"),
    });

    expect(result).toBe("created");
    const insert = executed.find((statement) => statement.sql.startsWith("INSERT INTO crew"));
    expect(insert?.sql).toContain("first_name");
    expect(insert?.sql).toContain("last_name");
    expect(insert?.sql).toContain("name");
    expect(insert?.sql).toContain("user_id");
    expect(insert?.sql).toContain("is_active");
    expect(insert?.sql).not.toContain(" active,");
  });
});
