/**
 * Vector Index Service Class
 */

import type { IndexStats, BenchmarkResult, IndexConfig } from "./types";
import { getIndexStats, createIVFFlatIndex, createHNSWIndex } from "./index-operations";
import { benchmarkSearch, getBenchmarkHistory, autoOptimize, meetsPerformanceTarget } from "./benchmarking";

export class VectorIndexService {
  async getIndexStats(): Promise<IndexStats> {
    return getIndexStats();
  }

  async createIVFFlatIndex(config?: IndexConfig): Promise<void> {
    return createIVFFlatIndex(config);
  }

  async createHNSWIndex(config?: IndexConfig): Promise<void> {
    return createHNSWIndex(config);
  }

  async benchmarkSearch(sampleSize = 10): Promise<BenchmarkResult> {
    return benchmarkSearch(sampleSize);
  }

  getBenchmarkHistory(): BenchmarkResult[] {
    return getBenchmarkHistory();
  }

  async autoOptimize(): Promise<BenchmarkResult> {
    return autoOptimize();
  }

  async meetsPerformanceTarget(targetMs = 100): Promise<BenchmarkResult> {
    return meetsPerformanceTarget(targetMs);
  }
}

export const vectorIndexService = new VectorIndexService();
