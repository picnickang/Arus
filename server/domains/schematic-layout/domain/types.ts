export interface SchematicSlot {
  slotId: string;
  label: string;
  category: string;
  typeMatch: string[];
}

export interface SchematicZone {
  zoneId: string;
  label: string;
  order: number;
  slotIds: string[];
}

export interface SchematicLayout {
  zones: SchematicZone[];
  slots: SchematicSlot[];
}

export interface CreateZoneCommand {
  label: string;
  order?: number;
}

export interface UpdateZoneCommand {
  label?: string;
  order?: number;
}

export interface CreateSlotCommand {
  label: string;
  category: string;
  typeMatch: string[];
  zoneId: string;
}

export interface UpdateSlotCommand {
  label?: string;
  category?: string;
  typeMatch?: string[];
}

export interface MoveSlotCommand {
  targetZoneId: string;
}
