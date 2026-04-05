import type { ISchematicLayoutRepository } from '../domain/ports';
import type { SchematicLayout } from '../domain/types';
import { getDefaultLayout } from '../application/schematic-layout-service';
import { db } from '../../../db';
import { vessels } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class SchematicLayoutRepositoryAdapter implements ISchematicLayoutRepository {
  async getLayout(vesselId: string, orgId: string): Promise<SchematicLayout | null> {
    const [row] = await db
      .select({ schematicLayout: vessels.schematicLayout })
      .from(vessels)
      .where(and(eq(vessels.id, vesselId), eq(vessels.orgId, orgId)))
      .limit(1);

    if (!row || !row.schematicLayout) return null;
    return row.schematicLayout as SchematicLayout;
  }

  async saveLayout(vesselId: string, orgId: string, layout: SchematicLayout): Promise<void> {
    await db
      .update(vessels)
      .set({ schematicLayout: layout })
      .where(and(eq(vessels.id, vesselId), eq(vessels.orgId, orgId)));
  }

  getDefaultLayout(): SchematicLayout {
    return getDefaultLayout();
  }
}

export const schematicLayoutRepository = new SchematicLayoutRepositoryAdapter();
