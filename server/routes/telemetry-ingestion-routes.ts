import { Router } from "express";
import { logger } from "../utils/logger";
import { withErrorHandling } from "../lib/route-utils";
import { rawTelemetryArchiveAdapter } from "../telemetry/adapters/raw-archive";
import { equipmentHeartbeatAdapter } from "../telemetry/adapters/equipment-heartbeat";
import { telemetryBatchAckAdapter } from "../telemetry/adapters/batch-ack";
import { schemaRegistryAdapter } from "../telemetry/adapters/schema-registry";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export const telemetryIngestionRouter = Router();

telemetryIngestionRouter.get(
  "/archive/status",
  withErrorHandling("get archive status", async (_req, res) => {
    const metrics = await rawTelemetryArchiveAdapter.getMetrics();
    return res.json(metrics);
  })
);

telemetryIngestionRouter.get(
  "/archive/pending",
  withErrorHandling("get pending archives", async (req, res) => {
    const limit = Number(req.query["limit"]) || 100;
    const archives = await rawTelemetryArchiveAdapter.getPendingArchives(limit);
    return res.json({ archives, count: archives.length });
  })
);

telemetryIngestionRouter.get(
  "/archive/failed",
  withErrorHandling("get failed archives", async (req, res) => {
    const limit = Number(req.query["limit"]) || 100;
    const archives = await rawTelemetryArchiveAdapter.getFailedArchives(limit);
    return res.json({ archives, count: archives.length });
  })
);

telemetryIngestionRouter.post(
  "/archive/:id/retry",
  withErrorHandling("retry archive", async (req, res) => {
    await rawTelemetryArchiveAdapter.retryFailed(req.params["id"] ?? "");
    return res.json({ success: true, archiveId: req.params["id"] ?? "" });
  })
);

telemetryIngestionRouter.post(
  "/archive/prune",
  withErrorHandling("prune archives", async (req, res) => {
    const retentionDays = Number(req.query["retentionDays"]) || 30;
    const removed = await rawTelemetryArchiveAdapter.pruneOldArchives(retentionDays);
    return res.json({ success: true, removed });
  })
);

telemetryIngestionRouter.get(
  "/heartbeat/status",
  withErrorHandling("get heartbeat status", async (req, res) => {
    const orgId = DEFAULT_ORG_ID;
    const metrics = await equipmentHeartbeatAdapter.getMetricsByOrg(orgId);
    return res.json(metrics);
  })
);

telemetryIngestionRouter.get(
  "/heartbeat/online",
  withErrorHandling("get online equipment", async (req, res) => {
    const orgId = DEFAULT_ORG_ID;
    const thresholdMs = req.query["thresholdMs"] ? Number(req.query["thresholdMs"]) : undefined;
    const equipment = await equipmentHeartbeatAdapter.getOnlineEquipment(orgId, thresholdMs);
    return res.json({ equipment, count: equipment.length });
  })
);

telemetryIngestionRouter.get(
  "/heartbeat/offline",
  withErrorHandling("get offline equipment", async (req, res) => {
    const orgId = DEFAULT_ORG_ID;
    const thresholdMs = req.query["thresholdMs"] ? Number(req.query["thresholdMs"]) : undefined;
    const equipment = await equipmentHeartbeatAdapter.getOfflineEquipment(orgId, thresholdMs);
    return res.json({ equipment, count: equipment.length });
  })
);

telemetryIngestionRouter.get(
  "/heartbeat/:equipmentId",
  withErrorHandling("get equipment heartbeat", async (req, res) => {
    const heartbeat = await equipmentHeartbeatAdapter.getHeartbeat(req.params["equipmentId"] ?? "");
    if (!heartbeat) {
      return res.status(404).json({ message: "Equipment heartbeat not found" });
    }
    return res.json(heartbeat);
  })
);

telemetryIngestionRouter.post(
  "/heartbeat/update-status",
  withErrorHandling("update online status", async (_req, res) => {
    const result = await equipmentHeartbeatAdapter.updateOnlineStatus();
    return res.json({ success: true, ...result });
  })
);

telemetryIngestionRouter.get(
  "/batch/status",
  withErrorHandling("get batch status", async (req, res) => {
    const orgId = DEFAULT_ORG_ID;
    const metrics = await telemetryBatchAckAdapter.getMetrics(orgId);
    return res.json(metrics);
  })
);

telemetryIngestionRouter.get(
  "/batch/recent",
  withErrorHandling("get recent batches", async (req, res) => {
    const orgId = DEFAULT_ORG_ID;
    const limit = Number(req.query["limit"]) || 100;
    const deviceId = req.query["deviceId"] as string | undefined;
    const source = req.query["source"] as string | undefined;
    const batches = await telemetryBatchAckAdapter.getRecentBatches(orgId, {
      limit,
      deviceId,
      source,
    });
    return res.json({ batches, count: batches.length });
  })
);

telemetryIngestionRouter.get(
  "/batch/unacknowledged",
  withErrorHandling("get unacknowledged batches", async (req, res) => {
    const orgId = DEFAULT_ORG_ID;
    const limit = Number(req.query["limit"]) || 100;
    const batches = await telemetryBatchAckAdapter.getUnacknowledgedBatches(orgId, limit);
    return res.json({ batches, count: batches.length });
  })
);

telemetryIngestionRouter.get(
  "/batch/failed",
  withErrorHandling("get failed batches", async (req, res) => {
    const orgId = DEFAULT_ORG_ID;
    const limit = Number(req.query["limit"]) || 100;
    const batches = await telemetryBatchAckAdapter.getFailedBatches(orgId, limit);
    return res.json({ batches, count: batches.length });
  })
);

telemetryIngestionRouter.get(
  "/batch/:batchId",
  withErrorHandling("get batch", async (req, res) => {
    const batch = await telemetryBatchAckAdapter.getBatch(req.params["batchId"] ?? "");
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    return res.json(batch);
  })
);

telemetryIngestionRouter.post(
  "/batch/:batchId/retry",
  withErrorHandling("retry batch", async (req, res) => {
    await telemetryBatchAckAdapter.retryBatch(req.params["batchId"] ?? "");
    return res.json({ success: true, batchId: req.params["batchId"] ?? "" });
  })
);

telemetryIngestionRouter.post(
  "/batch/prune",
  withErrorHandling("prune batches", async (req, res) => {
    const retentionDays = Number(req.query["retentionDays"]) || 7;
    const removed = await telemetryBatchAckAdapter.pruneOldBatches(retentionDays);
    return res.json({ success: true, removed });
  })
);

telemetryIngestionRouter.get(
  "/schema",
  withErrorHandling("list schemas", async (req, res) => {
    const protocol = req.query["protocol"] as string | undefined;
    const schemas = await schemaRegistryAdapter.listSchemas(protocol);
    return res.json({ schemas, count: schemas.length });
  })
);

telemetryIngestionRouter.get(
  "/schema/:protocol",
  withErrorHandling("get schema", async (req, res) => {
    const version = req.query["version"] ? Number(req.query["version"]) : undefined;
    const schema = version
      ? await schemaRegistryAdapter.getSchema(req.params["protocol"] ?? "", version)
      : await schemaRegistryAdapter.getActiveSchema(req.params["protocol"] ?? "");
    if (!schema) {
      return res.status(404).json({ message: "Schema not found" });
    }
    return res.json(schema);
  })
);

telemetryIngestionRouter.post(
  "/schema",
  withErrorHandling("register schema", async (req, res) => {
    const schema = await schemaRegistryAdapter.registerSchema(req.body);
    return res.status(201).json(schema);
  })
);

telemetryIngestionRouter.post(
  "/schema/:protocol/:version/deprecate",
  withErrorHandling("deprecate schema", async (req, res) => {
    await schemaRegistryAdapter.deprecateSchema(
      req.params["protocol"] ?? "",
      Number(req.params["version"] ?? "")
    );
    return res.json({ success: true });
  })
);

telemetryIngestionRouter.post(
  "/schema/:protocol/:version/activate",
  withErrorHandling("activate schema", async (req, res) => {
    await schemaRegistryAdapter.activateSchema(
      req.params["protocol"] ?? "",
      Number(req.params["version"] ?? "")
    );
    return res.json({ success: true });
  })
);

telemetryIngestionRouter.post(
  "/schema/validate",
  withErrorHandling("validate payload", async (req, res) => {
    const { protocol, version, payload } = req.body;
    const result = await schemaRegistryAdapter.validatePayload(protocol, version, payload);
    return res.json(result);
  })
);

telemetryIngestionRouter.post(
  "/schema/seed-defaults",
  withErrorHandling("seed default schemas", async (_req, res) => {
    await schemaRegistryAdapter.seedDefaultSchemas();
    return res.json({ success: true, message: "Default schemas seeded" });
  })
);

logger.info("TelemetryIngestionRoutes", "Registered: archive, heartbeat, batch, schema endpoints");
