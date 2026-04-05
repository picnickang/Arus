import type { ISchematicLayoutRepository } from '../domain/ports';
import type { SchematicLayout } from '../domain/types';
import { db } from '../../../db';
import { vessels } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class SchematicLayoutRepositoryAdapter implements ISchematicLayoutRepository {
  async getLayout(vesselId: string): Promise<SchematicLayout | null> {
    const [row] = await db
      .select({ schematicLayout: vessels.schematicLayout })
      .from(vessels)
      .where(eq(vessels.id, vesselId))
      .limit(1);

    if (!row || !row.schematicLayout) return null;
    return row.schematicLayout as SchematicLayout;
  }

  async saveLayout(vesselId: string, layout: SchematicLayout): Promise<void> {
    await db
      .update(vessels)
      .set({ schematicLayout: layout })
      .where(eq(vessels.id, vesselId));
  }
}

export const schematicLayoutRepository = new SchematicLayoutRepositoryAdapter();
