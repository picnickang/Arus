export const vesselDiagramTypeValues = [
  "side_elevation",
  "deck_plan",
  "machinery_arrangement",
  "electrical_single_line",
  "fire_safety_plan",
  "system_schematic",
  "custom",
] as const;

export type VesselDiagramType = (typeof vesselDiagramTypeValues)[number];
export type VesselSectionMapStatus = "draft" | "published" | "archived";
export type VesselValidationSeverity = "blocker" | "warning";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface RegistryActor {
  userId?: string;
}

export interface RegistryContext extends RegistryActor {
  orgId: string;
  vesselId: string;
}

export interface ValidationIssue {
  severity: VesselValidationSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface ValidationSummary {
  blockers: number;
  warnings: number;
  checkedAt: string;
}

export interface DiagramRecord {
  id: string;
  vesselId: string;
  diagramType: VesselDiagramType;
  title: string;
  description?: string | null;
  status: "draft" | "active" | "archived";
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
  status: "uploaded" | "active" | "superseded" | "rejected";
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  contentSha256: string;
  objectKey: string;
  sanitizedSvg?: string | null;
  validationSummary?: ValidationSummary | null;
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
  description?: string;
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
  equipment?: Array<{
    equipmentId?: string;
    equipmentName: string;
    assetCode?: string;
    system?: string;
  }>;
  thumbnailFallback?: string;
}

export interface CreateSectionMapInput {
  name: string;
  diagramId?: string;
  diagramVersionId?: string;
  diagramWidth?: number;
  diagramHeight?: number;
  diagramKind?: VesselDiagramType;
  sections?: CreateSectionInput[];
}

export interface ThumbnailUploadInput {
  ownerType: "section" | "equipment";
  ownerId: string;
  mapId?: string;
  originalFileName: string;
  mimeType: string;
  content: Buffer;
}

export interface RegistrySummary {
  diagrams: DiagramRecord[];
  activeDiagram?: DiagramRecord | null;
  sectionMaps: SectionMapRecord[];
  activeSectionMap?: SectionMapRecord | null;
  validationIssues: ValidationIssue[];
}

export interface VesselDiagramRegistryStore {
  listDiagrams(ctx: RegistryContext): Promise<DiagramRecord[]>;
  createDiagram(ctx: RegistryContext, input: CreateDiagramInput): Promise<DiagramRecord>;
  getDiagram(ctx: RegistryContext, diagramId: string): Promise<DiagramRecord | null>;
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
  listSectionMaps(ctx: RegistryContext): Promise<SectionMapRecord[]>;
  createSectionMap(ctx: RegistryContext, input: CreateSectionMapInput): Promise<SectionMapRecord>;
  getSectionMap(ctx: RegistryContext, mapId: string): Promise<SectionMapRecord | null>;
  cloneSectionMap(
    ctx: RegistryContext,
    mapId: string,
    input: { name: string }
  ): Promise<SectionMapRecord>;
  publishSectionMap(
    ctx: RegistryContext,
    mapId: string,
    validation: { summary: ValidationSummary; issues: ValidationIssue[] }
  ): Promise<SectionMapRecord>;
  assignEquipment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: {
      equipmentId?: string;
      equipmentName: string;
      assetCode?: string;
      system?: string;
    }
  ): Promise<EquipmentAssignmentRecord>;
  saveValidationResults(
    ctx: RegistryContext,
    refs: { mapId?: string; diagramId?: string; diagramVersionId?: string },
    issues: ValidationIssue[]
  ): Promise<void>;
  listValidationResults(
    ctx: RegistryContext,
    refs?: { mapId?: string }
  ): Promise<ValidationIssue[]>;
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
