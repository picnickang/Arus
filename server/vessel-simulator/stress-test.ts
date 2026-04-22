/**
 * Telemetry Stress Test Harness
 * 
 * Generates high-rate telemetry to validate batch writer performance
 * and measure system throughput under load.
 */

import type { IStorage } from "../storage/interfaces/storage.types";
import { cryptoRandom } from "@shared/crypto-random";

export interface StressTestConfig {
  equipmentId: string;
  orgId: string;
  durationSeconds: number;
  messagesPerSecond: number;
  sensorTypes: string[];
  useBatchWriter?: boolean;
}

export interface StressTestResult {
  totalMessages: number;
  durationMs: number;
  actualMsgPerSec: number;
  targetMsgPerSec: number;
  batchWriterStats?: any;
  errors: number;
  dropped: number;
}

interface MessageGeneratorContext {
  config: StressTestConfig;
  messageCount: number;
}

function generateTelemetryMessage(ctx: MessageGeneratorContext) {
  const sensorType = ctx.config.sensorTypes[ctx.messageCount % ctx.config.sensorTypes.length];
  const value = 50 + cryptoRandom() * 50 + Math.sin(ctx.messageCount / 100) * 10;
  return {
    equipmentId: ctx.config.equipmentId,
    sensorType,
    value,
    timestamp: new Date(),
    orgId: ctx.config.orgId,
    unit: "units",
    metadata: { stressTest: true, messageIndex: ctx.messageCount },
  };
}

function calculateBatchParams(intervalMs: number, messagesPerSecond: number) {
  const batchInterval = Math.max(10, Math.floor(intervalMs));
  const messagesPerBatch = Math.max(1, Math.floor((1000 / batchInterval / messagesPerSecond) * 1000));
  return { batchInterval, messagesPerBatch };
}

/**
 * Telemetry Stress Test Harness
 */
export class TelemetryStressTest {
  private isRunning = false;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  private async runBatchMode(
    config: StressTestConfig,
    endTime: number,
    intervalMs: number,
    batchWriter: any
  ): Promise<{ messageCount: number; errors: number }> {
    let messageCount = 0;
    let errors = 0;
    const { batchInterval, messagesPerBatch } = calculateBatchParams(intervalMs, config.messagesPerSecond);
    const maxMessages = config.messagesPerSecond * config.durationSeconds;

    while (Date.now() < endTime && this.isRunning) {
      const batchStart = Date.now();
      for (let i = 0; i < messagesPerBatch && messageCount < maxMessages; i++) {
        try {
          batchWriter.queue(generateTelemetryMessage({ config, messageCount }));
          messageCount++;
        } catch {
          errors++;
        }
      }
      const elapsed = Date.now() - batchStart;
      if (elapsed < batchInterval) {
        await new Promise((r) => setTimeout(r, batchInterval - elapsed));
      }
    }
    return { messageCount, errors };
  }

  private async runDirectMode(
    config: StressTestConfig,
    endTime: number,
    intervalMs: number
  ): Promise<{ messageCount: number; errors: number }> {
    let messageCount = 0;
    let errors = 0;

    while (Date.now() < endTime && this.isRunning) {
      try {
        const msg = generateTelemetryMessage({ config, messageCount });
        await this.storage.createTelemetryReading({
          equipmentId: msg.equipmentId,
          sensorType: msg.sensorType,
          value: msg.value,
          timestamp: msg.timestamp,
          metadata: msg.metadata,
        });
        messageCount++;
      } catch {
        errors++;
      }
      if (intervalMs > 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
    return { messageCount, errors };
  }

  async run(config: StressTestConfig): Promise<StressTestResult> {
    if (this.isRunning) {
      throw new Error("Stress test already running");
    }

    this.isRunning = true;
    const startTime = Date.now();
    console.log(`[StressTest] Starting ${config.messagesPerSecond} msg/sec for ${config.durationSeconds}s`);

    try {
      const { telemetryBatchWriter } = await import("../telemetry-batch-writer");
      const useBatchWriter = config.useBatchWriter !== false;
      const intervalMs = 1000 / config.messagesPerSecond;
      const endTime = startTime + config.durationSeconds * 1000;

      const { messageCount, errors } = useBatchWriter
        ? await this.runBatchMode(config, endTime, intervalMs, telemetryBatchWriter)
        : await this.runDirectMode(config, endTime, intervalMs);

      const durationMs = Date.now() - startTime;
      const batchWriterStats = useBatchWriter ? telemetryBatchWriter.getStats() : undefined;

      const result: StressTestResult = {
        totalMessages: messageCount,
        durationMs,
        actualMsgPerSec: Math.round(messageCount / (durationMs / 1000)),
        targetMsgPerSec: config.messagesPerSecond,
        batchWriterStats,
        errors,
        dropped: batchWriterStats?.totalEvicted || 0,
      };

      console.log(`[StressTest] Complete:`, {
        totalMessages: result.totalMessages,
        actualMsgPerSec: result.actualMsgPerSec,
        targetMsgPerSec: result.targetMsgPerSec,
        durationMs: result.durationMs,
        errors: result.errors,
        dropped: result.dropped,
      });

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop a running stress test
   */
  stop(): void {
    this.isRunning = false;
    console.log("[StressTest] Stop requested");
  }

  /**
   * Check if stress test is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
