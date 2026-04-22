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

const DEFAULT_SLOTS: SchematicSlot[] = [
  {
    slotId: "me",
    label: "Main Engine",
    category: "propulsion",
    typeMatch: ["engine", "main engine", "propulsion"],
  },
  { slotId: "gen1", label: "Generator #1", category: "power", typeMatch: ["generator"] },
  { slotId: "gen2", label: "Generator #2", category: "power", typeMatch: ["generator"] },
  { slotId: "pump1", label: "Cargo Pump", category: "cargo", typeMatch: ["pump"] },
  {
    slotId: "bow",
    label: "Bow Thruster",
    category: "thrusters",
    typeMatch: ["thruster", "bow thruster"],
  },
  { slotId: "crane", label: "Deck Crane", category: "deck", typeMatch: ["crane", "deck crane"] },
  {
    slotId: "dp",
    label: "DP System",
    category: "navigation",
    typeMatch: ["navigation", "dp", "dynamic positioning"],
  },
  { slotId: "fuel", label: "Fuel System", category: "fuel", typeMatch: ["tank", "fuel", "boiler"] },
  {
    slotId: "comp",
    label: "Compressor",
    category: "aux",
    typeMatch: ["compressor", "air compressor"],
  },
  {
    slotId: "elec",
    label: "Switchboard",
    category: "electrical",
    typeMatch: ["electrical", "switchboard", "transformer"],
  },
];

const DEFAULT_ZONES: SchematicZone[] = [
  { zoneId: "bow-thruster", label: "Bow / Thruster", order: 0, slotIds: ["bow"] },
  { zoneId: "bridge-nav", label: "Bridge / Navigation", order: 1, slotIds: ["dp", "comp"] },
  { zoneId: "main-deck", label: "Main Deck", order: 2, slotIds: ["crane"] },
  { zoneId: "engine-room", label: "Engine Room", order: 3, slotIds: ["me", "gen1", "gen2"] },
  { zoneId: "tank-cargo", label: "Tank / Cargo", order: 4, slotIds: ["fuel", "pump1", "elec"] },
];

export function getDefaultLayout(): SchematicLayout {
  return {
    zones: DEFAULT_ZONES.map((z) => ({ ...z, slotIds: [...z.slotIds] })),
    slots: DEFAULT_SLOTS.map((s) => ({ ...s, typeMatch: [...s.typeMatch] })),
  };
}
