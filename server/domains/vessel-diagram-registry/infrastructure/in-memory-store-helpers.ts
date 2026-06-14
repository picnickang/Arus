import { randomUUID } from "node:crypto";
import { normalizeSectionMapImageTransform } from "../domain/types";
import type {
  CreateSectionInput,
  CreateSectionMapInput,
  DiagramRecord,
  EquipmentAssignmentRecord,
  RegistryContext,
  SectionMapRecord,
  SectionRecord,
  UpdateAssignmentInput,
  UpdateDiagramInput,
  UpdateSectionInput,
  UpdateSectionMapInput,
} from "../domain/types";

export function now(): Date {
  return new Date();
}

export function buildSection(input: CreateSectionInput, index: number): SectionRecord {
  const sectionId = randomUUID();
  return {
    id: sectionId,
    sectionKey: input.sectionKey,
    sectionNo: input.sectionNo,
    name: input.name,
    color: input.color,
    thumbnailFallback: input.thumbnailFallback ?? null,
    sortOrder: index,
    polygonNormalized: input.polygonNormalized,
    labelNormalized: input.labelNormalized,
    equipment:
      input.equipment?.map((equipment, equipmentIndex) => ({
        id: randomUUID(),
        sectionId,
        equipmentId: equipment.equipmentId ?? null,
        equipmentName: equipment.equipmentName,
        assetCode: equipment.assetCode ?? null,
        system: equipment.system ?? null,
        sortOrder: equipmentIndex,
      })) ?? [],
  };
}

export function buildSectionMap(
  ctx: RegistryContext,
  input: CreateSectionMapInput
): SectionMapRecord {
  return {
    id: randomUUID(),
    vesselId: ctx.vesselId,
    diagramId: input.diagramId ?? null,
    diagramVersionId: input.diagramVersionId ?? null,
    sourceMapId: input.sourceMapId ?? null,
    name: input.name,
    coordinateMode: "normalized_percent",
    diagramWidth: input.diagramWidth ?? 895,
    diagramHeight: input.diagramHeight ?? 420,
    diagramKind: input.diagramKind ?? "side_elevation",
    imageTransform: normalizeSectionMapImageTransform(input.imageTransform),
    status: "draft",
    validationSummary: null,
    publishedAt: null,
    sections: input.sections?.map(buildSection) ?? [],
    createdAt: now(),
    updatedAt: now(),
  };
}

export function buildCloneSectionMapInput(
  source: SectionMapRecord,
  input: { name: string; diagramId?: string; diagramVersionId?: string }
): CreateSectionMapInput {
  return {
    name: input.name,
    diagramId: input.diagramId ?? source.diagramId ?? undefined,
    diagramVersionId: input.diagramVersionId ?? source.diagramVersionId ?? undefined,
    sourceMapId: source.id,
    diagramWidth: source.diagramWidth,
    diagramHeight: source.diagramHeight,
    diagramKind: source.diagramKind,
    imageTransform: source.imageTransform,
    sections: source.sections.map((section) => ({
      sectionKey: section.sectionKey,
      sectionNo: section.sectionNo,
      name: section.name,
      color: section.color,
      polygonNormalized: section.polygonNormalized,
      labelNormalized: section.labelNormalized,
      thumbnailFallback: section.thumbnailFallback ?? undefined,
      equipment: section.equipment.map((equipment) => ({
        equipmentId: equipment.equipmentId ?? undefined,
        equipmentName: equipment.equipmentName,
        assetCode: equipment.assetCode ?? undefined,
        system: equipment.system ?? undefined,
      })),
    })),
  };
}

export function applyDiagramUpdate(diagram: DiagramRecord, input: UpdateDiagramInput): void {
  if (input.title !== undefined) {
    diagram.title = input.title;
  }
  if (input.description !== undefined) {
    diagram.description = input.description;
  }
  if (input.status !== undefined) {
    diagram.status = input.status;
  }
  if (input.activeVersionId !== undefined) {
    diagram.activeVersionId = input.activeVersionId;
  }
  if (input.currentSectionMapId !== undefined) {
    diagram.currentSectionMapId = input.currentSectionMapId;
  }
}

export function applySectionMapUpdate(map: SectionMapRecord, input: UpdateSectionMapInput): void {
  if (input.name !== undefined) {
    map.name = input.name;
  }
  if (input.diagramId !== undefined) {
    map.diagramId = input.diagramId;
  }
  if (input.diagramVersionId !== undefined) {
    map.diagramVersionId = input.diagramVersionId;
  }
  if (input.sourceMapId !== undefined) {
    map.sourceMapId = input.sourceMapId;
  }
  if (input.diagramWidth !== undefined) {
    map.diagramWidth = input.diagramWidth;
  }
  if (input.diagramHeight !== undefined) {
    map.diagramHeight = input.diagramHeight;
  }
  if (input.diagramKind !== undefined) {
    map.diagramKind = input.diagramKind;
  }
  if (input.imageTransform !== undefined) {
    map.imageTransform = normalizeSectionMapImageTransform(input.imageTransform);
  }
  if (input.status !== undefined) {
    map.status = input.status;
  }
}

export function applySectionUpdate(section: SectionRecord, input: UpdateSectionInput): void {
  if (input.sectionKey !== undefined) {
    section.sectionKey = input.sectionKey;
  }
  if (input.sectionNo !== undefined) {
    section.sectionNo = input.sectionNo;
  }
  if (input.name !== undefined) {
    section.name = input.name;
  }
  if (input.color !== undefined) {
    section.color = input.color;
  }
  if (input.thumbnailFallback !== undefined) {
    section.thumbnailFallback = input.thumbnailFallback;
  }
  if (input.labelNormalized !== undefined) {
    section.labelNormalized = input.labelNormalized;
  }
  if (input.polygonNormalized !== undefined) {
    section.polygonNormalized = input.polygonNormalized;
  }
}

export function buildEquipmentAssignment(
  sectionId: string,
  input: {
    equipmentId?: string;
    equipmentName: string;
    assetCode?: string;
    system?: string;
  },
  sortOrder: number
): EquipmentAssignmentRecord {
  return {
    id: randomUUID(),
    sectionId,
    equipmentId: input.equipmentId ?? null,
    equipmentName: input.equipmentName,
    assetCode: input.assetCode ?? null,
    system: input.system ?? null,
    sortOrder,
  };
}

export function applyEquipmentAssignmentUpdate(
  assignment: EquipmentAssignmentRecord,
  input: UpdateAssignmentInput
): void {
  if (input.equipmentId !== undefined) {
    assignment.equipmentId = input.equipmentId;
  }
  if (input.equipmentName !== undefined) {
    assignment.equipmentName = input.equipmentName;
  }
  if (input.assetCode !== undefined) {
    assignment.assetCode = input.assetCode;
  }
  if (input.system !== undefined) {
    assignment.system = input.system;
  }
}

export function notFound(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 404 });
}
