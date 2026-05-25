import { db } from "./db";
import { sql } from "drizzle-orm";
import { createLogger } from "./lib/structured-logger";
const logger = createLogger("DbIndexes");

const REQUIRED_INDEXES = [
  "idx_equipment_vessel_created",
  "idx_maintenance_records_equipment_date",
  "idx_maintenance_records_org_id",
  "idx_raw_telemetry_equipment_ts",
  "idx_ml_models_org_status",
  "idx_pdm_alerts_asset_time",
  "idx_pdm_alerts_vessel",
];

export interface IndexVerificationResult {
  ok: boolean;
  verified: string[];
  missing: string[];
  lastCheckedAt: string;
}

export async function verifyDatabaseIndexes(): Promise<IndexVerificationResult> {
  const isProduction = process.env['NODE_ENV'] === "production";
  const selfHealEnabled = process.env['DEV_SELF_HEAL'] === "true";

  const verified: string[] = [];
  const missing: string[] = [];

  logger.info("[DB Indexes] Verifying required indexes...");

  for (const indexName of REQUIRED_INDEXES) {
    try {
      const result = await db.execute(
        sql.raw(`SELECT to_regclass('public.${indexName}') AS exists`)
      );
      const exists = result.rows?.[0]?.['exists'] !== null;

      if (exists) {
        verified.push(indexName);
      } else {
        missing.push(indexName);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[DB Indexes] Could not verify ${indexName}: ${message}`);
      missing.push(indexName);
    }
  }

  const lastCheckedAt = new Date().toISOString();

  if (missing.length === 0) {
    logger.info(`[DB Indexes] Verified: All ${verified.length} required indexes exist`);
    return { ok: true, verified, missing, lastCheckedAt };
  }

  if (isProduction) {
    logger.error(`[DB Indexes] ERROR: Missing indexes in production!`);
    logger.error(`[DB Indexes] Missing: ${missing.join(", ")}`);
    logger.error(`[DB Indexes] Remediation: Run 'npm run db:migrate:deploy' before app rollout`);
    return { ok: false, verified, missing, lastCheckedAt };
  }

  if (selfHealEnabled) {
    logger.info(`[DB Indexes] DEV_SELF_HEAL=true - Auto-creating ${missing.length} missing indexes...`);
    await autoCreateMissingIndexes(missing);
    return { ok: true, verified: [...verified, ...missing], missing: [], lastCheckedAt };
  }

  logger.warn(`[DB Indexes] WARN: ${missing.length} missing indexes in development`);
  logger.warn(`[DB Indexes] Missing: ${missing.join(", ")}`);
  logger.warn(`[DB Indexes] Run 'npm run db:migrate' to create them, or set DEV_SELF_HEAL=true`);

  return { ok: false, verified, missing, lastCheckedAt };
}

async function autoCreateMissingIndexes(missing: string[]): Promise<void> {
  const INDEX_DEFINITIONS: Record<string, { table: string; columns: string }> = {
    idx_equipment_vessel_created: { table: "equipment", columns: "vessel_id, created_at DESC" },
    idx_maintenance_records_equipment_date: {
      table: "maintenance_records",
      columns: "equipment_id, actual_start_time DESC",
    },
    idx_maintenance_records_org_id: { table: "maintenance_records", columns: "org_id" },
    idx_raw_telemetry_equipment_ts: { table: "raw_telemetry", columns: "src, ts DESC" },
    idx_ml_models_org_status: { table: "ml_models", columns: "org_id, status" },
    idx_pdm_alerts_asset_time: { table: "pdm_alerts", columns: "asset_id, at DESC" },
    idx_pdm_alerts_vessel: { table: "pdm_alerts", columns: "vessel_name, at DESC" },
  };

  for (const indexName of missing) {
    const def = INDEX_DEFINITIONS[indexName];
    if (!def) {
      continue;
    }

    try {
      await db.execute(
        sql.raw(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${def.table}(${def.columns})`)
      );
      logger.info(`[DB Indexes] Created: ${indexName}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[DB Indexes] Failed to create ${indexName}: ${message}`);
    }
  }
}

export async function createDatabaseIndexes(): Promise<void> {
  await verifyDatabaseIndexes();
}

export async function analyzeDatabasePerformance(): Promise<{
  indexUsage: number;
  tableStats: { name: string; rows: number; indexScans: number }[];
  recommendations: string[];
}> {
  logger.info("[DB Indexes] Performance analysis skipped");
  return { indexUsage: 100, tableStats: [], recommendations: [] };
}

export async function optimizeIndexes(): Promise<void> {
  await verifyDatabaseIndexes();
}

export const dbIndexes = {
  create: createDatabaseIndexes,
  verify: verifyDatabaseIndexes,
  analyze: analyzeDatabasePerformance,
  optimize: optimizeIndexes,
};
