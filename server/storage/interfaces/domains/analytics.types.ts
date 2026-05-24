/**
 * Analytics Storage Interface - Insights, Knowledge Base, Optimizer, Dashboard
 * Part of IStorage modularization for improved maintainability
 */

import type {
  InsightSnapshot,
  InsertInsightSnapshot,
  InsightReport,
  InsertInsightReport,
  KnowledgeBaseItem,
  InsertKnowledgeBaseItem,
  ContentSource,
  InsertContentSource,
  RagSearchQuery,
  InsertRagSearchQuery,
  OptimizerConfiguration,
  InsertOptimizerConfiguration,
  ResourceConstraint,
  InsertResourceConstraint,
  OptimizationResult,
  ScheduleOptimization,
  MaintenanceSchedule,
} from "@shared/schema";
import type { DashboardMetrics } from "../../domains/analytics-insights-adapter.js";

/**
 * Analytics storage operations for insights, knowledge base, and optimization
 */
export interface IAnalyticsStorage {
  // Dashboard Metrics
  getDashboardMetrics(orgId: string): Promise<DashboardMetrics>;
  recordMetricsHistory(
    orgId: string,
    metrics: Omit<DashboardMetrics, "trends">,
    equipmentStats: { total: number; healthy: number; warning: number; critical: number }
  ): Promise<void>;
  getMetricsHistory(orgId: string, days?: number): Promise<Array<Record<string, unknown>>>;

  // Insights
  getInsightSnapshots(orgId?: string, scope?: string): Promise<InsightSnapshot[]>;
  getLatestInsightSnapshot(orgId: string, scope: string): Promise<InsightSnapshot | undefined>;
  createInsightSnapshot(orgId: string, snapshot: InsertInsightSnapshot): Promise<InsightSnapshot>;
  getInsightReports(orgId?: string, scope?: string): Promise<InsightReport[]>;
  createInsightReport(orgId: string, report: InsertInsightReport): Promise<InsightReport>;

  // Knowledge Base
  searchKnowledgeBase(
    query: string,
    filters?: { contentType?: string[]; orgId?: string; equipmentId?: string }
  ): Promise<KnowledgeBaseItem[]>;
  createKnowledgeBaseItem(item: InsertKnowledgeBaseItem): Promise<KnowledgeBaseItem>;
  updateKnowledgeBaseItem(
    id: string,
    item: Partial<InsertKnowledgeBaseItem>
  ): Promise<KnowledgeBaseItem>;
  deleteKnowledgeBaseItem(id: string): Promise<void>;
  getKnowledgeBaseItems(orgId?: string, contentType?: string): Promise<KnowledgeBaseItem[]>;
  semanticSearch(
    query: string,
    orgId: string,
    contentTypes?: string[],
    limit?: number
  ): Promise<{ items: KnowledgeBaseItem[]; citations: ContentSource[] }>;
  indexContent(
    sourceType: string,
    sourceId: string,
    content: string,
    metadata?: Record<string, unknown>,
    orgId?: string
  ): Promise<KnowledgeBaseItem>;
  refreshContentIndex(
    orgId?: string,
    sourceTypes?: string[]
  ): Promise<{ indexed: number; updated: number }>;

  // Content Sources
  getContentSources(orgId?: string, sourceType?: string): Promise<ContentSource[]>;
  createContentSource(source: InsertContentSource): Promise<ContentSource>;
  updateContentSource(id: string, source: Partial<InsertContentSource>): Promise<ContentSource>;

  // RAG Search
  logRagSearchQuery(query: InsertRagSearchQuery): Promise<RagSearchQuery>;
  getRagSearchHistory(orgId?: string, limit?: number): Promise<RagSearchQuery[]>;

  // Optimizer Configurations
  getOptimizerConfigurations(orgId?: string): Promise<OptimizerConfiguration[]>;
  createOptimizerConfiguration(
    config: InsertOptimizerConfiguration
  ): Promise<OptimizerConfiguration>;
  updateOptimizerConfiguration(
    id: string,
    config: Partial<InsertOptimizerConfiguration>
  ): Promise<OptimizerConfiguration>;
  deleteOptimizerConfiguration(id: string): Promise<void>;

  // Resource Constraints
  getResourceConstraints(resourceType?: string, orgId?: string): Promise<ResourceConstraint[]>;
  createResourceConstraint(constraint: InsertResourceConstraint): Promise<ResourceConstraint>;
  updateResourceConstraint(
    id: string,
    constraint: Partial<InsertResourceConstraint>
  ): Promise<ResourceConstraint>;
  deleteResourceConstraint(id: string): Promise<void>;

  // Optimization Results
  runOptimization(
    configId: string,
    equipmentScope?: string[],
    timeHorizon?: number
  ): Promise<OptimizationResult>;
  getOptimizationResults(orgId?: string, limit?: number): Promise<OptimizationResult[]>;
  getOptimizationResult(id: string): Promise<OptimizationResult | undefined>;
  cancelOptimization(optimizationId: string): Promise<OptimizationResult>;
  applyOptimizationToProduction(optimizationId: string): Promise<OptimizationResult>;
  deleteOptimizationResult(optimizationId: string): Promise<void>;
  deleteAllOptimizationResults(orgId: string): Promise<number>;

  // Schedule Optimizations
  getScheduleOptimizations(optimizationResultId: string): Promise<ScheduleOptimization[]>;
  applyScheduleOptimization(optimizationId: string): Promise<MaintenanceSchedule>;
  rejectScheduleOptimization(
    optimizationId: string,
    reason?: string
  ): Promise<ScheduleOptimization>;
  getOptimizationRecommendations(
    equipmentId?: string,
    timeHorizon?: number
  ): Promise<ScheduleOptimization[]>;
}
