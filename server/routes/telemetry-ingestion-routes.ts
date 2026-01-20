import { Router } from 'express';
import { logger } from '../utils/logger';
import { rawTelemetryArchiveAdapter } from '../telemetry/adapters/raw-archive';
import { equipmentHeartbeatAdapter } from '../telemetry/adapters/equipment-heartbeat';
import { telemetryBatchAckAdapter } from '../telemetry/adapters/batch-ack';
import { schemaRegistryAdapter } from '../telemetry/adapters/schema-registry';
import { DEFAULT_ORG_ID } from '@shared/config/tenant';

export const telemetryIngestionRouter = Router();

telemetryIngestionRouter.get('/archive/status', async (_req, res) => {
  try {
    const metrics = await rawTelemetryArchiveAdapter.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get archive status', { error });
    res.status(500).json({ error: 'Failed to get archive status' });
  }
});

telemetryIngestionRouter.get('/archive/pending', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const archives = await rawTelemetryArchiveAdapter.getPendingArchives(limit);
    res.json({ archives, count: archives.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get pending archives', { error });
    res.status(500).json({ error: 'Failed to get pending archives' });
  }
});

telemetryIngestionRouter.get('/archive/failed', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const archives = await rawTelemetryArchiveAdapter.getFailedArchives(limit);
    res.json({ archives, count: archives.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get failed archives', { error });
    res.status(500).json({ error: 'Failed to get failed archives' });
  }
});

telemetryIngestionRouter.post('/archive/:id/retry', async (req, res) => {
  try {
    await rawTelemetryArchiveAdapter.retryFailed(req.params.id);
    res.json({ success: true, archiveId: req.params.id });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to retry archive', { error });
    res.status(500).json({ error: 'Failed to retry archive' });
  }
});

telemetryIngestionRouter.post('/archive/prune', async (req, res) => {
  try {
    const retentionDays = Number(req.query.retentionDays) || 30;
    const removed = await rawTelemetryArchiveAdapter.pruneOldArchives(retentionDays);
    res.json({ success: true, removed });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to prune archives', { error });
    res.status(500).json({ error: 'Failed to prune archives' });
  }
});

telemetryIngestionRouter.get('/heartbeat/status', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const metrics = await equipmentHeartbeatAdapter.getMetricsByOrg(orgId);
    res.json(metrics);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get heartbeat status', { error });
    res.status(500).json({ error: 'Failed to get heartbeat status' });
  }
});

telemetryIngestionRouter.get('/heartbeat/online', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const thresholdMs = req.query.thresholdMs ? Number(req.query.thresholdMs) : undefined;
    const equipment = await equipmentHeartbeatAdapter.getOnlineEquipment(orgId, thresholdMs);
    res.json({ equipment, count: equipment.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get online equipment', { error });
    res.status(500).json({ error: 'Failed to get online equipment' });
  }
});

telemetryIngestionRouter.get('/heartbeat/offline', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const thresholdMs = req.query.thresholdMs ? Number(req.query.thresholdMs) : undefined;
    const equipment = await equipmentHeartbeatAdapter.getOfflineEquipment(orgId, thresholdMs);
    res.json({ equipment, count: equipment.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get offline equipment', { error });
    res.status(500).json({ error: 'Failed to get offline equipment' });
  }
});

telemetryIngestionRouter.get('/heartbeat/:equipmentId', async (req, res) => {
  try {
    const heartbeat = await equipmentHeartbeatAdapter.getHeartbeat(req.params.equipmentId);
    if (!heartbeat) {
      return res.status(404).json({ error: 'Equipment heartbeat not found' });
    }
    res.json(heartbeat);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get equipment heartbeat', { error });
    res.status(500).json({ error: 'Failed to get equipment heartbeat' });
  }
});

telemetryIngestionRouter.post('/heartbeat/update-status', async (_req, res) => {
  try {
    const result = await equipmentHeartbeatAdapter.updateOnlineStatus();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to update online status', { error });
    res.status(500).json({ error: 'Failed to update online status' });
  }
});

telemetryIngestionRouter.get('/batch/status', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const metrics = await telemetryBatchAckAdapter.getMetrics(orgId);
    res.json(metrics);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get batch status', { error });
    res.status(500).json({ error: 'Failed to get batch status' });
  }
});

telemetryIngestionRouter.get('/batch/recent', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const limit = Number(req.query.limit) || 100;
    const deviceId = req.query.deviceId as string | undefined;
    const source = req.query.source as string | undefined;
    
    const batches = await telemetryBatchAckAdapter.getRecentBatches(orgId, { limit, deviceId, source });
    res.json({ batches, count: batches.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get recent batches', { error });
    res.status(500).json({ error: 'Failed to get recent batches' });
  }
});

telemetryIngestionRouter.get('/batch/unacknowledged', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const limit = Number(req.query.limit) || 100;
    
    const batches = await telemetryBatchAckAdapter.getUnacknowledgedBatches(orgId, limit);
    res.json({ batches, count: batches.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get unacknowledged batches', { error });
    res.status(500).json({ error: 'Failed to get unacknowledged batches' });
  }
});

telemetryIngestionRouter.get('/batch/failed', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const limit = Number(req.query.limit) || 100;
    
    const batches = await telemetryBatchAckAdapter.getFailedBatches(orgId, limit);
    res.json({ batches, count: batches.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get failed batches', { error });
    res.status(500).json({ error: 'Failed to get failed batches' });
  }
});

telemetryIngestionRouter.get('/batch/:batchId', async (req, res) => {
  try {
    const batch = await telemetryBatchAckAdapter.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get batch', { error });
    res.status(500).json({ error: 'Failed to get batch' });
  }
});

telemetryIngestionRouter.post('/batch/:batchId/retry', async (req, res) => {
  try {
    await telemetryBatchAckAdapter.retryBatch(req.params.batchId);
    res.json({ success: true, batchId: req.params.batchId });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to retry batch', { error });
    res.status(500).json({ error: 'Failed to retry batch' });
  }
});

telemetryIngestionRouter.post('/batch/prune', async (req, res) => {
  try {
    const retentionDays = Number(req.query.retentionDays) || 7;
    const removed = await telemetryBatchAckAdapter.pruneOldBatches(retentionDays);
    res.json({ success: true, removed });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to prune batches', { error });
    res.status(500).json({ error: 'Failed to prune batches' });
  }
});

telemetryIngestionRouter.get('/schema', async (req, res) => {
  try {
    const protocol = req.query.protocol as string | undefined;
    const schemas = await schemaRegistryAdapter.listSchemas(protocol);
    res.json({ schemas, count: schemas.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to list schemas', { error });
    res.status(500).json({ error: 'Failed to list schemas' });
  }
});

telemetryIngestionRouter.get('/schema/:protocol', async (req, res) => {
  try {
    const version = req.query.version ? Number(req.query.version) : undefined;
    const schema = version 
      ? await schemaRegistryAdapter.getSchema(req.params.protocol, version)
      : await schemaRegistryAdapter.getActiveSchema(req.params.protocol);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    res.json(schema);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get schema', { error });
    res.status(500).json({ error: 'Failed to get schema' });
  }
});

telemetryIngestionRouter.post('/schema', async (req, res) => {
  try {
    const schema = await schemaRegistryAdapter.registerSchema(req.body);
    res.status(201).json(schema);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to register schema', { error });
    const message = error instanceof Error ? error.message : 'Failed to register schema';
    res.status(400).json({ error: message });
  }
});

telemetryIngestionRouter.post('/schema/:protocol/:version/deprecate', async (req, res) => {
  try {
    await schemaRegistryAdapter.deprecateSchema(req.params.protocol, Number(req.params.version));
    res.json({ success: true });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to deprecate schema', { error });
    res.status(500).json({ error: 'Failed to deprecate schema' });
  }
});

telemetryIngestionRouter.post('/schema/:protocol/:version/activate', async (req, res) => {
  try {
    await schemaRegistryAdapter.activateSchema(req.params.protocol, Number(req.params.version));
    res.json({ success: true });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to activate schema', { error });
    res.status(500).json({ error: 'Failed to activate schema' });
  }
});

telemetryIngestionRouter.post('/schema/validate', async (req, res) => {
  try {
    const { protocol, version, payload } = req.body;
    const result = await schemaRegistryAdapter.validatePayload(protocol, version, payload);
    res.json(result);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to validate payload', { error });
    res.status(500).json({ error: 'Failed to validate payload' });
  }
});

telemetryIngestionRouter.post('/schema/seed-defaults', async (_req, res) => {
  try {
    await schemaRegistryAdapter.seedDefaultSchemas();
    res.json({ success: true, message: 'Default schemas seeded' });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to seed default schemas', { error });
    res.status(500).json({ error: 'Failed to seed default schemas' });
  }
});

console.log('[TelemetryIngestionRoutes] Registered: archive, heartbeat, batch, schema endpoints');
