import type { ISchematicLayoutRepository } from "../domain/ports";
import type { SchematicLayout } from "../domain/types";
import { getDefaultLayout } from "../domain/types";
import { db } from "../../../db";
import { vessels } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class SchematicLayoutRepositoryAdapter implements ISchematicLayoutRepository {
  async vesselExists(vesselId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: vessels.id })
      .from(vessels)
      .where(and(eq(vessels.id, vesselId), eq(vessels.orgId, orgId)))
      .limit(1);
    return !!row;
  }

  async getLayout(vesselId: string, orgId: string): Promise<SchematicLayout | null | undefined> {
    const [row] = await db
      .select({ schematicLayout: vessels.schematicLayout })
      .from(vessels)
      .where(and(eq(vessels.id, vesselId), eq(vessels.orgId, orgId)))
      .limit(1);

    if (!row) {
      return undefined;
    }
    if (!row.schematicLayout) {
      return null;
    }
    return row.schematicLayout as SchematicLayout;
  }

  async saveLayout(vesselId: string, orgId: string, layout: SchematicLayout): Promise<void> {
    const result = await db
      .update(vessels)
      .set({ schematicLayout: layout })
      .where(and(eq(vessels.id, vesselId), eq(vessels.orgId, orgId)))
      .returning({ id: vessels.id });

    if (result.length === 0) {
      const err = new Error(`Vessel "${vesselId}" not found`) as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }
  }

  getDefaultLayout(): SchematicLayout {
    return getDefaultLayout();
  }
}

export const schematicLayoutRepository = new SchematicLayoutRepositoryAdapter();
