import client from 'prom-client';
import type { IMetricsEmitter } from '../ports/outbound';

const bridgeFramesRead = new client.Counter({
  name: 'arus_telemetry_frames_read_total',
  help: 'Total raw frames read from source',
  labelNames: ['stage'],
});

const bridgeReadingsDecoded = new client.Counter({
  name: 'arus_telemetry_readings_decoded_total',
  help: 'Total readings decoded from frames',
});

const bridgeValidationFailed = new client.Counter({
  name: 'arus_telemetry_validation_failed_total',
  help: 'Total readings that failed validation',
});

const bridgeBatchCommitted = new client.Counter({
  name: 'arus_telemetry_batch_committed_total',
  help: 'Total readings committed to database',
});

const bridgeCommitLatency = new client.Histogram({
  name: 'arus_telemetry_commit_latency_ms',
  help: 'Database commit latency in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

const bridgeEndToEndLag = new client.Histogram({
  name: 'arus_telemetry_e2e_lag_ms',
  help: 'End-to-end lag from frame creation to commit in milliseconds',
  buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
});

const bridgeBacklog = new client.Gauge({
  name: 'arus_telemetry_backlog_frames',
  help: 'Current backlog of frames waiting to be processed',
});

const bridgeBackoff = new client.Gauge({
  name: 'arus_telemetry_backoff_ms',
  help: 'Current retry backoff in milliseconds',
});

const bridgeRetries = new client.Counter({
  name: 'arus_telemetry_retries_total',
  help: 'Total retry attempts for database write failures',
});

const bridgeDLQAdded = new client.Counter({
  name: 'arus_telemetry_dlq_added_total',
  help: 'Total entries added to dead letter queue',
  labelNames: ['source'],
});

export class PrometheusMetricsAdapter implements IMetricsEmitter {
  incFramesRead(count: number): void {
    bridgeFramesRead.inc({ stage: 'read' }, count);
  }

  incReadingsDecoded(count: number): void {
    bridgeReadingsDecoded.inc(count);
  }

  incValidationFailed(count: number): void {
    bridgeValidationFailed.inc(count);
  }

  incBatchCommitted(count: number): void {
    bridgeBatchCommitted.inc(count);
  }

  observeCommitLatency(ms: number): void {
    bridgeCommitLatency.observe(ms);
  }

  observeEndToEndLag(ms: number): void {
    bridgeEndToEndLag.observe(ms);
  }

  setBacklog(count: number): void {
    bridgeBacklog.set(count);
  }

  setBackoff(ms: number): void {
    bridgeBackoff.set(ms);
  }

  incRetries(): void {
    bridgeRetries.inc();
  }

  incDLQAdded(source: string): void {
    bridgeDLQAdded.inc({ source });
  }
}

export const defaultMetricsEmitter = new PrometheusMetricsAdapter();
