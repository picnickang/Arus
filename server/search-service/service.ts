/**
 * Search Service - Main Service Class
 * Unified search across all entity types
 */

import type { SearchResponse, SearchEntityType, SearchResult } from "../../shared/search.js";
import { searchVessels, searchEquipment, searchAlerts, searchWorkOrders, searchCrew, searchSensors } from "./entity-searches.js";

export class SearchService {
  async search(query: string, orgId: string, options: { entityTypes?: SearchEntityType[]; limit?: number; includeMetadata?: boolean } = {}): Promise<SearchResponse> {
    const startTime = Date.now();
    const { entityTypes = ["vessel", "equipment", "alert", "work-order", "crew", "sensor"], limit = 20 } = options;

    const results: SearchResult[] = [];
    const groupedResults: Record<string, SearchResult[]> = {};
    const searchPromises: Promise<{ type: SearchEntityType; results: SearchResult[] }>[] = [];

    if (entityTypes.includes("vessel")) {searchPromises.push(searchVessels(query, orgId, limit).then((results) => ({ type: "vessel" as const, results })));}
    if (entityTypes.includes("equipment")) {searchPromises.push(searchEquipment(query, orgId, limit).then((results) => ({ type: "equipment" as const, results })));}
    if (entityTypes.includes("alert")) {searchPromises.push(searchAlerts(query, orgId, limit).then((results) => ({ type: "alert" as const, results })));}
    if (entityTypes.includes("work-order")) {searchPromises.push(searchWorkOrders(query, orgId, limit).then((results) => ({ type: "work-order" as const, results })));}
    if (entityTypes.includes("crew")) {searchPromises.push(searchCrew(query, orgId, limit).then((results) => ({ type: "crew" as const, results })));}
    if (entityTypes.includes("sensor")) {searchPromises.push(searchSensors(query, orgId, limit).then((results) => ({ type: "sensor" as const, results })));}

    const searchResults = await Promise.all(searchPromises);

    for (const { type, results: entityResults } of searchResults) {
      results.push(...entityResults);
      groupedResults[type] = entityResults;
    }

    const scoredResults = results
      .map((result) => ({ ...result, relevanceScore: this.calculateRelevance(query, result.name, result.description) }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    const limitedResults = scoredResults.slice(0, limit);
    const executionTime = Date.now() - startTime;

    console.log(`[Search] Query: "${query}" | Results: ${results.length} | Time: ${executionTime}ms | OrgId: ${orgId}`);
    if (executionTime > 500) {console.warn(`[Search:Slow] Query "${query}" took ${executionTime}ms`);}
    if (results.length === 0) {console.log(`[Search:NoResults] Query: "${query}" | OrgId: ${orgId}`);}
    else {
      const distribution = Object.entries(groupedResults).filter(([, r]) => r.length > 0).map(([type, r]) => `${type}:${r.length}`).join(", ");
      console.log(`[Search:Distribution] ${distribution} | Query: "${query}"`);
    }

    return { results: limitedResults, totalCount: results.length, groupedResults, query, executionTime };
  }

  private calculateRelevance(query: string, name: string, description?: string): number {
    const queryLower = query.toLowerCase();
    const nameLower = name.toLowerCase();
    const descLower = description?.toLowerCase() || "";
    let score = 0;
    if (nameLower === queryLower) {score += 1;}
    else if (nameLower.startsWith(queryLower)) {score += 0.8;}
    else if (nameLower.includes(queryLower)) {score += 0.6;}
    if (descLower.includes(queryLower)) {score += 0.2;}
    return Math.min(score, 1);
  }
}

export const searchService = new SearchService();
