import { describe, expect, it, jest } from "@jest/globals";
import { adminSessionsSqlite, errorLogsSqlite } from "../../shared/sqlite-schema/admin";
import { immutableAuditTrailSqlite } from "../../shared/sqlite-schema/compliance";
import { crewSqlite } from "../../shared/sqlite-schema/crew";
import { usersSqlite } from "../../shared/schema-sqlite-sync";
import {
  runCrewCompatibilityMigration,
  runAdminSessionsCompatibilityMigration,
  runErrorLogsCompatibilityMigration,
  runUsersAuthCompatibilityMigration,
} from "../../server/sqlite-init/compatibility-migrations";
import { runImmutableAuditTrailCompatibilityMigration } from "../../server/sqlite-init/compatibility-migrations-extra";
import { getCrewTablesSql } from "../../server/sqlite/crew-tables";

describe("SQLite users auth schema", () => {
  it("exposes the auth columns used by local portal login", () => {
    expect(usersSqlite.username).toBeDefined();
    expect(usersSqlite.passwordHash).toBeDefined();
    expect(usersSqlite.passwordUpdatedAt).toBeDefined();
    expect(usersSqlite.loginEnabled).toBeDefined();
    expect(usersSqlite.mustChangePassword).toBeDefined();
    expect(usersSqlite.hubAdmin).toBeDefined();
    expect(usersSqlite.hubAccess).toBeDefined();
  });

  it("exposes local crew roster columns used by development login linking", () => {
    expect(crewSqlite.firstName).toBeDefined();
    expect(crewSqlite.lastName).toBeDefined();
    expect(crewSqlite.userId).toBeDefined();
    expect(getCrewTablesSql()[0]).toBeDefined();
  });

  it("backfills missing crew roster login-link columns on existing local crew tables", async () => {
    const executed: string[] = [];
    const columns = new Set([
      "id",
      "org_id",
      "vessel_id",
      "name",
      "rank",
      "email",
      "is_active",
      "created_at",
      "updated_at",
    ]);
    const client = {
      execute: jest.fn(async (statement: string) => {
        executed.push(statement);
        if (statement.startsWith("PRAGMA table_info(crew)")) {
          return {
            rows: [...columns].map((name) => ({ name })),
          };
        }
        const addedColumn = statement.match(/^ALTER TABLE crew ADD COLUMN ([^ ]+)/)?.[1];
        if (addedColumn) {
          columns.add(addedColumn);
        }
        return { rows: [], rowsAffected: 0 };
      }),
    };

    await runCrewCompatibilityMigration(client as never);

    expect(executed).toContain("ALTER TABLE crew ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
    expect(executed).toContain("ALTER TABLE crew ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
    expect(executed).toContain("ALTER TABLE crew ADD COLUMN user_id TEXT");
    expect(executed).toContain(
      "UPDATE crew SET first_name = name WHERE (first_name IS NULL OR first_name = '') AND name IS NOT NULL"
    );
  });

  it("backfills missing auth columns on existing local users tables", async () => {
    const executed: string[] = [];
    const client = {
      execute: jest.fn(async (statement: string) => {
        executed.push(statement);
        if (statement.startsWith("PRAGMA table_info(users)")) {
          return {
            rows: [
              { name: "id" },
              { name: "org_id" },
              { name: "email" },
              { name: "name" },
              { name: "role" },
              { name: "is_active" },
              { name: "last_login_at" },
              { name: "created_at" },
              { name: "updated_at" },
            ],
          };
        }
        return { rows: [], rowsAffected: 0 };
      }),
    };

    await runUsersAuthCompatibilityMigration(client as never);

    expect(executed).toContain("ALTER TABLE users ADD COLUMN username TEXT");
    expect(executed).toContain("ALTER TABLE users ADD COLUMN password_hash TEXT");
    expect(executed).toContain("ALTER TABLE users ADD COLUMN password_updated_at INTEGER");
    expect(executed).toContain("ALTER TABLE users ADD COLUMN login_enabled INTEGER DEFAULT 1");
    expect(executed).toContain(
      "ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0"
    );
    expect(executed).toContain("ALTER TABLE users ADD COLUMN hub_admin INTEGER DEFAULT 0");
    expect(executed).toContain("ALTER TABLE users ADD COLUMN hub_access TEXT");
  });

  it("exposes local admin sessions columns used by portal login", () => {
    expect(adminSessionsSqlite.id).toBeDefined();
    expect(adminSessionsSqlite.orgId).toBeDefined();
    expect(adminSessionsSqlite.sessionToken).toBeDefined();
    expect(adminSessionsSqlite.userId).toBeDefined();
    expect(adminSessionsSqlite.adminEmail).toBeDefined();
    expect(adminSessionsSqlite.ipAddress).toBeDefined();
    expect(adminSessionsSqlite.userAgent).toBeDefined();
    expect(adminSessionsSqlite.expiresAt).toBeDefined();
    expect(adminSessionsSqlite.lastActivityAt).toBeDefined();
    expect(adminSessionsSqlite.createdAt).toBeDefined();
  });

  it("backfills missing admin session columns on existing local session tables", async () => {
    const executed: string[] = [];
    const client = {
      execute: jest.fn(async (statement: string) => {
        executed.push(statement);
        if (statement.startsWith("PRAGMA table_info(admin_sessions)")) {
          return {
            rows: [
              { name: "id" },
              { name: "org_id" },
              { name: "user_id" },
              { name: "session_token" },
              { name: "ip_address" },
              { name: "user_agent" },
              { name: "created_at" },
              { name: "expires_at" },
              { name: "is_active" },
            ],
          };
        }
        return { rows: [], rowsAffected: 0 };
      }),
    };

    await runAdminSessionsCompatibilityMigration(client as never);

    expect(executed).toContain("ALTER TABLE admin_sessions ADD COLUMN admin_email TEXT");
    expect(executed).toContain("ALTER TABLE admin_sessions ADD COLUMN last_activity_at INTEGER");
  });

  it("exposes local immutable audit columns used by portal login auditing", () => {
    expect(immutableAuditTrailSqlite.eventCategory).toBeDefined();
    expect(immutableAuditTrailSqlite.eventType).toBeDefined();
    expect(immutableAuditTrailSqlite.eventTimestamp).toBeDefined();
    expect(immutableAuditTrailSqlite.serverTimestamp).toBeDefined();
    expect(immutableAuditTrailSqlite.prevHash).toBeDefined();
    expect(immutableAuditTrailSqlite.hash).toBeDefined();
    expect(immutableAuditTrailSqlite.dataHash).toBeDefined();
    expect(immutableAuditTrailSqlite.sequenceNumber).toBeDefined();
  });

  it("backfills missing immutable audit columns on existing local audit tables", async () => {
    const executed: string[] = [];
    const client = {
      execute: jest.fn(async (statement: string) => {
        executed.push(statement);
        if (statement.startsWith("PRAGMA table_info(immutable_audit_trail)")) {
          return {
            rows: [
              { name: "id" },
              { name: "org_id" },
              { name: "entity_type" },
              { name: "entity_id" },
              { name: "action" },
              { name: "actor" },
              { name: "actor_role" },
              { name: "data_before" },
              { name: "data_after" },
              { name: "hash" },
              { name: "previous_hash" },
              { name: "sequence_number" },
              { name: "hash_version" },
              { name: "created_at" },
            ],
          };
        }
        return { rows: [], rowsAffected: 0 };
      }),
    };

    await runImmutableAuditTrailCompatibilityMigration(client as never);

    expect(executed).toContain("ALTER TABLE immutable_audit_trail ADD COLUMN event_category TEXT");
    expect(executed).toContain("ALTER TABLE immutable_audit_trail ADD COLUMN event_type TEXT");
    expect(executed).toContain("ALTER TABLE immutable_audit_trail ADD COLUMN event_timestamp TEXT");
    expect(executed).toContain(
      "ALTER TABLE immutable_audit_trail ADD COLUMN server_timestamp TEXT"
    );
    expect(executed).toContain("ALTER TABLE immutable_audit_trail ADD COLUMN prev_hash TEXT");
    expect(executed).toContain(
      "ALTER TABLE immutable_audit_trail ADD COLUMN data_hash TEXT NOT NULL DEFAULT ''"
    );
    // Legacy duplicate columns (actor/actor_role/data_before/data_after) are kept
    // and reconciled into their canonical counterparts by a non-destructive backfill
    // rather than dropped, so PG and SQLite converge without a SQLite table rebuild.
    expect(executed.some((s) => s.includes("DROP COLUMN"))).toBe(false);
  });

  it("exposes local error log columns used after portal login", () => {
    expect(errorLogsSqlite.id).toBeDefined();
    expect(errorLogsSqlite.timestamp).toBeDefined();
    expect(errorLogsSqlite.category).toBeDefined();
    expect(errorLogsSqlite.errorType).toBeDefined();
    expect(errorLogsSqlite.errorCode).toBeDefined();
    // The canonical SQLite error_logs table carries only `message`, not the legacy
    // `error_message` duplicate. Existing tables keep their `error_message` column
    // but reconcile it into `message` via the compatibility migration (no drop).
    expect("errorMessage" in errorLogsSqlite).toBe(false);
    expect(errorLogsSqlite.message).toBeDefined();
    expect(errorLogsSqlite.userId).toBeDefined();
    expect(errorLogsSqlite.requestId).toBeDefined();
    expect(errorLogsSqlite.endpoint).toBeDefined();
  });

  it("backfills missing error log columns on existing local error log tables", async () => {
    const executed: string[] = [];
    const client = {
      execute: jest.fn(async (statement: string) => {
        executed.push(statement);
        if (statement.startsWith("PRAGMA table_info(error_logs)")) {
          return {
            rows: [
              { name: "id" },
              { name: "org_id" },
              { name: "error_type" },
              { name: "error_message" },
              { name: "stack_trace" },
              { name: "context" },
              { name: "severity" },
              { name: "resolved" },
              { name: "resolved_by" },
              { name: "resolved_at" },
              { name: "created_at" },
            ],
          };
        }
        return { rows: [], rowsAffected: 0 };
      }),
    };

    await runErrorLogsCompatibilityMigration(client as never);

    expect(executed).toContain("ALTER TABLE error_logs ADD COLUMN timestamp INTEGER");
    expect(executed).toContain(
      "ALTER TABLE error_logs ADD COLUMN category TEXT NOT NULL DEFAULT 'application'"
    );
    expect(executed).toContain("ALTER TABLE error_logs ADD COLUMN error_code TEXT");
    expect(executed).toContain(
      "ALTER TABLE error_logs ADD COLUMN message TEXT NOT NULL DEFAULT ''"
    );
    expect(executed).toContain("ALTER TABLE error_logs ADD COLUMN user_id TEXT");
    expect(executed).toContain("ALTER TABLE error_logs ADD COLUMN request_id TEXT");
    expect(executed).toContain("ALTER TABLE error_logs ADD COLUMN endpoint TEXT");
  });

  it("folds legacy error_message into message on existing tables", async () => {
    const executed: string[] = [];
    // Two-phase table_info: the first read (column probe) still has the legacy
    // `error_message` without `message`; the refreshed read (after the add-loop)
    // has both, so the reconciliation can backfill bidirectionally (kept, not dropped).
    let probed = false;
    const baseRows = [
      { name: "id" },
      { name: "org_id" },
      { name: "error_type" },
      { name: "error_message" },
      { name: "severity" },
      { name: "created_at" },
    ];
    const client = {
      execute: jest.fn(async (statement: string) => {
        executed.push(statement);
        if (statement.startsWith("PRAGMA table_info(error_logs)")) {
          if (!probed) {
            probed = true;
            return { rows: baseRows };
          }
          return { rows: [...baseRows, { name: "message" }] };
        }
        return { rows: [], rowsAffected: 0 };
      }),
    };

    await runErrorLogsCompatibilityMigration(client as never);

    expect(executed).toContain(
      "UPDATE error_logs SET message = error_message WHERE (message IS NULL OR message = '') AND error_message IS NOT NULL"
    );
    expect(executed.some((s) => s.includes("DROP COLUMN error_message"))).toBe(false);
  });
});
