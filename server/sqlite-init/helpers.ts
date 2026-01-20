/**
 * SQLite Init - Helper Functions
 * Utility functions for querying and validating the domain manifest
 */

import type { SqliteDomainMap, SqliteDomainDefinition } from "./types.js";
import { SqliteDomains, type SqliteDomainName } from "./manifest.js";

export function getTableCount(): number {
  return Object.values(SqliteDomains as SqliteDomainMap).reduce((sum, domain) => sum + domain.tables.length, 0);
}

export function getIndexCount(): number {
  return Object.values(SqliteDomains as SqliteDomainMap).reduce((sum, domain) => sum + domain.indexes.length, 0);
}

export function getTablesByDomain(domain: SqliteDomainName): readonly string[] {
  return SqliteDomains[domain].tables;
}

export function findTableDomain(tableName: string): SqliteDomainName | null {
  for (const [domainName, domain] of Object.entries(SqliteDomains)) {
    if ((domain as SqliteDomainDefinition).tables.includes(tableName)) {return domainName as SqliteDomainName;}
  }
  return null;
}

export function getAllTables(): string[] {
  return Object.values(SqliteDomains as SqliteDomainMap).flatMap(domain => [...domain.tables]);
}

export function getAllIndexes(): string[] {
  return Object.values(SqliteDomains as SqliteDomainMap).flatMap(domain => [...domain.indexes]);
}

export function getDomainSummary(): Record<SqliteDomainName, { tables: number; indexes: number }> {
  return Object.fromEntries(Object.entries(SqliteDomains).map(([name, domain]) => [name, { tables: (domain as SqliteDomainDefinition).tables.length, indexes: (domain as SqliteDomainDefinition).indexes.length }])) as Record<SqliteDomainName, { tables: number; indexes: number }>;
}

export function validateManifest(sqliteInitContent: string): { missingTables: string[]; extraTables: string[]; missingIndexes: string[]; extraIndexes: string[] } {
  const tableMatches = sqliteInitContent.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)/gi);
  const sqliteTables = new Set([...tableMatches].map(m => m[1]).filter(t => t.length > 2));
  const indexMatches = sqliteInitContent.matchAll(/CREATE INDEX IF NOT EXISTS ([a-z0-9_]+)/gi);
  const sqliteIndexes = new Set([...indexMatches].map(m => m[1]).filter(i => i.length > 5));
  const manifestTables = new Set(getAllTables()), manifestIndexes = new Set(getAllIndexes());
  return { missingTables: [...sqliteTables].filter(t => !manifestTables.has(t)), extraTables: [...manifestTables].filter(t => !sqliteTables.has(t)), missingIndexes: [...sqliteIndexes].filter(i => !manifestIndexes.has(i)), extraIndexes: [...manifestIndexes].filter(i => !sqliteIndexes.has(i)) };
}
