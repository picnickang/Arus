import { createLogger } from "../lib/structured-logger";
import type { InStatement, ResultSet } from "@libsql/client";
import { runBootMigrations } from "../scripts/migrate";
import { dbSystemAdminStorage } from "../db/system-admin/index.js";
import { withServiceTimeout } from "./services-runtime.js";
const logger = createLogger("Bootstrap:Services");

export function canRunPostgresBootstrapMigration(dbHandle: unknown): boolean {
  return Boolean(dbHandle && typeof (dbHandle as { execute?: unknown }).execute === "function");
}

/**
 * Service Initialization
 * Database, job queue, ML services, telemetry
 *
 * Security Note (S5443 - publicly writable directories):
 * /tmp/kb-uploads is used for temporary file processing during KB document uploads.
 * Files are processed and moved to permanent storage immediately.
 * In production, consider using a secure application-owned directory.
 */

export async function initializeLocalDatabase(): Promise<void> {
  if (process.env["LOCAL_MODE"] === "true") {
    const { initializeLocalDatabase: initLocal } = await import("../db-config");
    await initLocal();
  }
}

/**
 * Prod-hardening: opt-in pre-boot migration.
 *
 * Gated on `MIGRATE_ON_BOOT=true` because (a) most deploys still use
 * the explicit `npm run db:migrate:deploy` step in CI/CD and (b) we
 * never want a misconfigured local-mode or test boot to silently
 * mutate a shared dev database. When the flag is set we run the
 * Drizzle migrator + supplemental SQL migrator BEFORE the schema-
 * dependent setup in `initializeDatabase()` so a fresh schema diff
 * doesn't surface as a runtime "column does not exist" much later.
 */
export async function runMigrationsOnBoot(): Promise<void> {
  if (process.env["MIGRATE_ON_BOOT"] !== "true") {
    return;
  }
  if (process.env["LOCAL_MODE"] === "true" || process.env["EMBEDDED_MODE"] === "true") {
    logger.info("ℹ MIGRATE_ON_BOOT skipped (local/embedded mode uses SQLite)");
    return;
  }
  if (!process.env["DATABASE_URL"]) {
    logger.warn("⚠ MIGRATE_ON_BOOT requested but DATABASE_URL missing — skipping");
    return;
  }
  logger.info("→ MIGRATE_ON_BOOT: applying pending migrations before service init...");
  await runBootMigrations();
  logger.info("✓ MIGRATE_ON_BOOT: migrations up to date");
}

export async function initializeDatabase(): Promise<void> {
  logger.info("→ Initializing database...");
  const { db, isLocalMode } = await import("../db-config");
  const { devices } = await import("@shared/schema-runtime");
  const { dbInventoryStorage } = await import("../repositories");

  const maxRetries = 3;
  const connectionTimeout = 30000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`  Attempting database connection (attempt ${attempt}/${maxRetries})...`);
      await withServiceTimeout(
        db.select().from(devices).limit(1),
        connectionTimeout,
        "Database connection check"
      );
      logger.info("  Database connection verified");

      if (!isLocalMode) {
        logger.info("PostgreSQL mode: Running TimescaleDB and view setup...");
        const { ensureTimescaleDBSetup } = await import("../timescaledb-bootstrap");
        await withServiceTimeout(ensureTimescaleDBSetup(), 60000, "TimescaleDB setup");

        const { createDatabaseViews, verifyDatabaseViews } = await import("../schema-views");
        await withServiceTimeout(createDatabaseViews(), 60000, "Create database views");
        const viewVerification = await withServiceTimeout(
          verifyDatabaseViews(),
          30000,
          "Verify database views"
        );
        if (!viewVerification.success) {
          logger.error("Database view verification failed:", undefined, viewVerification.errors);
          throw new Error("Essential database views are not functioning properly");
        }

        await withServiceTimeout(
          dbInventoryStorage.seedStockForParts("default-org-id"),
          30000,
          "Seed stock data"
        );

        const { createDatabaseIndexes, analyzeDatabasePerformance } = await import("../db-indexes");
        await withServiceTimeout(createDatabaseIndexes(), 60000, "Create database indexes");

        if (process.env["NODE_ENV"] === "development") {
          await withServiceTimeout(
            analyzeDatabasePerformance(),
            30000,
            "Analyze database performance"
          );
        }
      } else {
        logger.info(
          "SQLite mode: Skipping PostgreSQL-specific setup (TimescaleDB, views, indexes)"
        );
        logger.info("Database ready for offline-first operation");
      }

      logger.info("✓ Database initialized successfully");

      if (canRunPostgresBootstrapMigration(db)) {
        try {
          const { migrateWorkOrderServiceOrderBridge } = await import("../migrations/wo-so-bridge");
          await migrateWorkOrderServiceOrderBridge(db);
          logger.info("✓ WO ↔ SO bridge migration applied");
        } catch (err) {
          logger.warn("[WO-SO Bridge] Migration skipped or already applied:", {
            details: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        logger.info("[WO-SO Bridge] Migration skipped in local SQLite mode");
      }

      // Wave 0.6 — Feature flag overrides table + cache priming.
      if (canRunPostgresBootstrapMigration(db)) {
        try {
          const { migrateFeatureFlagOverrides } = await import(
            "../migrations/011-feature-flag-overrides"
          );
          await migrateFeatureFlagOverrides(db);
          const { featureFlags } = await import("../infrastructure/feature-flags");
          await featureFlags.refresh(db);
          featureFlags.startAutoRefresh(db, 60_000);
          logger.info(
            "✓ Feature flag overrides table ready (cache primed, auto-refresh every 60s)"
          );
        } catch (err) {
          logger.warn("[FeatureFlags] Override table setup skipped:", {
            details: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        logger.info("[FeatureFlags] Override table setup skipped in local SQLite mode");
      }

      // 0043 — one-shot move of any legacy plaintext OpenAI key into the
      // encrypted column, plus a loud production warning while telemetry
      // ingestion runs without HMAC device authentication.
      try {
        await dbSystemAdminStorage.ensureSettingsSecretsMigrated();
        if (process.env["NODE_ENV"] === "production") {
          const settings = await dbSystemAdminStorage.getSettings();
          if (!settings?.hmacRequired) {
            logger.warn(
              "⚠ Telemetry HMAC validation is DISABLED — unauthenticated devices can post telemetry. " +
                "Set hmacRequired=true in system settings to require device signatures."
            );
          }
        }
      } catch (err) {
        logger.warn("[SystemSettings] Secret migration/HMAC check skipped:", {
          details: err instanceof Error ? err.message : String(err),
        });
      }

      return;
    } catch (error: unknown) {
      const isLastAttempt = attempt === maxRetries;
      logger.warn(`  Database initialization attempt ${attempt} failed:`, {
        details: error instanceof Error ? error.message : String(error),
      });

      if (!isLastAttempt) {
        const delay = attempt * 5000;
        logger.info(`  Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error("Database initialization failed after all retries:", undefined, error);
        if (process.env["EMBEDDED_MODE"] === "true" || process.env["LOCAL_MODE"] === "true") {
          logger.error("Embedded/local mode: Continuing despite initialization error");
          return;
        }
        throw error;
      }
    }
  }
}

type SeedEnvironment = Record<string, string | undefined>;

export const DEFAULT_DEVELOPMENT_ADMIN_ROLE = "system_admin";

export function isDevelopmentUserSeedEnabled(env: SeedEnvironment = process.env): boolean {
  return env["NODE_ENV"] === "development" || env["ARUS_DEV_LOGIN"] === "1";
}

type LocalCrewRosterClient = {
  execute: (statement: InStatement) => Promise<ResultSet>;
};

type DevelopmentCrewLinkInput = {
  crewId: string;
  email: string;
  name: string;
  now?: Date;
  orgId: string;
  rank: string;
  userId: string;
};

export type DevelopmentCrewLinkResult = "already-linked" | "created" | "relinked";

function splitCrewName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Development",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "Admin",
  };
}

export async function linkDevelopmentUserToLocalCrewRoster(
  client: LocalCrewRosterClient,
  input: DevelopmentCrewLinkInput
): Promise<DevelopmentCrewLinkResult> {
  const linked = await client.execute({
    sql: "SELECT id FROM crew WHERE user_id = ? LIMIT 1",
    args: [input.userId],
  });
  if ((linked.rows ?? []).length > 0) {
    return "already-linked";
  }

  const existing = await client.execute({
    sql: "SELECT id FROM crew WHERE id = ? LIMIT 1",
    args: [input.crewId],
  });
  const nowMs = (input.now ?? new Date()).getTime();

  if ((existing.rows ?? []).length === 0) {
    const { firstName, lastName } = splitCrewName(input.name);
    await client.execute({
      sql:
        "INSERT INTO crew " +
        "(id, org_id, first_name, last_name, name, email, rank, user_id, is_active, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        input.crewId,
        input.orgId,
        firstName,
        lastName,
        input.name,
        input.email,
        input.rank,
        input.userId,
        1,
        nowMs,
        nowMs,
      ],
    });
    return "created";
  }

  await client.execute({
    sql: "UPDATE crew SET user_id = ?, updated_at = ? WHERE id = ?",
    args: [input.userId, nowMs, input.crewId],
  });
  return "relinked";
}

export async function seedDevelopmentUser(): Promise<void> {
  if (!isDevelopmentUserSeedEnabled()) {
    return;
  }

  logger.info("→ Seeding development user...");
  const { db, isLocalMode, libsqlClient } = await import("../db");
  const { users } = await import("@shared/schema-runtime");
  const { eq } = await import("drizzle-orm");

  const devUserId = "dev-admin-user";
  const devOrgId = "default-org-id";
  const bcrypt = (await import("bcryptjs")).default;
  const DEFAULT_ADMIN_USERNAME = "admin";
  const DEFAULT_ADMIN_PASSWORD = "admin";

  try {
    const existing = await db.select().from(users).where(eq(users.id, devUserId)).limit(1);

    if (existing.length === 0) {
      // Out-of-the-box admin: username `admin` / password `admin`, flagged to
      // force a password change on first sign-in. This is the real login path
      // now that the shared admin password has been removed.
      const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
      await db.insert(users).values({
        id: devUserId,
        orgId: devOrgId,
        email: "admin@example.com",
        name: "Development Admin",
        username: DEFAULT_ADMIN_USERNAME,
        role: DEFAULT_DEVELOPMENT_ADMIN_ROLE,
        isActive: true,
        loginEnabled: true,
        mustChangePassword: true,
        passwordHash,
      });
      logger.info("✓ Development admin created (username: admin)");
    } else {
      const current = existing[0]!;
      // Truly idempotent: only initialize credentials when the account has never
      // had a password set (passwordHash === null) — i.e. an uninitialized
      // bootstrap row. Once any password exists, the account is considered
      // user-managed and is NEVER touched again, so a username or password later
      // changed via the Crew "Access & Login" tab persists across restarts.
      if (current.passwordHash === null) {
        const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
        await db
          .update(users)
          .set({
            username: DEFAULT_ADMIN_USERNAME,
            role: DEFAULT_DEVELOPMENT_ADMIN_ROLE,
            loginEnabled: true,
            mustChangePassword: true,
            passwordHash,
          })
          .where(eq(users.id, devUserId));
        logger.info("✓ Development admin initialized with default credentials (username: admin)");
      } else {
        logger.info("✓ Development admin already exists (user-managed credentials left untouched)");
      }
    }

    // Link the default admin to a crew record so it appears in the crew roster
    // "Access & Login" tab (UserAccessEditor). Idempotent: skip once any crew
    // row already references this user.
    if (isLocalMode) {
      if (!libsqlClient) {
        logger.warn(
          "⚠️  Could not link development admin to local crew roster: SQLite client missing"
        );
        return;
      }
      const result = await linkDevelopmentUserToLocalCrewRoster(libsqlClient, {
        crewId: "dev-admin-crew",
        email: "admin@example.com",
        name: "Development Admin",
        orgId: devOrgId,
        rank: "Administrator",
        userId: devUserId,
      });
      logger.info(`✓ Development admin crew roster link ${result}`);
      return;
    }

    const { crew } = await import("@shared/schema-runtime");
    const linked = await db.select().from(crew).where(eq(crew.userId, devUserId)).limit(1);
    if (linked.length === 0) {
      const devCrewId = "dev-admin-crew";
      const existingCrew = await db.select().from(crew).where(eq(crew.id, devCrewId)).limit(1);
      if (existingCrew.length === 0) {
        await db.insert(crew).values({
          id: devCrewId,
          orgId: devOrgId,
          name: "Development Admin",
          rank: "Administrator",
          userId: devUserId,
          active: true,
        });
        logger.info("✓ Development admin linked to crew roster (Access & Login)");
      } else {
        await db.update(crew).set({ userId: devUserId }).where(eq(crew.id, devCrewId));
        logger.info("✓ Development admin re-linked to existing crew record");
      }
    }
  } catch (error: unknown) {
    logger.warn("⚠️  Could not seed development user:", {
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
