import {
  vesselDiagrams,
  vesselDiagramVersions,
  vesselSections,
  vesselSectionPolygons,
  vesselSectionEquipmentAssignments,
  vesselDiagramValidationResults,
} from "@shared/schema-runtime";
import type {
  DiagramRecord,
  DiagramVersionRecord,
  EquipmentAssignmentRecord,
  SectionRecord,
  ValidationSummary,
  VesselDiagramValidationIssue,
} from "../domain/types";

type SectionRow = typeof vesselSections.$inferSelect;
type PolygonRow = typeof vesselSectionPolygons.$inferSelect;

export function mapDiagram(row: typeof vesselDiagrams.$inferSelect): DiagramRecord {
  return {
    id: row.id,
    vesselId: row.vesselId,
    diagramType: row.diagramType,
    title: row.title,
    description: row.description,
    status: row.status,
    activeVersionId: row.activeVersionId,
    currentSectionMapId: row.currentSectionMapId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapVersion(row: typeof vesselDiagramVersions.$inferSelect): DiagramVersionRecord {
  return {
    id: row.id,
    vesselId: row.vesselId,
    diagramId: row.diagramId,
    versionNumber: row.versionNumber,
    status: row.status,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    contentSha256: row.contentSha256,
    objectKey: row.objectKey,
    sanitizedSvg: row.sanitizedSvg,
    validationSummary: normalizeSummary(row.validationSummary),
    uploadedBy: row.uploadedBy,
    publishedBy: row.publishedBy ?? null,
    publishedAt: row.publishedAt ?? null,
    uploadedAt: row.uploadedAt,
  };
}

export function normalizeSummary(
  summary: { blockers: number; warnings: number; checkedAt?: string } | null | undefined
): ValidationSummary | null {
  if (!summary) {
    return null;
  }
  return {
    blockers: summary.blockers,
    warnings: summary.warnings,
    checkedAt: summary.checkedAt ?? new Date(0).toISOString(),
  };
}

export function mapAssignment(
  row: typeof vesselSectionEquipmentAssignments.$inferSelect
): EquipmentAssignmentRecord {
  return {
    id: row.id,
    sectionId: row.sectionId,
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName,
    assetCode: row.assetCode,
    system: row.system,
    sortOrder: row.sortOrder,
  };
}

export function mapIssue(
  row: typeof vesselDiagramValidationResults.$inferSelect
): VesselDiagramValidationIssue {
  return {
    severity: row.severity,
    code: row.code,
    message: row.message,
    ...(row.path ? { path: row.path } : {}),
  };
}

export function hydrateSection(
  section: SectionRow,
  polygons: PolygonRow[],
  assignments: Array<typeof vesselSectionEquipmentAssignments.$inferSelect>
): SectionRecord {
  const polygon = polygons.find((item) => item.sectionId === section.id);
  return {
    id: section.id,
    sectionKey: section.sectionKey,
    sectionNo: section.sectionNo,
    name: section.name,
    color: section.color,
    thumbnailFallback: section.thumbnailFallback,
    sortOrder: section.sortOrder,
    polygonNormalized: polygon?.pointsNormalized ?? [],
    labelNormalized: polygon?.labelNormalized ?? { x: 0.5, y: 0.5 },
    equipment: assignments.filter((item) => item.sectionId === section.id).map(mapAssignment),
  };
}

export function notFound(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 404 });
}
