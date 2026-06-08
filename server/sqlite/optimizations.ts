import type { createClient } from "@libsql/client";
import type { createLogger } from "../lib/structured-logger";

type LibsqlClient = ReturnType<typeof createClient>;
type StructuredLogger = ReturnType<typeof createLogger>;

export async function applySqlitePerformanceOptimizations(
  client: LibsqlClient,
  logger: StructuredLogger
): Promise<void> {
  logger.info("→ Applying SQLite performance optimizations...");
  try {
    await client.execute("PRAGMA journal_mode=WAL");
    await client.execute("PRAGMA synchronous=NORMAL");
    await client.execute("PRAGMA cache_size=-64000");
    await client.execute("PRAGMA temp_store=MEMORY");
    await client.execute("PRAGMA page_size=4096");
    await client.execute("PRAGMA foreign_keys=ON");
    await client.execute("PRAGMA busy_timeout=5000");

    logger.info("✓ SQLite performance optimizations applied");
    logger.info("  • WAL mode enabled (better concurrency)");
    logger.info("  • Cache: 64MB");
    logger.info("  • Sync: NORMAL (safe with WAL)");
    logger.info("  • Foreign keys: ON");
  } catch (error) {
    logger.warn("⚠ Failed to apply some SQLite optimizations:", {
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
