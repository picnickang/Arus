/**
 * Database Utils - Schema Version Management
 * Track and manage database schema versions
 */

import { db } from "../db.js";
import { dbSchemaVersion } from "@shared/schema.js";
import { sql } from "drizzle-orm";

export async function getCurrentSchemaVersion(): Promise<number> {
  try {
    const versions = await db
      .select()
      .from(dbSchemaVersion)
      .orderBy(sql`applied_at DESC`)
      .limit(1);
    return versions.length > 0 ? versions[0].id : 0;
  } catch {
    return 0;
  }
}

export async function recordSchemaVersion(id: number, name: string): Promise<void> {
  await db.insert(dbSchemaVersion).values({ id, name, appliedAt: new Date() });
}
