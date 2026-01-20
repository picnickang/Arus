export const EQUIPMENT_TYPES = [
  "engine",
  "pump",
  "compressor",
  "generator",
  "gearbox",
  "thruster",
  "crane",
  "winch",
  "boiler",
  "hvac",
  "navigation",
  "communication",
  "safety",
  "other",
] as const;

export const EQUIPMENT_LOCATIONS = [
  "engine_room",
  "deck",
  "bridge",
  "cargo_hold",
  "pump_room",
  "steering_gear",
  "accommodation",
  "galley",
  "workshop",
  "other",
] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];
export type EquipmentLocation = (typeof EQUIPMENT_LOCATIONS)[number];
