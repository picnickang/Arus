import { Router, Request, Response } from 'express';
import { readHeartbeat, isAgentAlive, getHeartbeatAge } from '../services/agent-heartbeat';
import { getBridgeState } from '../services/sqlite-bridge';
import { isIngestionRunning } from '../ingestion/startIngestion';
import { telemetryBatchWriter } from '../telemetry-batch-writer';

const router = Router();

const HEARTBEAT_PATH = process.env.ARUS_HEARTBEAT_PATH || '/tmp/arus-agent-heartbeat.json';

router.get('/agent/status', (_req: Request, res: Response) => {
  try {
    const heartbeat = readHeartbeat(HEARTBEAT_PATH);
    const alive = isAgentAlive(heartbeat);
    const age = getHeartbeatAge(heartbeat);

    res.json({
      status: alive ? 'online' : 'offline',
      heartbeat: heartbeat || null,
      ageMs: age,
      maxAgeMs: 5000,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read agent status' });
  }
});

router.get('/bridge/status', (_req: Request, res: Response) => {
  try {
    const bridgeState = getBridgeState();
    const writerStats = telemetryBatchWriter.getStats();
    const isRunning = isIngestionRunning();

    res.json({
      bridge: {
        isRunning: bridgeState.isRunning,
        lastSuccessAt: bridgeState.lastSuccessAt,
        cursorLastId: bridgeState.cursorLastId,
        lagFrames: bridgeState.lagFrames,
        retryBackoffMs: bridgeState.retryBackoffMs,
        pgOffline: bridgeState.pgOffline,
      },
      writer: {
        bufferSize: writerStats.bufferSize,
        totalFlushed: writerStats.totalFlushed,
        totalEvicted: writerStats.totalEvicted,
        totalErrors: writerStats.totalErrors,
        lastFlushTime: writerStats.lastFlushTime,
        isRunning: writerStats.isRunning,
      },
      ingestion: {
        isRunning,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read bridge status' });
  }
});

router.get('/ingestion/verify', (_req: Request, res: Response) => {
  try {
    const heartbeat = readHeartbeat(HEARTBEAT_PATH);
    const agentAlive = isAgentAlive(heartbeat);
    const bridgeState = getBridgeState();
    const writerStats = telemetryBatchWriter.getStats();
    const writerActive = telemetryBatchWriter.isActive();

    // Thresholds for health checks
    const MAX_LAG_FRAMES = 1000;
    const MAX_COMMIT_AGE_MS = 60000; // 1 minute
    const MAX_BACKOFF_MS = 30000;

    // Calculate derived metrics
    const lagFrames = bridgeState.lagFrames ?? 0;
    const lastCommitAt = writerStats.lastFlushTime;
    const commitAgeMs = lastCommitAt ? Date.now() - new Date(lastCommitAt).getTime() : null;
    const backoffMs = bridgeState.retryBackoffMs ?? 0;
    
    // Check thresholds
    const lagOk = lagFrames < MAX_LAG_FRAMES;
    const commitRecent = commitAgeMs === null || commitAgeMs < MAX_COMMIT_AGE_MS;
    const backoffOk = backoffMs < MAX_BACKOFF_MS;

    // Pipeline healthy = all checks pass
    const pipelineHealthy = 
      agentAlive && 
      bridgeState.isRunning && 
      !bridgeState.pgOffline && 
      writerActive && 
      lagOk && 
      commitRecent && 
      backoffOk;

    res.json({
      pipelineHealthy,
      checks: {
        agentAlive,
        bridgeRunning: bridgeState.isRunning,
        pgOnline: !bridgeState.pgOffline,
        writerActive,
        lagOk,
        commitRecent,
        backoffOk,
      },
      metrics: {
        rawFramesRecentCount: heartbeat?.framesWritten ?? 0,
        bridgeLagFrames: lagFrames,
        cursorLastId: bridgeState.cursorLastId ?? 0,
        postgresLastCommitAt: lastCommitAt,
        postgresCommitAgeMs: commitAgeMs,
        backoffMs,
        totalFlushed: writerStats.totalFlushed,
        totalErrors: writerStats.totalErrors,
      },
      thresholds: {
        maxLagFrames: MAX_LAG_FRAMES,
        maxCommitAgeMs: MAX_COMMIT_AGE_MS,
        maxBackoffMs: MAX_BACKOFF_MS,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify ingestion', pipelineHealthy: false });
  }
});

export default router;
