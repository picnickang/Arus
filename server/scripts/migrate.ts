import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import fs from "fs";
import path from "path";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Scripts:Migrate");

const { Pool } = pg;

async function main() {
  const args = process.argv.slice(2);
  const isStatus = args.includes("--status");
  const isDeploy = args.includes("--deploy");

  if (!process.env.DATABASE_URL) {
    logger.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  if (isStatus) {
    await showStatus(pool);
  } else if (isDeploy) {
    logger.info("[Migrate] Running migrations in deploy mode (non-interactive)...");
    await runMigrations(db, pool);
    logger.info("[Migrate] Deploy complete");
  } else {
    logger.info("[Migrate] Running pending migrations...");
    await runMigrations(db, pool);
    logger.info("[Migrate] Migrations complete");
  }

  await pool.end();
}

async function runMigrations(db: ReturnType<typeof drizzle>, pool: pg.Pool) {
  const migrationsFolder = path.resolve(process.cwd(), "migrations");

  if (!fs.existsSync(migrationsFolder)) {
    logger.error(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }

  try {
    await migrate(db, { migrationsFolder });
    await runServerSqlMigrations(pool);
    logger.info("[Migrate] All migrations applied successfully");
  } catch (error) {
    logger.error("[Migrate] Migration failed:", undefined, error);
    process.exit(1);
  }
}

async function runServerSqlMigrations(pool: pg.Pool): Promise<void> {
  const serverMigrationsFolder = path.resolve(process.cwd(), "server/migrations");

  if (!fs.existsSync(serverMigrationsFolder)) {
    logger.info("[Migrate] No server/migrations folder found; skipping supplemental SQL migrations");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS arus_sql_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = fs
    .readdirSync(serverMigrationsFolder)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const alreadyApplied = await pool.query(
      "SELECT 1 FROM arus_sql_migrations WHERE filename = $1 LIMIT 1",
      [file]
    );
    if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
      logger.info(`[Migrate] Supplemental SQL migration already applied: ${file}`);
      continue;
    }

    const fullPath = path.join(serverMigrationsFolder, file);
    const sqlText = fs.readFileSync(fullPath, "utf-8").trim();
    if (!sqlText || sqlText.split("\n").every((line) => line.trim().startsWith("--"))) {
      logger.info(`[Migrate] Supplemental SQL migration has no executable SQL: ${file}`);
      await pool.query("INSERT INTO arus_sql_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", [
        file,
      ]);
      continue;
    }

    logger.info(`[Migrate] Applying supplemental SQL migration: ${file}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sqlText);
      await client.query("INSERT INTO arus_sql_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`[Migrate] Supplemental SQL migration failed: ${file}`, undefined, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function showStatus(pool: pg.Pool) {
  logger.info("\n=== Migration Status ===\n");

  try {
    const result = await pool.query(`
      SELECT * FROM "__drizzle_migrations" 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      logger.info("No migrations have been applied yet.");
    } else {
      logger.info("Applied migrations:");
      for (const row of result.rows) {
        logger.info(`  - ${row.hash} (applied: ${new Date(row.created_at).toISOString()})`);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("does not exist")) {
      logger.info("No migrations have been applied yet (migrations table does not exist).");
    } else {
      logger.error("Error checking migration status:", undefined, error);
    }
  }

  const journalPath = path.resolve(process.cwd(), "migrations/meta/_journal.json");
  if (fs.existsSync(journalPath)) {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    logger.info(`\nPending migrations in journal: ${journal.entries?.length || 0} total entries`);
  }

  try {
    const supplemental = await pool.query(`
      SELECT filename, applied_at
      FROM arus_sql_migrations
      ORDER BY applied_at DESC
      LIMIT 20
    `);
    if (supplemental.rows.length > 0) {
      logger.info("\nSupplemental SQL migrations:");
      for (const row of supplemental.rows) {
        logger.info(`  - ${row.filename} (applied: ${new Date(row.applied_at).toISOString()})`);
      }
    }
  } catch {
    logger.info("\nSupplemental SQL migrations: none applied yet");
  }

  logger.info("");
}

main().catch((error) => {
  logger.error("Migration error:", undefined, error);
  process.exit(1);
});
