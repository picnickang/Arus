/**
 * SQLite Init - Type Definitions
 */

export interface SqliteDomainDefinition {
  description: string;
  tables: readonly string[];
  indexes: readonly string[];
}

export type SqliteDomainMap = Record<string, SqliteDomainDefinition>;
