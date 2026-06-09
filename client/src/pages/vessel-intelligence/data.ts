import type { SectionMapImageTransform } from "@shared/schema-runtime";
import type { DiagramTypeKey, VesselSectionMapDefinition } from "./registry";

export interface VesselRecord {
  id?: string;
  name?: string;
  vesselName?: string;
  imo?: string;
  status?: string;
  vesselClass?: string | null;
  condition?: string | null;
  onlineStatus?: string | null;
  lastHeartbeat?: string | Date | null;
  currentPort?: string;
  route?: string;
}

export interface EquipmentRecord {
  id?: string;
  equipmentId?: string;
  vesselId?: string;
  name?: string;
  equipmentName?: string;
  assetCode?: string;
  tagNumber?: string;
  status?: string;
  healthStatus?: string;
  system?: string;
  sectionKey?: string;
}

export interface VesselIntelligenceWorkOrderRecord {
  id?: string;
  vesselId?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  equipmentId?: string;
  dueDate?: string;
}

export interface VesselIntelligenceAlertRecord {
  id?: string;
  vesselId?: string;
  title?: string;
  message?: string;
  severity?: string;
  status?: string;
  acknowledged?: boolean;
}

export type PdmDashboardRecord = Record<string, unknown>;

export interface RegistryDiagramRecord {
  id: string;
  diagramType: string;
  title: string;
  description?: string | null;
  status: string;
  activeVersionId?: string | null;
  currentSectionMapId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RegistrySectionAssignmentRecord {
  id?: string;
  equipmentId?: string | null;
  equipmentName: string;
  assetCode?: string | null;
  system?: string | null;
}

export interface RegistrySectionRecord {
  id: string;
  sectionKey: string;
  sectionNo: number;
  name: string;
  color: string;
  polygonNormalized: Array<{ x: number; y: number }>;
  labelNormalized: { x: number; y: number };
  equipment: RegistrySectionAssignmentRecord[];
  thumbnailFallback?: string | null;
}

export interface RegistrySectionMapRecord {
  id: string;
  vesselId?: string;
  diagramId?: string | null;
  diagramVersionId?: string | null;
  sourceMapId?: string | null;
  name: string;
  status: string;
  coordinateMode: "normalized_percent";
  diagramWidth: number;
  diagramHeight: number;
  diagramKind: string;
  imageTransform?: SectionMapImageTransform | null;
  validationSummary?: { blockers: number; warnings: number; checkedAt: string } | null;
  publishedAt?: string | null;
  sections: RegistrySectionRecord[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RegistrySummaryRecord {
  diagrams: RegistryDiagramRecord[];
  activeDiagram?: RegistryDiagramRecord | null;
  sectionMaps: RegistrySectionMapRecord[];
  activeSectionMap?: RegistrySectionMapRecord | null;
  validationIssues: Array<{ severity: string; code: string; message: string }>;
}

export function sectionMapDefinitionFromRegistry(
  map: RegistrySectionMapRecord | null | undefined
): VesselSectionMapDefinition | null {
  if (!map || map.coordinateMode !== "normalized_percent" || map.sections.length === 0) {
    return null;
  }

  return {
    coordinateMode: "normalized_percent",
    diagramWidth: map.diagramWidth,
    diagramHeight: map.diagramHeight,
    diagramKind: (map.diagramKind || "side_elevation") as DiagramTypeKey,
    imageTransform: map.imageTransform ?? undefined,
    sections: map.sections.map((section) => ({
      sectionNo: section.sectionNo,
      sectionKey: section.sectionKey,
      name: section.name,
      color: section.color,
      polygonNormalized: section.polygonNormalized,
      labelNormalized: section.labelNormalized,
      equipment: section.equipment.map((assignment) => assignment.equipmentName),
      thumbnailFallback:
        section.thumbnailFallback ??
        "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    })),
  };
}

export function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  for (const key of ["data", "items", "results", "vessels", "equipment", "workOrders", "alerts"]) {
    const maybeArray = record[key];
    if (Array.isArray(maybeArray)) {
      return maybeArray as T[];
    }
  }

  return [];
}

export function vesselIdFor(vessel: VesselRecord | undefined): string {
  return vessel?.id ?? "";
}

export function vesselNameFor(vessel: VesselRecord | undefined): string {
  return vessel?.name ?? vessel?.vesselName ?? vessel?.id ?? "No vessel selected";
}

export function equipmentNameFor(equipment: EquipmentRecord): string {
  return (
    equipment.name ?? equipment.equipmentName ?? equipment.assetCode ?? equipment.id ?? "Equipment"
  );
}

export function workOrderTitleFor(workOrder: VesselIntelligenceWorkOrderRecord): string {
  return workOrder.title ?? workOrder.description ?? workOrder.id ?? "Work order";
}

export function alertTitleFor(alert: VesselIntelligenceAlertRecord): string {
  return alert.title ?? alert.message ?? alert.id ?? "Alert";
}

export function belongsToVessel(record: { vesselId?: string }, vesselId: string): boolean {
  if (!vesselId) {
    return true;
  }
  return !record.vesselId || record.vesselId === vesselId;
}

export function statusText(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "Live data unavailable";
}
