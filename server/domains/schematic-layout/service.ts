import { SchematicLayoutService } from "./application/schematic-layout-service";
import { schematicLayoutRepository } from "./infrastructure/schematic-layout-repository";

export const schematicLayoutService = new SchematicLayoutService(schematicLayoutRepository);
