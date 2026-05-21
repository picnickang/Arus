import { getTableColumns, type Table } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export function tableColumns<T extends Table>(
  table: T
): Record<string, AnyPgColumn | undefined> {
  return getTableColumns(table) as Record<string, AnyPgColumn | undefined>;
}
