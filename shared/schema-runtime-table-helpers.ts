import type { Table } from "drizzle-orm";

import * as pgSchema from "./schema";
import * as sqliteVessel from "./schema-sqlite-vessel";
import * as sqliteSync from "./schema-sqlite-sync";

export { pgSchema, sqliteVessel, sqliteSync };

export const isLocalMode =
  process.env["LOCAL_MODE"] === "true" || process.env["EMBEDDED_MODE"] === "true";
export const IS_POSTGRES = !isLocalMode;

export function pickSchema<P extends Table>(useSqlite: boolean, sqliteTable: Table, pgTable: P): P {
  return useSqlite ? (sqliteTable as P) : pgTable;
}

/** Cloud-only table - present only in PostgreSQL mode; undefined in SQLite mode. */
export function cloudOnly<P extends Table>(pgTable: P): P {
  if (isLocalMode) {
    return undefined as never;
  }
  return pgTable;
}
