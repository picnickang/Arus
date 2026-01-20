/**
 * SQLite Schema Base Module
 * Common imports, helpers, and type mappings for SQLite schemas
 */

import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
import { index } from "drizzle-orm/sqlite-core";

export { sqliteTable, text, integer, real, primaryKey, index };

export const sqliteJsonHelpers = {
  parseArray: (value: string | null): string[] => {
    if (!value) {return [];}
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  },
  stringifyArray: (arr: string[]): string => JSON.stringify(arr),
  parseJson: <T>(value: string | null): T | null => {
    if (!value) {return null;}
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },
  stringifyJson: <T>(obj: T): string => JSON.stringify(obj),
};
