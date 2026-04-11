/**
 * Fleet-Scale Telemetry Stress Test
 * 
 * Simulates 20 vessels with 30 sensors each (600 total sensors)
 * to measure telemetry ingestion performance at scale.
 */

import type { IStorage } from "../storage/interfaces/storage.types";
import { cryptoRandom } from "@shared/crypto-random";

export interface FleetStressConfig {
  vesselCount: number;
  sensorsPerVessel: number;
  durationSeconds: number;
  messagesPerSecondPerSensor: number;
  orgId: string;
  useBatchWriter?: boolean;
}

export interface VesselMetrics {
  vesselId: string;
  messagesGenerated: number;
  errors: number;
  avgLatencyMs: number;
}

export interface FleetStressResult {
  totalVessels: number;
  totalSensors: number;
  totalMessages: number;
  durationMs: number;
  actualMsgPerSec: number;
  targetMsgPerSec: number;
  errors: number;
  dropped: number;
  vesselMetrics: VesselMetrics[];
  memoryUsageMB: number;
  cpuTimeMs: number;
  peakThroughput: number;
  minThroughput: number;
  avgLatencyMs: number;
}

const SENSOR_TYPES = [
  { type: "vibration_x", unit: "g", baseValue: 0.5, variance: 0.3 },
  { type: "vibration_y", unit: "g", baseValue: 0.5, variance: 0.3 },
  { type: "vibration_z", unit: "g", baseValue: 0.6, variance: 0.35 },
  { type: "temperature_oil", unit: "C", baseValue: 75, variance: 15 },
  { type: "temperature_coolant", unit: "C", baseValue: 65, variance: 10 },
  { type: "temperature_exhaust", unit: "C", baseValue: 350, variance: 50 },
  { type: "pressure_oil", unit: "bar", baseValue: 4.5, variance: 1 },
  { type: "pressure_fuel", unit: "bar", baseValue: 6, variance: 1.5 },
  { type: "pressure_hydraulic", unit: "bar", baseValue: 250, variance: 30 },
  { type: "flow_fuel", unit: "L/h", baseValue: 45, variance: 15 },
  { type: "flow_coolant", unit: "L/min", baseValue: 120, variance: 20 },
  { type: "level_fuel", unit: "%", baseValue: 65, variance: 25 },
  { type: "level_oil", unit: "%", baseValue: 85, variance: 10 },
  { type: "rpm_main_engine", unit: "rpm", baseValue: 1200, variance: 300 },
  { type: "rpm_aux_engine", unit: "rpm", baseValue: 1500, variance: 200 },
  { type: "voltage_main", unit: "V", baseValue: 440, variance: 20 },
  { type: "voltage_battery", unit: "V", baseValue: 24, variance: 2 },
  { type: "current_generator", unit: "A", baseValue: 150, variance: 50 },
  { type: "current_motor", unit: "A", baseValue: 80, variance: 30 },
  { type: "frequency_gen", unit: "Hz", baseValue: 60, variance: 1 },
  { type: "torque_shaft", unit: "kNm", baseValue: 120, variance: 40 },
  { type: "oil_debris_count", unit: "ppm", baseValue: 15, variance: 10 },
  { type: "oil_water_content", unit: "%", baseValue: 0.1, variance: 0.05 },
  { type: "acoustic_db", unit: "dB", baseValue: 85, variance: 10 },
  { type: "position_lat", unit: "deg", baseValue: 1.35, variance: 0.01 },
  { type: "position_lon", unit: "deg", baseValue: 103.82, variance: 0.01 },
  { type: "speed_over_ground", unit: "kn", baseValue: 12, variance: 5 },
  { type: "heading", unit: "deg", baseValue: 180, variance: 180 },
  { type: "draft_fore", unit: "m", baseValue: 4.5, variance: 0.3 },
  { type: "draft_aft", unit: "m", baseValue: 4.8, variance: 0.3 },
];

function generateSensorValue(sensor: typeof SENSOR_TYPES[0], t: number): number {
  const drift = Math.sin(t / 100) * sensor.variance * 0.3;
  const noise = (cryptoRandom() - 0.5) * sensor.variance;
  return sensor.baseValue + drift + noise;
}

export class FleetStressTest {
  private isRunning = false;
  private storage: IStorage;
  private throughputSamples: number[] = [];
  private latencySamples: number[] = [];

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async run(config: FleetStressConfig): Promise<FleetStressResult> {
    if (this.isRunning) {
      throw new Error("Fleet stress test already running");
    }

    this.isRunning = true;
    this.throughputSamples = [];
    this.latencySamples = [];

    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    const startCpuTime = process.cpuUsage();

    const totalSensors = config.vesselCount * config.sensorsPerVessel;
    const targetMsgPerSec = totalSensors * config.messagesPerSecondPerSensor;

    console.log(`[FleetStressTest] Starting fleet stress test`);
    console.log(`  Vessels: ${config.vesselCount}`);
    console.log(`  Sensors per vessel: ${config.sensorsPerVessel}`);
    console.log(`  Total sensors: ${totalSensors}`);
    console.log(`  Target msg/sec: ${targetMsgPerSec}`);
    console.log(`  Duration: ${config.durationSeconds}s`);

    const vesselMetrics: VesselMetrics[] = [];
    let totalMessages = 0;
    let totalErrors = 0;
    let totalDropped = 0;

    try {
      const { telemetryBatchWriter } = await import("../telemetry-batch-writer");
      const useBatch = config.useBatchWriter !== false;

      const endTime = startTime + config.durationSeconds * 1000;
      const intervalMs = 1000 / config.messagesPerSecondPerSensor;

      const vesselPromises = Array.from({ length: config.vesselCount }, async (_, vesselIndex) => {
        const vesselId = `stress-vessel-${String(vesselIndex + 1).padStart(2, "0")}`;
        const sensors = SENSOR_TYPES.slice(0, config.sensorsPerVessel);
        
        let msgCount = 0;
        let errors = 0;
        const latencies: number[] = [];

        while (Date.now() < endTime && this.isRunning) {
          const batchStart = Date.now();

          for (const sensor of sensors) {
            try {
              const msgStart = Date.now();
              const value = generateSensorValue(sensor, msgCount);
              const reading = {
                equipmentId: `${vesselId}-engine-01`,
                sensorType: sensor.type,
                value,
                timestamp: new Date(),
                orgId: config.orgId,
                unit: sensor.unit,
                metadata: { 
                  stressTest: true, 
                  vesselId,
                  sensorIndex: SENSOR_TYPES.indexOf(sensor),
                },
              };

              if (useBatch) {
                telemetryBatchWriter.queue(reading);
              } else {
                await this.storage.createTelemetryReading({
                  equipmentId: reading.equipmentId,
                  sensorType: reading.sensorType,
                  value: reading.value,
                  timestamp: reading.timestamp,
                  metadata: reading.metadata,
                });
              }

              latencies.push(Date.now() - msgStart);
              msgCount++;
            } catch (_e) {
              errors++;
            }
          }

          const elapsed = Date.now() - batchStart;
          if (elapsed < intervalMs) {
            await new Promise((r) => setTimeout(r, Math.max(1, intervalMs - elapsed)));
          }
        }

        const avgLatency = latencies.length > 0 
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
          : 0;

        return {
          vesselId,
          messagesGenerated: msgCount,
          errors,
          avgLatencyMs: Math.round(avgLatency * 100) / 100,
        };
      });

      const sampleInterval = setInterval(() => {
        if (!this.isRunning) return;
        const elapsed = (Date.now() - startTime) / 1000;
        const currentTotal = vesselMetrics.reduce((sum, v) => sum + v.messagesGenerated, 0) + totalMessages;
        this.throughputSamples.push(currentTotal / elapsed);
      }, 1000);

      const results = await Promise.all(vesselPromises);
      clearInterval(sampleInterval);

      for (const result of results) {
        vesselMetrics.push(result);
        totalMessages += result.messagesGenerated;
        totalErrors += result.errors;
        this.latencySamples.push(result.avgLatencyMs);
      }

      const batchStats = useBatch ? telemetryBatchWriter.getStats() : null;
      totalDropped = batchStats?.totalEvicted || 0;

      const endMemory = process.memoryUsage().heapUsed;
      const endCpuTime = process.cpuUsage(startCpuTime);
      const durationMs = Date.now() - startTime;

      const result: FleetStressResult = {
        totalVessels: config.vesselCount,
        totalSensors,
        totalMessages,
        durationMs,
        actualMsgPerSec: Math.round(totalMessages / (durationMs / 1000)),
        targetMsgPerSec,
        errors: totalErrors,
        dropped: totalDropped,
        vesselMetrics,
        memoryUsageMB: Math.round((endMemory - startMemory) / 1024 / 1024 * 100) / 100,
        cpuTimeMs: Math.round((endCpuTime.user + endCpuTime.system) / 1000),
        peakThroughput: this.throughputSamples.length > 0 ? Math.max(...this.throughputSamples) : 0,
        minThroughput: this.throughputSamples.filter(t => t > 0).length > 0 
          ? Math.min(...this.throughputSamples.filter(t => t > 0)) 
          : 0,
        avgLatencyMs: this.latencySamples.length > 0
          ? Math.round(this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length * 100) / 100
          : 0,
      };

      console.log(`[FleetStressTest] Complete:`);
      console.log(`  Total messages: ${result.totalMessages}`);
      console.log(`  Actual throughput: ${result.actualMsgPerSec} msg/sec`);
      console.log(`  Target throughput: ${result.targetMsgPerSec} msg/sec`);
      console.log(`  Efficiency: ${Math.round(result.actualMsgPerSec / result.targetMsgPerSec * 100)}%`);
      console.log(`  Errors: ${result.errors}`);
      console.log(`  Dropped: ${result.dropped}`);
      console.log(`  Memory delta: ${result.memoryUsageMB} MB`);
      console.log(`  CPU time: ${result.cpuTimeMs} ms`);
      console.log(`  Avg latency: ${result.avgLatencyMs} ms`);

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log("[FleetStressTest] Stop requested");
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
