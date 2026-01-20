/**
 * Vector Index Benchmarking
 */

import { db } from "@db";
import { sql } from "drizzle-orm";
import { updateKbVectorIndexLastLatency, updateKbVectorIndexRowCount } from "../observability";
import type { BenchmarkResult } from "./types";
import { getIndexStats } from "./index-operations";

const benchmarkHistory: BenchmarkResult[] = [];

export async function benchmarkSearch(sampleSize = 10): Promise<BenchmarkResult> {
  const stats = await getIndexStats();

  if (stats.rowCount < sampleSize) {
    console.warn(`[VectorIndex] Insufficient data for benchmark (need ${sampleSize}, have ${stats.rowCount})`);
    return { avgLatencyMs: 0, minLatencyMs: 0, maxLatencyMs: 0, samplesRun: 0, indexType: stats.activeIndex?.indexType || "none", timestamp: new Date(), meetsTarget: false };
  }

  const samples = await db.execute(sql`SELECT embedding FROM kb_chunks WHERE embedding IS NOT NULL ORDER BY RANDOM() LIMIT ${sampleSize}`);
  const latencies: number[] = [];

  for (const sample of samples.rows) {
    const embedding = sample.embedding as number[];
    const start = Date.now();
    await db.execute(sql`
      SELECT id, text, 1 - (embedding <=> ${sql`ARRAY[${sql.join(embedding.map(v => sql`${v}`), sql`, `)}]::vector`}) as similarity
      FROM kb_chunks WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${sql`ARRAY[${sql.join(embedding.map(v => sql`${v}`), sql`, `)}]::vector`} LIMIT 5
    `);
    latencies.push(Date.now() - start);
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const result: BenchmarkResult = {
    avgLatencyMs: avgLatency,
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    samplesRun: latencies.length,
    indexType: stats.activeIndex?.indexType || "none",
    timestamp: new Date(),
    meetsTarget: avgLatency < 100,
  };

  benchmarkHistory.push(result);
  if (benchmarkHistory.length > 100) {benchmarkHistory.shift();}

  console.log(`[VectorIndex] Benchmark: ${avgLatency.toFixed(2)}ms avg, ${result.meetsTarget ? '✓' : '✗'} <100ms target`);
  updateKbVectorIndexLastLatency(result.indexType, avgLatency);
  updateKbVectorIndexRowCount(stats.rowCount);

  return result;
}

export function getBenchmarkHistory(): BenchmarkResult[] {
  return [...benchmarkHistory];
}

export async function autoOptimize(): Promise<BenchmarkResult> {
  const { createIVFFlatIndex, createHNSWIndex, getIndexStats } = await import("./index-operations");
  const stats = await getIndexStats();

  if (stats.rowCount === 0) {
    console.log("[VectorIndex] No data to index - skipping optimization");
    return { avgLatencyMs: 0, minLatencyMs: 0, maxLatencyMs: 0, samplesRun: 0, indexType: "none", timestamp: new Date(), meetsTarget: false };
  }

  console.log(`[VectorIndex] Auto-optimizing for ${stats.rowCount} embeddings...`);

  if (stats.rowCount < 10000) {
    await createHNSWIndex();
  } else if (stats.rowCount < 100000) {
    await createIVFFlatIndex();
  } else {
    await createIVFFlatIndex({ lists: Math.floor(Math.sqrt(stats.rowCount)) });
  }

  return benchmarkSearch(20);
}

export async function meetsPerformanceTarget(targetMs = 100): Promise<BenchmarkResult> {
  const benchmark = await benchmarkSearch(20);
  if (!benchmark.meetsTarget) {
    console.error(`[VectorIndex] ✗ Performance target FAILED: ${benchmark.avgLatencyMs.toFixed(2)}ms > ${targetMs}ms`);
  }
  return benchmark;
}
