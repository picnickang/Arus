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
    await runMigrations(db);
    logger.info("[Migrate] Deploy complete");
  } else {
    logger.info("[Migrate] Running pending migrations...");
    await runMigrations(db);
    logger.info("[Migrate] Migrations complete");
  }

  await pool.end();
}

async function runMigrations(db: ReturnType<typeof drizzle>) {
  const migrationsFolder = path.resolve(process.cwd(), "migrations");

  if (!fs.existsSync(migrationsFolder)) {
    logger.error(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }

  try {
    await migrate(db, { migrationsFolder });
    logger.info("[Migrate] All migrations applied successfully");
  } catch (error) {
    logger.error("[Migrate] Migration failed:", undefined, error);
    process.exit(1);
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

  logger.info("");
}

main().catch((error) => {
  logger.error("Migration error:", undefined, error);
  process.exit(1);
});
