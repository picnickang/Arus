import type { Express, Response } from "express";
import { logger } from "../../utils/logger.js";
import { withErrorHandling } from "../../lib/route-utils";
import { enforceQuota } from "../../middleware/tenant-quota";

// Phase A: HTTP ingestion is completely disabled to enforce single-path architecture
// (Hardware → C# Agent → SQLite → Node.js Bridge → PostgreSQL)
// Phase C will implement proper synchronous HTTP ingestion with writeBatch() integration
// See: server/services/sqlite-bridge/ for the only production ingestion path

export function registerTelemetryIngestionRoutes(
  app: Express,
  _deps: {
    writeOperationRateLimit: unknown;
    criticalOperationRateLimit: unknown;
    generalApiRateLimit: unknown;
    telemetryRateLimit: unknown;
    requireValidOrgId?: (options?: { verifyEquipmentId?: boolean }) => unknown;
    validateHMAC?: unknown;
  }
) {
  // Phase A: HTTP ingestion endpoints are placeholders that return 503
  // All telemetry must flow through: Hardware → C# Agent → SQLite → Node.js Bridge → PostgreSQL
  const phaseADisabledHandler = withErrorHandling(
    "telemetry ingestion",
    async (_req: unknown, res: Response) => {
      return res.status(503).json({
        message:
          "HTTP telemetry ingestion disabled during Phase A E2E Verification. Use the hardware ingestion path: C# Agent → SQLite → Node.js Bridge → PostgreSQL.",
        code: "PHASE_A_HTTP_DISABLED",
        phase: "A",
        nextPhase: "C",
        singlePathArchitecture: {
          enforced: true,
          path: "Hardware → C# Agent → SQLite (WAL mode) → Node.js Bridge → PostgreSQL",
          documentation:
            "HTTP ingestion will be re-enabled in Phase C with proper synchronous writeBatch() integration.",
        },
      });
    }
  );

  // Task #89: even though these handlers are 503-gated in Phase A,
  // wire enforceQuota("telemetry_rows_today") in front of them now so
  // when Phase C re-enables synchronous HTTP ingestion the quota
  // protection lands automatically with the route. The middleware is a
  // no-op for the disabled handler (the 503 ships before any rows are
  // written), but the contract is documented at the route definition.
  app.post(
    "/api/telemetry/readings",
    enforceQuota("telemetry_rows_today"),
    phaseADisabledHandler,
  );
  app.post(
    "/api/telemetry/bulk",
    enforceQuota("telemetry_rows_today"),
    phaseADisabledHandler,
  );

  logger.info(
    "TelemetryIngestion",
    "Routes registered (Phase A: HTTP disabled, sqlite-bridge only)"
  );
}
