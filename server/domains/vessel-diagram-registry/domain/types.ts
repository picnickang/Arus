import {
  vesselDiagramTypeValues,
  type NormalizedPoint,
  type VesselDiagramStatus,
  type VesselDiagramType,
  type VesselDiagramVersionStatus,
  type VesselSectionMapStatus,
  type VesselValidationSeverity,
  type SectionMapImageTransform,
  type ValidationSummary,
} from "@shared/schema-runtime";

export { vesselDiagramTypeValues };
export type {
  NormalizedPoint,
  VesselDiagramStatus,
  VesselDiagramType,
  VesselDiagramVersionStatus,
  VesselSectionMapStatus,
  VesselValidationSeverity,
  SectionMapImageTransform,
  ValidationSummary,
};

export const DEFAULT_SECTION_MAP_IMAGE_TRANSFORM: SectionMapImageTransform = {
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
};

export function normalizeSectionMapImageTransform(
  input: Partial<SectionMapImageTransform> | null | undefined
): SectionMapImageTransform {
  return {
    scaleX:
      typeof input?.scaleX === "number" ? input.scaleX : DEFAULT_SECTION_MAP_IMAGE_TRANSFORM.scaleX,
    scaleY:
      typeof input?.scaleY === "number" ? input.scaleY : DEFAULT_SECTION_MAP_IMAGE_TRANSFORM.scaleY,
    offsetX:
      typeof input?.offsetX === "number"
        ? input.offsetX
        : DEFAULT_SECTION_MAP_IMAGE_TRANSFORM.offsetX,
    offsetY:
      typeof input?.offsetY === "number"
        ? input.offsetY
        : DEFAULT_SECTION_MAP_IMAGE_TRANSFORM.offsetY,
  };
}

export interface RegistryActor {
  userId?: string | undefined;
}

export interface RegistryContext extends RegistryActor {
  orgId: string;
  vesselId: string;
}

export interface VesselDiagramValidationIssue {
  severity: VesselValidationSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface DiagramRecord {
  id: string;
  vesselId: string;
  diagramType: VesselDiagramType;
  title: string;
  description?: string | null;
  status: VesselDiagramStatus;
  activeVersionId?: string | null;
  currentSectionMapId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface DiagramVersionRecord {
  id: string;
  vesselId: string;
  diagramId: string;
  versionNumber: number;
  status: VesselDiagramVersionStatus;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  contentSha256: string;
  objectKey: string;
  sanitizedSvg?: string | null;
  validationSummary?: ValidationSummary | null;
  uploadedBy?: string | null;
  publishedBy?: string | null;
  publishedAt?: Date | null;
  uploadedAt?: Date | null;
}

export interface EquipmentAssignmentRecord {
  id: string;
  sectionId: string;
  equipmentId?: string | null;
  equipmentName: string;
  assetCode?: string | null;
  system?: string | null;
  sortOrder: number;
}

export interface SectionRecord {
  id: string;
  sectionKey: string;
  sectionNo: number;
  name: string;
  color: string;
  thumbnailFallback?: string | null;
  sortOrder: number;
  polygonNormalized: NormalizedPoint[];
  labelNormalized: NormalizedPoint;
  equipment: EquipmentAssignmentRecord[];
}

export interface SectionMapRecord {
  id: string;
  vesselId: string;
  diagramId?: string | null;
  diagramVersionId?: string | null;
  sourceMapId?: string | null;
  name: string;
  coordinateMode: "normalized_percent";
  diagramWidth: number;
  diagramHeight: number;
  diagramKind: VesselDiagramType;
  imageTransform: SectionMapImageTransform;
  status: VesselSectionMapStatus;
  validationSummary?: ValidationSummary | null;
  publishedAt?: Date | null;
  sections: SectionRecord[];
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface ThumbnailRecord {
  id: string;
  vesselId: string;
  ownerType: "section" | "equipment";
  ownerId: string;
  mapId?: string | null;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  contentSha256: string;
  fallbackMode: string;
  deletedAt?: Date | null;
}

export type RegistryMediaKind =
  | "diagram"
  | "diagram-preview"
  | "section-thumbnail"
  | "equipment-thumbnail";

export interface PersistRegistryMediaInput {
  kind: RegistryMediaKind;
  originalFileName: string;
  mimeType: string;
  content: Buffer;
  objectKeyHint: string;
}

export interface VesselRegistryMediaStore {
  persist(ctx: RegistryContext, input: PersistRegistryMediaInput): Promise<string>;
  archive(ctx: RegistryContext, objectKey: string): Promise<void>;
}

export interface CreateDiagramInput {
  diagramType: VesselDiagramType;
  title: string;
  description?: string | undefined;
}

export interface DiagramUploadInput {
  originalFileName: string;
  mimeType: string;
  content: Buffer;
}

export interface CreateSectionInput {
  sectionKey: string;
  sectionNo: number;
  name: string;
  color: string;
  polygonNormalized: NormalizedPoint[];
  labelNormalized: NormalizedPoint;
  equipment?:
    | Array<{
        equipmentId?: string | undefined;
        equipmentName: string;
        assetCode?: string | undefined;
        system?: string | undefined;
      }>
    | undefined;
  thumbnailFallback?: string | undefined;
}

export interface CreateSectionMapInput {
  name: string;
  diagramId?: string | undefined;
  diagramVersionId?: string | undefined;
  sourceMapId?: string | undefined;
  diagramWidth?: number | undefined;
  diagramHeight?: number | undefined;
  diagramKind?: VesselDiagramType | undefined;
  imageTransform?: SectionMapImageTransform | undefined;
  sections?: CreateSectionInput[] | undefined;
}

export interface UpdateDiagramInput {
  title?: string | undefined;
  description?: string | null | undefined;
  status?: VesselDiagramStatus | undefined;
  activeVersionId?: string | null | undefined;
  currentSectionMapId?: string | null | undefined;
}

export interface UpdateSectionMapInput {
  name?: string | undefined;
  diagramId?: string | null | undefined;
  diagramVersionId?: string | null | undefined;
  sourceMapId?: string | null | undefined;
  diagramWidth?: number | undefined;
  diagramHeight?: number | undefined;
  diagramKind?: VesselDiagramType | undefined;
  imageTransform?: SectionMapImageTransform | undefined;
  status?: VesselSectionMapStatus | undefined;
}

export interface UpdateSectionInput {
  sectionKey?: string | undefined;
  sectionNo?: number | undefined;
  name?: string | undefined;
  color?: string | undefined;
  thumbnailFallback?: string | null | undefined;
  labelNormalized?: NormalizedPoint | undefined;
  polygonNormalized?: NormalizedPoint[] | undefined;
}

export interface UpdateAssignmentInput {
  equipmentId?: string | null | undefined;
  equipmentName?: string | undefined;
  assetCode?: string | null | undefined;
  system?: string | null | undefined;
}

export interface ThumbnailUploadInput {
  ownerType: "section" | "equipment";
  ownerId: string;
  mapId?: string | undefined;
  originalFileName: string;
  mimeType: string;
  content: Buffer;
}

export interface RegistrySummary {
  diagrams: DiagramRecord[];
  activeDiagram?: DiagramRecord | null;
  sectionMaps: SectionMapRecord[];
  activeSectionMap?: SectionMapRecord | null;
  validationIssues: VesselDiagramValidationIssue[];
}

export interface SectionMapTemplateRecord {
  id: string;
  name: string;
  vesselType: string;
  description: string;
  diagramKind: VesselDiagramType;
  diagramWidth: number;
  diagramHeight: number;
  sections: CreateSectionInput[];
}

export interface VesselDiagramRegistryStore {
  listDiagrams(ctx: RegistryContext): Promise<DiagramRecord[]>;
  createDiagram(ctx: RegistryContext, input: CreateDiagramInput): Promise<DiagramRecord>;
  getDiagram(ctx: RegistryContext, diagramId: string): Promise<DiagramRecord | null>;
  updateDiagram(
    ctx: RegistryContext,
    diagramId: string,
    input: UpdateDiagramInput
  ): Promise<DiagramRecord>;
  deleteDiagram(ctx: RegistryContext, diagramId: string): Promise<void>;
  listVersions(ctx: RegistryContext, diagramId: string): Promise<DiagramVersionRecord[]>;
  getVersion(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string
  ): Promise<DiagramVersionRecord | null>;
  addVersion(
    ctx: RegistryContext,
    diagramId: string,
    input: Omit<DiagramVersionRecord, "id" | "vesselId" | "diagramId" | "versionNumber">
  ): Promise<DiagramVersionRecord>;
  setActiveVersion(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string
  ): Promise<DiagramVersionRecord>;
  updateVersionStatus(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string,
    status: VesselDiagramVersionStatus
  ): Promise<DiagramVersionRecord>;
  listSectionMaps(ctx: RegistryContext): Promise<SectionMapRecord[]>;
  createSectionMap(ctx: RegistryContext, input: CreateSectionMapInput): Promise<SectionMapRecord>;
  getSectionMap(ctx: RegistryContext, mapId: string): Promise<SectionMapRecord | null>;
  getSectionMapForVessel(
    ctx: RegistryContext,
    vesselId: string,
    mapId: string
  ): Promise<SectionMapRecord | null>;
  updateSectionMap(
    ctx: RegistryContext,
    mapId: string,
    input: UpdateSectionMapInput
  ): Promise<SectionMapRecord>;
  deleteSectionMap(ctx: RegistryContext, mapId: string): Promise<void>;
  cloneSectionMap(
    ctx: RegistryContext,
    mapId: string,
    input: { name: string; diagramId?: string | undefined; diagramVersionId?: string | undefined }
  ): Promise<SectionMapRecord>;
  addSection(
    ctx: RegistryContext,
    mapId: string,
    input: CreateSectionInput
  ): Promise<SectionRecord>;
  updateSection(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: UpdateSectionInput
  ): Promise<SectionRecord>;
  deleteSection(ctx: RegistryContext, mapId: string, sectionId: string): Promise<void>;
  updateSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: { polygonNormalized: NormalizedPoint[]; labelNormalized: NormalizedPoint }
  ): Promise<SectionRecord>;
  deleteSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string
  ): Promise<SectionRecord>;
  publishSectionMap(
    ctx: RegistryContext,
    mapId: string,
    validation: { summary: ValidationSummary; issues: VesselDiagramValidationIssue[] }
  ): Promise<SectionMapRecord>;
  assignEquipment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: {
      equipmentId?: string | undefined;
      equipmentName: string;
      assetCode?: string | undefined;
      system?: string | undefined;
    }
  ): Promise<EquipmentAssignmentRecord>;
  listEquipmentAssignments(
    ctx: RegistryContext,
    mapId: string
  ): Promise<EquipmentAssignmentRecord[]>;
  updateEquipmentAssignment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    assignmentId: string,
    input: UpdateAssignmentInput
  ): Promise<EquipmentAssignmentRecord>;
  deleteEquipmentAssignment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    assignmentId: string
  ): Promise<void>;
  saveValidationResults(
    ctx: RegistryContext,
    refs: { mapId?: string; diagramId?: string; diagramVersionId?: string },
    issues: VesselDiagramValidationIssue[]
  ): Promise<void>;
  listValidationResults(
    ctx: RegistryContext,
    refs?: { mapId?: string }
  ): Promise<VesselDiagramValidationIssue[]>;
  upsertThumbnail(
    ctx: RegistryContext,
    input: Omit<ThumbnailRecord, "id" | "vesselId">
  ): Promise<ThumbnailRecord>;
  getThumbnail(
    ctx: RegistryContext,
    ownerType: "section" | "equipment",
    ownerId: string
  ): Promise<ThumbnailRecord | null>;
  deleteThumbnail(
    ctx: RegistryContext,
    ownerType: "section" | "equipment",
    ownerId: string
  ): Promise<void>;
}
