import type { VesselEquipment } from "@/features/vessels/types";
import type { SchematicSlot, SchematicZone } from "@/hooks/useSchematicLayout";

export interface PositionedSlot extends SchematicSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SlotAssignment {
  slot: PositionedSlot;
  equipment: VesselEquipment | null;
}

export interface ZoneRect {
  zone: SchematicZone;
  x: number;
  y: number;
  w: number;
  h: number;
}
