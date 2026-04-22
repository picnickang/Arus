import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

async function main() {
  const args = process.argv.slice(2);
  const isStatus = args.includes("--status");
  const isDeploy = args.includes("--deploy");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  if (isStatus) {
    await showStatus(pool);
  } else if (isDeploy) {
    console.log("[Migrate] Running migrations in deploy mode (non-interactive)...");
    await runMigrations(db);
    console.log("[Migrate] Deploy complete");
  } else {
    console.log("[Migrate] Running pending migrations...");
    await runMigrations(db);
    console.log("[Migrate] Migrations complete");
  }

  await pool.end();
}

async function runMigrations(db: ReturnType<typeof drizzle>) {
  const migrationsFolder = path.resolve(process.cwd(), "migrations");

  if (!fs.existsSync(migrationsFolder)) {
    console.error(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }

  try {
    await migrate(db, { migrationsFolder });
    console.log("[Migrate] All migrations applied successfully");
  } catch (error) {
    console.error("[Migrate] Migration failed:", error);
    process.exit(1);
  }
}

async function showStatus(pool: pg.Pool) {
  console.log("\n=== Migration Status ===\n");

  try {
    const result = await pool.query(`
      SELECT * FROM "__drizzle_migrations" 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log("No migrations have been applied yet.");
    } else {
      console.log("Applied migrations:");
      for (const row of result.rows) {
        console.log(`  - ${row.hash} (applied: ${new Date(row.created_at).toISOString()})`);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("does not exist")) {
      console.log("No migrations have been applied yet (migrations table does not exist).");
    } else {
      console.error("Error checking migration status:", error);
    }
  }

  const journalPath = path.resolve(process.cwd(), "migrations/meta/_journal.json");
  if (fs.existsSync(journalPath)) {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    console.log(`\nPending migrations in journal: ${journal.entries?.length || 0} total entries`);
  }

  console.log("");
}

main().catch((error) => {
  console.error("Migration error:", error);
  process.exit(1);
});
