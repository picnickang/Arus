import type { SchematicLayout } from './types';

export interface ISchematicLayoutRepository {
  getLayout(vesselId: string): Promise<SchematicLayout | null>;
  saveLayout(vesselId: string, layout: SchematicLayout): Promise<void>;
}
