import Database from 'better-sqlite3';
import { CursorStore } from './cursorStore';
import { SqliteRawFrameSource } from './sqliteRawFrameSource';
import { BridgeProcessor } from './bridgeProcessor';
import { loadBridgeConfig, type BridgeConfig } from './config';
import { telemetryBatchWriter, type TelemetryReading } from '../../telemetry-batch-writer';
import { logger } from '../../utils/logger';
import client from 'prom-client';
import { CircuitBreaker } from '../circuit-breaker/circuitBreaker';
import { DeadLetterQueue } from '../dead-letter-queue';
import { circuitBreakerHealthCollector } from '../telemetry-health';

const bridgeBatchCommitted = new client.Counter({
  name: 'arus_bridge_batch_committed_total',
  help: 'Total readings committed by bridge',
});

const bridgeFramesProcessed = new client.Counter({
  name: 'arus_bridge_frames_processed_total',
  help: 'Total raw frames fetched from SQLite',
});

const bridgeReadingsDecoded = new client.Counter({
  name: 'arus_bridge_readings_decoded_total',
  help: 'Total readings decoded from frames',
});

const bridgeBacklogGauge = new client.Gauge({
  name: 'arus_bridge_backlog_frames',
  help: 'Current backlog of frames waiting to be processed',
});

const bridgeLastSuccessGauge = new client.Gauge({
  name: 'arus_bridge_last_success_unix_ms',
  help: 'Unix timestamp of last successful commit',
});

const bridgeCommitLatencyHistogram = new client.Histogram({
  name: 'arus_bridge_commit_latency_ms',
  help: 'PostgreSQL commit latency in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

const bridgeEndToEndLagHistogram = new client.Histogram({
  name: 'arus_bridge_e2e_lag_ms',
  help: 'End-to-end lag from frame creation to PG commit in milliseconds',
  buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
});

const bridgeBackoffGauge = new client.Gauge({
  name: 'arus_bridge_backoff_ms',
  help: 'Current retry backoff in milliseconds',
});

const bridgeFramesPerSecondGauge = new client.Gauge({
  name: 'arus_bridge_frames_per_second',
  help: 'Current frames processed per second (rolling average)',
});

const bridgeDecodedPerSecondGauge = new client.Gauge({
  name: 'arus_bridge_decoded_per_second',
  help: 'Current readings decoded per second (rolling average)',
});

const bridgeBackoffDurationHistogram = new client.Histogram({
  name: 'arus_bridge_backoff_duration_ms',
  help: 'Duration of backoff delays applied during PG failures',
  buckets: [500, 1000, 2000, 4000, 8000, 16000, 30000],
});

const bridgeRetriesTotalCounter = new client.Counter({
  name: 'arus_bridge_retries_total',
  help: 'Total retry attempts for PG write failures',
});

let bridgeState = {
  lastSuccessAt: 0,
  cursorLastId: 0,
  lagFrames: 0,
  retryBackoffMs: 2000,
  pgOffline: false,
  isRunning: false,
};

const bridgeCircuitBreaker = new CircuitBreaker({
  name: 'sqlite-bridge-pg',
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
});

circuitBreakerHealthCollector.registerCircuitBreaker('sqlite-bridge-pg', bridgeCircuitBreaker);

interface BridgeDLQPayload {
  readings: TelemetryReading[];
  frameIds: number[];
  source: string;
}

const bridgeDeadLetterQueue = new DeadLetterQueue<BridgeDLQPayload>({
  name: 'sqlite-bridge',
  maxEntries: 5000,
  retentionDays: 7,
});

export function getBridgeCircuitBreaker(): CircuitBreaker {
  return bridgeCircuitBreaker;
}

export function getBridgeDeadLetterQueue(): DeadLetterQueue<BridgeDLQPayload> {
  return bridgeDeadLetterQueue;
}

bridgeDeadLetterQueue.setReplayHandler(async (entry) => {
  if (bridgeCircuitBreaker.isOpen()) {
    throw new Error('Circuit breaker still open - cannot replay');
  }
  
  await bridgeCircuitBreaker.execute(async () => {
    await telemetryBatchWriter.writeBatch(entry.payload.readings, { source: 'sqlite-bridge-dlq-replay' });
  });
  
  logger.info('SqliteBridge', 'DLQ entry replayed successfully', {
    entryId: entry.id,
    readingsCount: entry.payload.readings.length,
  });
});

export function getBridgeState() {
  return { ...bridgeState };
}

export function setBridgeState(updates: Partial<typeof bridgeState>) {
  bridgeState = { ...bridgeState, ...updates };
}

export function resetBridgeState() {
  bridgeState = {
    lastSuccessAt: 0,
    cursorLastId: 0,
    lagFrames: 0,
    retryBackoffMs: 2000, // Base backoff value
    pgOffline: false,
    isRunning: false,
  };
}

export function calculateBackoff(retryCount: number): number {
  const baseMs = 2000;
  const maxMs = 30000;
  return Math.min(baseMs * Math.pow(2, retryCount - 1), maxMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runSqliteBridge(config: BridgeConfig): Promise<void> {
  const db = new Database(config.sqlitePath, { readonly: false });
  
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  const cursor = new CursorStore(db);
  const source = new SqliteRawFrameSource(db);
  const processor = new BridgeProcessor({
    defaultEquipmentId: 'e2e-test-engine',
    defaultOrgId: 'default-org-id',
  });

  let backoffMs = 2000;
  const maxBackoffMs = 30000;

  let rateWindowStart = Date.now();
  let framesInWindow = 0;
  let decodedInWindow = 0;
  const rateWindowMs = 5000;

  bridgeState.isRunning = true;
  bridgeBackoffGauge.set(backoffMs);
  logger.info('SqliteBridge', 'Started', { sqlitePath: config.sqlitePath });

  while (bridgeState.isRunning) {
    try {
      const queueDepth = telemetryBatchWriter.getBufferSize();
      if (queueDepth > config.maxQueueDepth) {
        logger.debug('SqliteBridge', 'Backpressure - waiting', { queueDepth, max: config.maxQueueDepth });
        await sleep(100);
        continue;
      }

      const cursorState = cursor.getCursor();
      bridgeState.cursorLastId = cursorState.lastId;

      const frames = source.fetchBatch(cursorState.lastId, config.batchSize);
      bridgeState.lagFrames = source.getLagFrames(cursorState.lastId);
      bridgeBacklogGauge.set(bridgeState.lagFrames);

      if (frames.length === 0) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      bridgeFramesProcessed.inc(frames.length);
      framesInWindow += frames.length;

      const readings = processor.process(frames);
      bridgeReadingsDecoded.inc(readings.length);
      decodedInWindow += readings.length;

      const now = Date.now();
      if (now - rateWindowStart >= rateWindowMs) {
        const elapsedSec = (now - rateWindowStart) / 1000;
        bridgeFramesPerSecondGauge.set(framesInWindow / elapsedSec);
        bridgeDecodedPerSecondGauge.set(decodedInWindow / elapsedSec);
        rateWindowStart = now;
        framesInWindow = 0;
        decodedInWindow = 0;
      }

      if (readings.length > 0) {
        const oldestFrameTs = frames[0].ts;
        const commitStart = Date.now();
        const frameIds = frames.map(f => f.id);
        
        if (bridgeCircuitBreaker.isOpen()) {
          logger.warn('SqliteBridge', 'Circuit breaker OPEN, sending to DLQ', {
            readingsCount: readings.length,
            framesCount: frames.length,
          });
          bridgeDeadLetterQueue.add(
            { readings, frameIds, source: 'sqlite-bridge' },
            'Circuit breaker open - PostgreSQL unavailable',
            'sqlite-bridge'
          );
          const maxId = frames[frames.length - 1].id;
          const maxTs = frames[frames.length - 1].ts;
          cursor.setCursor(maxId, maxTs);
          await sleep(backoffMs);
          continue;
        }
        
        try {
          await bridgeCircuitBreaker.execute(async () => {
            await telemetryBatchWriter.writeBatch(readings, { source: 'sqlite-bridge' });
          });
          
          const commitEnd = Date.now();
          const commitLatency = commitEnd - commitStart;
          bridgeCommitLatencyHistogram.observe(commitLatency);
          
          let oldestTs: number;
          if (typeof oldestFrameTs === 'number') {
            oldestTs = oldestFrameTs;
          } else if (oldestFrameTs instanceof Date) {
            oldestTs = oldestFrameTs.getTime();
          } else if (typeof oldestFrameTs === 'string') {
            oldestTs = Date.parse(oldestFrameTs);
          } else {
            oldestTs = commitEnd;
          }
          const e2eLag = isNaN(oldestTs) ? 0 : commitEnd - oldestTs;
          bridgeEndToEndLagHistogram.observe(e2eLag);
          
          bridgeBatchCommitted.inc(readings.length);
          bridgeState.lastSuccessAt = Date.now();
          bridgeState.pgOffline = false;
          bridgeLastSuccessGauge.set(bridgeState.lastSuccessAt);
          
          backoffMs = 2000;
          bridgeState.retryBackoffMs = backoffMs;
          bridgeBackoffGauge.set(backoffMs);
        } catch (err) {
          bridgeState.pgOffline = true;
          bridgeState.retryBackoffMs = backoffMs;
          bridgeBackoffGauge.set(backoffMs);
          bridgeBackoffDurationHistogram.observe(backoffMs);
          bridgeRetriesTotalCounter.inc();
          
          const errorMsg = err instanceof Error ? err.message : String(err);
          
          if (bridgeCircuitBreaker.isOpen()) {
            logger.warn('SqliteBridge', 'Circuit breaker tripped, sending batch to DLQ', {
              error: errorMsg,
              readingsCount: readings.length,
            });
            bridgeDeadLetterQueue.add(
              { readings, frameIds, source: 'sqlite-bridge' },
              errorMsg,
              'sqlite-bridge'
            );
            const maxId = frames[frames.length - 1].id;
            const maxTs = frames[frames.length - 1].ts;
            cursor.setCursor(maxId, maxTs);
          } else {
            logger.warn('SqliteBridge', 'Postgres write failed, will retry', { 
              error: err,
              backoffMs,
              framesCount: frames.length,
            });
          }
          
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
          continue;
        }
      }

      const maxId = frames[frames.length - 1].id;
      const maxTs = frames[frames.length - 1].ts;
      cursor.setCursor(maxId, maxTs);

    } catch (err) {
      logger.error('SqliteBridge', 'Unexpected error in bridge loop', { error: err });
      await sleep(2000);
    }
  }

  db.close();
  logger.info('SqliteBridge', 'Stopped');
}

export function stopBridge(): void {
  bridgeState.isRunning = false;
}

export { loadBridgeConfig, loadBridgeConfigSafe } from './config';
export { CursorStore } from './cursorStore';
export { SqliteRawFrameSource } from './sqliteRawFrameSource';
export { BridgeProcessor } from './bridgeProcessor';
