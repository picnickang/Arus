import type { CreateSectionInput, SectionMapTemplateRecord } from "../domain/types";

const TEMPLATE_COLORS = ["#2563eb", "#16a34a", "#f97316", "#d946ef", "#06b6d4", "#eab308"];

function templateSections(prefix: string, names: string[]): CreateSectionInput[] {
  return names.map((name, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 0.08 + column * 0.28;
    const y = 0.18 + row * 0.24;
    return {
      sectionKey: `${prefix}_${index + 1}`,
      sectionNo: index + 1,
      name,
      color: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length] ?? "#2563eb",
      polygonNormalized: [
        { x, y },
        { x: x + 0.22, y },
        { x: x + 0.22, y: y + 0.16 },
        { x, y: y + 0.16 },
      ],
      labelNormalized: { x: x + 0.11, y: y + 0.08 },
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
      equipment: [],
    };
  });
}

export const SECTION_MAP_TEMPLATES: SectionMapTemplateRecord[] = [
  {
    id: "osv_workboat",
    name: "OSV / Workboat",
    vesselType: "OSV / Workboat",
    description: "Balanced working deck, machinery, accommodation, bridge, and utility zones.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("osv", [
      "Aft Working Deck",
      "Main Engine Room",
      "Cargo / Utility Deck",
      "Accommodation",
      "Bridge",
      "Bow / Forepeak",
    ]),
  },
  {
    id: "ahts",
    name: "AHTS",
    vesselType: "Anchor Handling Tug Supply",
    description: "Stern roller, winch deck, machinery, accommodation, bridge, and bow sections.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("ahts", [
      "Stern Roller",
      "Winch Deck",
      "Main Machinery",
      "Accommodation",
      "Bridge",
      "Forward Store",
    ]),
  },
  {
    id: "psv",
    name: "PSV",
    vesselType: "Platform Supply Vessel",
    description: "Cargo deck and tank/service sections for supply operations.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("psv", [
      "Aft Cargo Deck",
      "Mud / Brine Tanks",
      "Engine Room",
      "Accommodation",
      "Bridge",
      "Bow Thruster Room",
    ]),
  },
  {
    id: "tugboat",
    name: "Tugboat",
    vesselType: "Tugboat",
    description: "Compact towing vessel section starter.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("tug", [
      "Aft Deck",
      "Engine Room",
      "Galley",
      "Wheelhouse",
      "Forepeak",
    ]),
  },
  {
    id: "pilot_vessel",
    name: "Pilot Vessel",
    vesselType: "Pilot Vessel",
    description: "Fast craft operating sections.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("pilot", [
      "Aft Deck",
      "Machinery",
      "Passenger Cabin",
      "Bridge",
      "Foredeck",
    ]),
  },
  {
    id: "crew_boat",
    name: "Crew Boat",
    vesselType: "Crew Boat",
    description: "Crew transport layout starter.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("crew", [
      "Aft Deck",
      "Engine Room",
      "Passenger Cabin",
      "Bridge",
      "Bow",
    ]),
  },
  {
    id: "custom_blank",
    name: "Custom Blank",
    vesselType: "Custom",
    description: "Blank map with no sections.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: [],
  },
];

export function getSectionMapTemplate(templateId: string): SectionMapTemplateRecord | null {
  return SECTION_MAP_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
