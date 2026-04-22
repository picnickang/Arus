import type { SchematicLayout } from "./types";

export interface ISchematicLayoutRepository {
  getLayout(vesselId: string, orgId: string): Promise<SchematicLayout | null | undefined>;
  saveLayout(vesselId: string, orgId: string, layout: SchematicLayout): Promise<void>;
  getDefaultLayout(): SchematicLayout;
}
