import { drizzle as drizzlePgWs } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePgHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePgNode } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { Pool as NeonPool, neonConfig, neon } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";
import * as schema from "@shared/schema-runtime";
import * as schemaSqliteSync from "@shared/schema-sqlite-sync";
import * as schemaSqliteVessel from "@shared/schema-sqlite-vessel";
import path from "node:path";
import * as fs from "node:fs";
import { logExpectedLimitation } from "./utils/logger.js";
import { createLogger } from "./lib/structured-logger";
const logger = createLogger("DbConfig");

// Detect database type from DATABASE_URL
function detectDatabaseType(url: string): "neon" | "standard" {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".neon.tech")) {
      return "neon";
    }
  } catch {
    // Invalid URL, fall back to standard
  }
  return "standard";
}

// Detect Replit environment
const isReplitEnvironment = !!process.env.REPL_ID || !!process.env.REPL_SLUG;

/**
 * Database Configuration for Dual-Mode Deployment
 *
 * ARCHITECTURE NOTES:
 * - Cloud Mode (LOCAL_MODE=false): Uses PostgreSQL via Neon with full schema support
 * - Vessel Mode (LOCAL_MODE=true): Uses SQLite via libSQL/Turso for offline-first operation
 *
 * IMPORTANT SCHEMA COMPATIBILITY:
 * The current schema (shared/schema.ts) uses PostgreSQL-specific types that are NOT
 * compatible with SQLite:
 * - jsonb columns → SQLite needs TEXT to store JSON
 * - serial auto-increment → SQLite needs INTEGER PRIMARY KEY AUTOINCREMENT
 * - .array() columns → SQLite needs TEXT to store JSON arrays
 *
 * For vessel mode to work, the schema must be refactored to use SQLite-compatible types,
 * or a separate SQLite schema must be maintained alongside the PostgreSQL schema.
 *
 * Current Status:
 * ✅ Cloud Mode: Fully operational with PostgreSQL
 * ⚠️  Vessel Mode: Infrastructure ready, schema migration required
 */

// Configure WebSocket for Neon serverless (required for Node.js v21 and below)
neonConfig.webSocketConstructor = ws;

// Optimize Neon connection settings for better reliability
neonConfig.pipelineConnect = "password"; // Use pipelining for faster connections
neonConfig.useSecureWebSocket = true; // Force TLS

// Suppress transient WebSocket errors during cold starts
neonConfig.wsProxy = (host) => `${host}`; // Use direct connection

/**
 * AUTO-FALLBACK LOGIC (Side Effect - runs before runtimeEnv import)
 * If EMBEDDED_MODE=true and no DATABASE_URL, automatically switch to local mode
 * This must run BEFORE importing runtimeEnv to ensure proper initialization order
 */
const isEmbedded = process.env.EMBEDDED_MODE === "true";
if (isEmbedded && !process.env.DATABASE_URL && process.env.LOCAL_MODE !== "true") {
  logger.warn("⚠️ [DB Config] Embedded mode: DATABASE_URL missing, auto-switching to local SQLite mode");
  process.env.LOCAL_MODE = "true";
}

/**
 * SINGLE SOURCE OF TRUTH: Import from runtimeEnv.ts after auto-fallback
 * Import dynamically to ensure side effects run first
 */
const { isLocalMode: runtimeIsLocalMode } = await import("./config/runtimeEnv.js");
export const isLocalMode = runtimeIsLocalMode;
export const deploymentMode = isLocalMode ? "VESSEL (Offline-First)" : "CLOUD (Online)";

logger.info(`\n=== Database Configuration ===`);
logger.info(`Deployment Mode: ${deploymentMode}`);

// Cloud PostgreSQL Database (Shore office / always-online deployments)
let pgPool: NeonPool | PgPool | null = null;
let cloudDatabase:
  | ReturnType<typeof drizzlePgWs>
  | ReturnType<typeof drizzlePgHttp>
  | ReturnType<typeof drizzlePgNode>
  | null = null;
export let connectionMode: "http" | "websocket" | "standard" | "sqlite" = "sqlite";

if (!isLocalMode) {
  // Validate DATABASE_URL exists for cloud mode
  if (!process.env.DATABASE_URL) {
    logger.error("ERROR: DATABASE_URL environment variable is required for cloud mode");
    logger.error("Hint: Set EMBEDDED_MODE=true to use local SQLite instead");
    process.exit(1);
  }

  const dbType = detectDatabaseType(process.env.DATABASE_URL);

  if (dbType === "standard") {
    // Use standard node-postgres for non-Neon databases (Replit, AWS RDS, etc.)
    logger.info("ℹ️ Standard PostgreSQL detected: Using node-postgres driver");

    pgPool = new PgPool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors gracefully
    pgPool.on("error", (err) => {
      logger.error("[DB Pool] Error:", undefined, err.message);
    });

    // Configure drizzle with node-postgres driver
    cloudDatabase = drizzlePgNode(pgPool, { schema });
    connectionMode = "standard";

    logger.info("✓ Cloud PostgreSQL: Connected (standard mode)");
  } else if (isReplitEnvironment) {
    // Use HTTP driver in Replit for Neon - WebSocket connections are killed by Replit's proxy after ~20s
    logger.info("ℹ️ Replit + Neon detected: Using Neon HTTP driver (WebSocket proxy incompatible)");

    const sql = neon(process.env.DATABASE_URL);
    cloudDatabase = drizzlePgHttp(sql, { schema });
    connectionMode = "http";

    logger.info("✓ Cloud PostgreSQL: Connected (HTTP mode)");
  } else {
    // Use WebSocket driver for Neon in production/desktop - supports transactions
    logger.info("ℹ️ Neon detected: Using Neon WebSocket driver (full transaction support)");

    const connectionUrl = new URL(process.env.DATABASE_URL);
    if (!connectionUrl.searchParams.has("connect_timeout")) {
      connectionUrl.searchParams.set("connect_timeout", "15");
    }

    pgPool = new NeonPool({
      connectionString: connectionUrl.toString(),
      max: 20,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 15000,
    });

    (pgPool as any).on("error", (err: any) => {
      if (err.message?.includes("WebSocket")) {
        logger.warn("⚠️ Neon WebSocket connection error (transient, retrying...)");
      } else {
        logger.error("[DB Pool] Unexpected error:", undefined, err.message);
      }
    });

    cloudDatabase = drizzlePgWs(pgPool as any, { schema });
    connectionMode = "websocket";

    logger.info("✓ Cloud PostgreSQL: Connected (WebSocket mode)");
  }
}

// Local SQLite Database with Cloud Sync (Vessel / offline deployments)
let localClient: ReturnType<typeof createClient> | null = null;
export let libsqlClient: ReturnType<typeof createClient> | null = null;
let localDatabase: ReturnType<typeof drizzleSqlite> | null = null;

// Async initialization function for local mode (prevents top-level await)
async function initializeLocalDatabase() {
  if (!isLocalMode) {
    return;
  }

  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info("✓ Created data directory:", { details: dataDir });
  }

  const localDbPath = path.join(dataDir, "vessel-local.db");

  // Validate Turso configuration for sync
  const hasSyncUrl = !!process.env.TURSO_SYNC_URL;
  const hasAuthToken = !!process.env.TURSO_AUTH_TOKEN;

  if (hasSyncUrl && hasAuthToken) {
    logger.info("✓ Turso Sync: Enabled (Managed by Sync Manager)");

    // Create libSQL client with cloud sync
    // IMPORTANT: syncInterval set to 0 - Sync Manager controls all sync operations
    localClient = createClient({
      url: `file:${localDbPath}`,
      syncUrl: process.env.TURSO_SYNC_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      syncInterval: 0, // Disable auto-sync - Sync Manager controls sync timing
      encryptionKey: process.env.LOCAL_DB_KEY, // Optional encryption at rest
    });
    libsqlClient = localClient;
  } else {
    logExpectedLimitation("Turso Sync", "Cloud sync not configured - running offline-only", [
      "Set TURSO_SYNC_URL and TURSO_AUTH_TOKEN to enable cloud sync",
      "Offline-only mode is normal for desktop/vessel deployments",
    ]);

    // Create local-only libSQL client (no sync)
    localClient = createClient({
      url: `file:${localDbPath}`,
    });
    libsqlClient = localClient;
  }

  // Apply SQLite performance optimizations
  logger.info("→ Applying SQLite performance optimizations...");
  try {
    // Enable Write-Ahead Logging for better concurrency
    await localClient.execute("PRAGMA journal_mode=WAL");

    // Optimize synchronous mode for performance (NORMAL is safe with WAL)
    await localClient.execute("PRAGMA synchronous=NORMAL");

    // Set cache size to 64MB for better query performance
    await localClient.execute("PRAGMA cache_size=-64000");

    // Use memory for temporary storage
    await localClient.execute("PRAGMA temp_store=MEMORY");

    // Optimize page size (4KB is good for most workloads)
    await localClient.execute("PRAGMA page_size=4096");

    // Enable foreign key constraints
    await localClient.execute("PRAGMA foreign_keys=ON");

    // Set busy timeout to 5 seconds to handle concurrent writes
    await localClient.execute("PRAGMA busy_timeout=5000");

    logger.info("✓ SQLite performance optimizations applied");
    logger.info("  • WAL mode enabled (better concurrency)");
    logger.info("  • Cache: 64MB");
    logger.info("  • Sync: NORMAL (safe with WAL)");
    logger.info("  • Foreign keys: ON");
  } catch (error) {
    logger.warn("⚠ Failed to apply some SQLite optimizations:", { details: error instanceof Error ? error.message : "Unknown error" });
  }

  // Configure drizzle for SQLite with SQLite-compatible schemas
  // Combine sync tables + vessel operation tables for vessel mode
  const sqliteSchema = {
    ...schemaSqliteSync,
    ...schemaSqliteVessel,
  };
  localDatabase = drizzleSqlite(localClient, { schema: sqliteSchema });

  // CRITICAL: Update the exported db variable after initialization
  dbInstance = localDatabase;

  logger.info(`✓ Local SQLite: ${localDbPath}`);

  const { initializeSqliteDatabase, isSqliteDatabaseInitialized, applyInventoryMigrations } =
    await import("./sqlite-init");
  const isInitialized = await isSqliteDatabaseInitialized();

  if (!isInitialized) {
    logger.info("→ Initializing SQLite database tables...");
    await initializeSqliteDatabase();
    logger.info("✓ SQLite tables initialized");
  } else {
    logger.info("→ Running schema migrations on existing SQLite database...");
    await applyInventoryMigrations();
    logger.info("✓ SQLite schema migrations applied");
  }

  // Perform initial sync if sync is enabled
  if (hasSyncUrl && hasAuthToken) {
    try {
      await localClient.sync();
      logger.info("✓ Initial sync completed");
    } catch (error) {
      logger.warn("⚠ Initial sync failed (will retry):", { details: error instanceof Error ? error.message : "Unknown error" });
      logger.warn("  Application will continue with local data");
    }
  }

  logger.info("==============================\n");
}

// Export initialization function for explicit calling from server/index.ts
export { initializeLocalDatabase };

// Mutable database instance that gets set after initialization
let dbInstance:
  | ReturnType<typeof drizzlePgWs>
  | ReturnType<typeof drizzlePgHttp>
  | ReturnType<typeof drizzlePgNode>
  | ReturnType<typeof drizzleSqlite>
  | null = isLocalMode ? localDatabase : cloudDatabase;

// Type alias: expose the PG-WebSocket variant as the canonical query-builder type.
// All three PG drivers (ws, http, node) share the same query-builder API, and
// SQLite's libsql driver is interchangeable for our storage layer's purposes.
// This gives downstream consumers a concrete query-builder type instead of `any`.
type DbType = ReturnType<typeof drizzlePgWs<typeof schema>>;

// Export the appropriate database instance based on mode
// This will be null initially in local mode, then set after initializeLocalDatabase()
export const db = new Proxy({} as any, {
  get(target, prop) {
    if (!dbInstance) {
      throw new Error(
        `Database not initialized. In ${isLocalMode ? "local" : "cloud"} mode, ensure initializeLocalDatabase() is called before accessing db.`
      );
    }
    const value = (dbInstance as any)[prop];
    // If it's a function, bind it to the dbInstance to preserve 'this' context
    if (typeof value === "function") {
      return value.bind(dbInstance);
    }
    return value;
  },
  // Handle property checks (for 'in' operator and hasOwnProperty)
  has(target, prop) {
    if (!dbInstance) {
      return false;
    }
    return prop in dbInstance;
  },
  // Handle Object.keys, Object.getOwnPropertyNames, etc.
  ownKeys(target) {
    if (!dbInstance) {
      return [];
    }
    return Reflect.ownKeys(dbInstance);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (!dbInstance) {
      return undefined;
    }
    return Reflect.getOwnPropertyDescriptor(dbInstance, prop);
  },
}) as DbType;

// Helper alias for transaction callback parameter typing.
// Use this in repository methods instead of the awkward
//   `Parameters<Parameters<typeof db.transaction>[0]>[0]` pattern.
export type DbTransaction = Parameters<Parameters<DbType["transaction"]>[0]>[0];

// Type-safe database type alias for downstream consumers
export type Database = DbType;

export const pool = pgPool;

// Mode-aware table exports for storage layer
// These provide a unified interface regardless of PostgreSQL vs SQLite
export const tables = isLocalMode
  ? {
      equipmentTelemetry: schemaSqliteVessel.equipmentTelemetrySqlite,
      vessels: schemaSqliteVessel.vesselsSqlite,
      equipment: schemaSqliteVessel.equipmentSqlite,
      devices: schemaSqliteVessel.devicesSqlite,
      workOrders: schemaSqliteVessel.workOrdersSqlite,
      crew: schemaSqliteVessel.crewSqlite,
      crewRestSheet: schemaSqliteVessel.crewRestSheetSqlite,
      crewRestDay: schemaSqliteVessel.crewRestDaySqlite,
      deckLogDaily: schemaSqliteVessel.deckLogDailySqlite,
      deckLogHourly: schemaSqliteVessel.deckLogHourlySqlite,
      deckLogWatch: schemaSqliteVessel.deckLogWatchSqlite,
      deckLogEvents: schemaSqliteVessel.deckLogEventsSqlite,
      deckLogHourlyAutoFill: schemaSqliteVessel.deckLogHourlyAutoFillSqlite,
      engineLogDaily: schemaSqliteVessel.engineLogDailySqlite,
      engineLogHourly: schemaSqliteVessel.engineLogHourlySqlite,
      engineLogGenerator: schemaSqliteVessel.engineLogGeneratorSqlite,
      engineLogWatch: schemaSqliteVessel.engineLogWatchSqlite,
      engineLogEvents: schemaSqliteVessel.engineLogEventsSqlite,
      alertNotifications: schemaSqliteVessel.alertNotificationsSqlite,
      partsInventory: schemaSqliteVessel.partsInventorySqlite,
      syncJournal: schemaSqliteSync.syncJournalSqlite,
      syncOutbox: schemaSqliteSync.syncOutboxSqlite,
    }
  : {
      equipmentTelemetry: schema.equipmentTelemetry,
      vessels: schema.vessels,
      equipment: schema.equipment,
      devices: schema.devices,
      workOrders: schema.workOrders,
      crew: schema.crew,
      crewRestSheet: schema.crewRestSheet,
      crewRestDay: schema.crewRestDay,
      deckLogDaily: schema.deckLogDaily,
      deckLogHourly: schema.deckLogHourly,
      deckLogWatch: schema.deckLogWatch,
      deckLogEvents: schema.deckLogEvents,
      deckLogHourlyAutoFill: schema.deckLogHourlyAutoFill,
      engineLogDaily: schema.engineLogDaily,
      engineLogHourly: schema.engineLogHourly,
      engineLogGenerator: schema.engineLogGenerator,
      engineLogWatch: schema.engineLogWatch,
      engineLogEvents: schema.engineLogEvents,
      alertNotifications: schema.alertNotifications,
      partsInventory: schema.partsInventory,
      syncJournal: schema.syncJournal,
      syncOutbox: schema.syncOutbox,
    };
