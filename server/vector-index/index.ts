/**
 * Vector Index Module - Public API
 */

export * from "./types";
export { getIndexStats, dropAllVectorIndexes, createIVFFlatIndex, createHNSWIndex } from "./index-operations";
export { benchmarkSearch, getBenchmarkHistory, autoOptimize, meetsPerformanceTarget } from "./benchmarking";
export { VectorIndexService, vectorIndexService } from "./service";
