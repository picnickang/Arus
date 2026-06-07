export type DiagramTypeKey =
  | "side_elevation"
  | "deck_plan"
  | "machinery_arrangement"
  | "electrical_single_line"
  | "fire_safety_plan"
  | "system_schematic"
  | "custom";

export interface DiagramTypeDefinition {
  key: DiagramTypeKey;
  label: string;
  defaultFor: string;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface VesselSectionDefinition {
  sectionNo: number;
  sectionKey: string;
  name: string;
  color: string;
  polygonNormalized: NormalizedPoint[];
  labelNormalized: NormalizedPoint;
  equipment: string[];
  thumbnailFallback: string;
}

export interface EquipmentRegistrySeed {
  equipmentId: string;
  name: string;
  assetCode: string;
  sectionKey: string;
  system: string;
  status: "Healthy" | "Watch" | "Caution";
  thumbnailFallback?: string;
}

export const VESSEL_INTELLIGENCE_ROUTES = [
  "/vessel-intelligence",
  "/vessel-intelligence/fleet",
  "/vessel-intelligence/:vesselId/overview",
  "/vessel-intelligence/:vesselId/sections",
  "/vessel-intelligence/:vesselId/sections/:sectionId",
  "/vessel-intelligence/:vesselId/equipment/:equipmentId",
  "/vessel-intelligence/:vesselId/performance",
  "/vessel-intelligence/:vesselId/health",
  "/vessel-intelligence/:vesselId/alerts",
  "/vessel-intelligence/:vesselId/maintenance",
  "/vessel-intelligence/:vesselId/maintenance/:workOrderId",
  "/vessel-intelligence/:vesselId/expert-cases",
  "/vessel-intelligence/:vesselId/reports",
  "/vessel-intelligence/:vesselId/settings",
  "/vessel-intelligence/:vesselId/diagrams",
  "/vessel-intelligence/:vesselId/diagrams/:diagramId",
  "/vessel-intelligence/:vesselId/diagrams/:diagramId/versions",
  "/vessel-intelligence/:vesselId/section-maps/:mapId/edit",
  "/vessel-intelligence/:vesselId/section-maps/:mapId/validate",
  "/vessel-intelligence/:vesselId/thumbnails",
] as const;

export const DIAGRAM_TYPES: DiagramTypeDefinition[] = [
  {
    key: "side_elevation",
    label: "Side Elevation",
    defaultFor: "section overview",
  },
  {
    key: "deck_plan",
    label: "Deck Plan",
    defaultFor: "deck equipment and cargo work areas",
  },
  {
    key: "machinery_arrangement",
    label: "Engine Room / Machinery Arrangement",
    defaultFor: "machinery drilldown",
  },
  {
    key: "electrical_single_line",
    label: "Electrical Single-Line",
    defaultFor: "generators, switchboards, power distribution",
  },
  {
    key: "fire_safety_plan",
    label: "Fire & Safety Plan",
    defaultFor: "fire zones, extinguishers, muster/safety equipment",
  },
  {
    key: "system_schematic",
    label: "System Schematic / P&ID",
    defaultFor: "fuel/lube/cooling/hydraulic systems",
  },
  {
    key: "custom",
    label: "Custom Diagram",
    defaultFor: "tenant-specific schematic or vendor drawing",
  },
];

export const SECTION_MAP = {
  coordinateMode: "normalized_percent",
  diagramWidth: 895,
  diagramHeight: 420,
  diagramKind: "side_elevation" as DiagramTypeKey,
  sections: [
    {
      sectionNo: 1,
      sectionKey: "aft_propulsion",
      name: "Aft Propulsion",
      color: "#d94c89",
      polygonNormalized: [
        { x: 0.0469, y: 0.6429 },
        { x: 0.2235, y: 0.6429 },
        { x: 0.2235, y: 0.8571 },
        { x: 0.067, y: 0.8571 },
        { x: 0.0559, y: 0.7857 },
      ],
      labelNormalized: { x: 0.1508, y: 0.7619 },
      equipment: ["Stern Thruster", "Propeller Shaft", "Rudder Gear"],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
    {
      sectionNo: 2,
      sectionKey: "aft_utility_steering",
      name: "Aft Utility / Steering",
      color: "#2876dd",
      polygonNormalized: [
        { x: 0.2235, y: 0.6429 },
        { x: 0.3352, y: 0.6429 },
        { x: 0.3352, y: 0.8571 },
        { x: 0.2235, y: 0.8571 },
      ],
      labelNormalized: { x: 0.2793, y: 0.7619 },
      equipment: ["Steering Gear", "Hydraulic Pack", "Aft Bilge Pump"],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
    {
      sectionNo: 3,
      sectionKey: "main_engine_room",
      name: "Main Engine Room",
      color: "#45a858",
      polygonNormalized: [
        { x: 0.3352, y: 0.6429 },
        { x: 0.581, y: 0.6429 },
        { x: 0.581, y: 0.8571 },
        { x: 0.3352, y: 0.8571 },
      ],
      labelNormalized: { x: 0.4581, y: 0.7619 },
      equipment: [
        "Main Engine 1",
        "Main Engine 2",
        "Reduction Gearbox",
        "Shaft Line",
        "Jacket Water Pumps",
        "Sea Water Pumps",
        "Bilge Pumps",
        "Engine Room Ventilation",
      ],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
    {
      sectionNo: 4,
      sectionKey: "generator_electrical",
      name: "Generator & Electrical",
      color: "#d3b23e",
      polygonNormalized: [
        { x: 0.581, y: 0.6429 },
        { x: 0.6983, y: 0.6429 },
        { x: 0.6983, y: 0.8571 },
        { x: 0.581, y: 0.8571 },
      ],
      labelNormalized: { x: 0.6391, y: 0.7619 },
      equipment: ["Aux Generator 1", "Aux Generator 2", "Main Switchboard", "Battery Charger"],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
    {
      sectionNo: 5,
      sectionKey: "fuel_lube_cooling",
      name: "Fuel / Lube / Cooling Systems",
      color: "#37c2bd",
      polygonNormalized: [
        { x: 0.6983, y: 0.6429 },
        { x: 0.8827, y: 0.6429 },
        { x: 0.8827, y: 0.8571 },
        { x: 0.6983, y: 0.8571 },
      ],
      labelNormalized: { x: 0.7877, y: 0.7619 },
      equipment: ["Fuel Transfer Pumps", "Fuel Tanks", "Lube Oil Pumps", "Coolers", "Separators"],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
    {
      sectionNo: 6,
      sectionKey: "deck_machinery_crane_base",
      name: "Deck Machinery & Crane Base",
      color: "#9b5cf6",
      polygonNormalized: [
        { x: 0.5251, y: 0.4762 },
        { x: 0.7263, y: 0.4762 },
        { x: 0.7263, y: 0.6429 },
        { x: 0.5251, y: 0.6429 },
      ],
      labelNormalized: { x: 0.6257, y: 0.5619 },
      equipment: ["Deck Crane", "Hydraulic Winch", "Capstan", "Crane HPU"],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
    {
      sectionNo: 7,
      sectionKey: "work_deck_cargo_area",
      name: "Work Deck / Cargo Area",
      color: "#3b82f6",
      polygonNormalized: [
        { x: 0.0112, y: 0.4286 },
        { x: 0.5866, y: 0.4286 },
        { x: 0.5866, y: 0.6429 },
        { x: 0.0112, y: 0.6429 },
      ],
      labelNormalized: { x: 0.2905, y: 0.5357 },
      equipment: ["Cargo Deck", "Deck Sockets", "Tie-down Points", "Cargo Rails"],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
    {
      sectionNo: 8,
      sectionKey: "accommodation_bridge",
      name: "Accommodation & Bridge",
      color: "#e17937",
      polygonNormalized: [
        { x: 0.7263, y: 0.2143 },
        { x: 0.8827, y: 0.2143 },
        { x: 0.9106, y: 0.6429 },
        { x: 0.7263, y: 0.6429 },
      ],
      labelNormalized: { x: 0.8101, y: 0.4286 },
      equipment: ["Bridge", "Accommodation", "Galley", "HVAC", "Control Room"],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
    {
      sectionNo: 9,
      sectionKey: "navigation_comms",
      name: "Navigation & Communications",
      color: "#34c6be",
      polygonNormalized: [
        { x: 0.7821, y: 0 },
        { x: 0.8492, y: 0 },
        { x: 0.8603, y: 0.2143 },
        { x: 0.7709, y: 0.2143 },
      ],
      labelNormalized: { x: 0.8156, y: 0.119 },
      equipment: ["Radar Mast", "AIS", "GPS", "VHF", "Satellite Comms"],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
    {
      sectionNo: 10,
      sectionKey: "forward_utility_bow",
      name: "Forward Utility / Safety / Bow Systems",
      color: "#d7bc3d",
      polygonNormalized: [
        { x: 0.8827, y: 0.3571 },
        { x: 0.9832, y: 0.3571 },
        { x: 0.9832, y: 0.8571 },
        { x: 0.8827, y: 0.8571 },
      ],
      labelNormalized: { x: 0.9363, y: 0.619 },
      equipment: ["Bow Thruster", "Anchor Windlass", "Forward Bilge", "Fire Pump"],
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    },
  ] satisfies VesselSectionDefinition[],
};

export const EQUIPMENT_MAPPING: EquipmentRegistrySeed[] = [
  {
    equipmentId: "ME-01",
    name: "Main Engine 1",
    assetCode: "ME-01",
    sectionKey: "main_engine_room",
    system: "Propulsion",
    status: "Healthy",
    thumbnailFallback: "manual -> equipment_photo -> parent_section -> icon",
  },
  {
    equipmentId: "ME-02",
    name: "Main Engine 2",
    assetCode: "ME-02",
    sectionKey: "main_engine_room",
    system: "Propulsion",
    status: "Healthy",
    thumbnailFallback: "manual -> equipment_photo -> parent_section -> icon",
  },
  {
    equipmentId: "GBX-01",
    name: "Reduction Gearbox",
    assetCode: "GBX-01",
    sectionKey: "main_engine_room",
    system: "Propulsion",
    status: "Watch",
  },
  {
    equipmentId: "DG-01",
    name: "Aux Generator 1",
    assetCode: "DG-01",
    sectionKey: "generator_electrical",
    system: "Electrical",
    status: "Healthy",
  },
  {
    equipmentId: "DG-02",
    name: "Aux Generator 2",
    assetCode: "DG-02",
    sectionKey: "generator_electrical",
    system: "Electrical",
    status: "Caution",
  },
  {
    equipmentId: "SWP-01",
    name: "Sea Water Pump 1",
    assetCode: "SWP-01",
    sectionKey: "main_engine_room",
    system: "Cooling",
    status: "Healthy",
  },
  {
    equipmentId: "CR-01",
    name: "Deck Crane",
    assetCode: "CR-01",
    sectionKey: "deck_machinery_crane_base",
    system: "Deck Machinery",
    status: "Healthy",
  },
  {
    equipmentId: "BT-01",
    name: "Bow Thruster",
    assetCode: "BT-01",
    sectionKey: "forward_utility_bow",
    system: "Maneuvering",
    status: "Watch",
  },
];

export const THUMBNAIL_FALLBACK_RULES = {
  section: [
    "manual",
    "crop_from_active_diagram",
    "generated_section_colour",
    "generic_section_icon",
  ],
  equipment: ["manual", "asset_photo", "parent_section_thumbnail", "generic_equipment_icon"],
} as const;

export const REPLACEMENT_MAPPING_OPTIONS = [
  "Keep existing section map as draft overlay",
  "Start blank section map",
  "Copy from another vessel",
  "Copy from vessel type template",
] as const;
