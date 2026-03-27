import { logger } from "../utils/logger";
import * as fs from "fs";
import * as path from "path";

const LOG_CTX = "MigrationRunner";

const MIGRATIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id          SERIAL PRIMARY KEY,
  filename    TEXT NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum    TEXT
);`;

export class MigrationRunner {
  private db: any;
  private migrationsDir: string;

  constructor(db: any, migrationsDir = "./server/migrations") {
    this.db = db;
    this.migrationsDir = migrationsDir;
  }

  async run(): Promise<{ applied: string[]; skipped: string[]; errors: string[] }> {
    const applied: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    try {
      const { sql } = await import("drizzle-orm");
      await this.db.execute(sql.raw(MIGRATIONS_TABLE_SQL));

      const appliedRows = await this.db.execute(sql.raw(
        "SELECT filename FROM schema_migrations ORDER BY id ASC"
      ));
      const appliedSet = new Set((appliedRows?.rows ?? []).map((r: any) => r.filename));

      if (!fs.existsSync(this.migrationsDir)) {
        logger.info(LOG_CTX, `No migrations directory at ${this.migrationsDir}`);
        return { applied, skipped, errors };
      }

      const files = fs.readdirSync(this.migrationsDir)
        .filter(f => f.endsWith(".sql"))
        .sort();

      for (const file of files) {
        if (appliedSet.has(file)) {
          skipped.push(file);
          continue;
        }

        const filePath = path.join(this.migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, "utf-8");

        try {
          const crypto = await import("crypto");
          const checksum = crypto.createHash("md5").update(sqlContent).digest("hex");

          if (typeof this.db.transaction === "function") {
            await this.db.transaction(async (tx: any) => {
              await tx.execute(sql.raw(sqlContent));
              await tx.execute(sql`INSERT INTO schema_migrations (filename, checksum) VALUES (${file}, ${checksum})`);
            });
          } else {
            await this.db.execute(sql.raw(sqlContent));
            await this.db.execute(sql`INSERT INTO schema_migrations (filename, checksum) VALUES (${file}, ${checksum})`);
          }

          applied.push(file);
          logger.info(LOG_CTX, `Applied migration: ${file}`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`${file}: ${msg}`);
          logger.error(LOG_CTX, `Migration failed: ${file}`, error);
          break;
        }
      }

      logger.info(LOG_CTX, `Migrations complete: ${applied.length} applied, ${skipped.length} skipped, ${errors.length} errors`);
    } catch (error) {
      logger.error(LOG_CTX, "Migration runner failed", error);
      errors.push(`Runner error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { applied, skipped, errors };
  }
}

export default MigrationRunner;
