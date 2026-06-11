import {
  addPostgresVersion,
  createPostgresDiagram,
  deletePostgresDiagram,
  getPostgresDiagram,
  getPostgresVersion,
  listPostgresDiagrams,
  listPostgresVersions,
  setPostgresActiveVersion,
  updatePostgresDiagram,
  updatePostgresVersionStatus,
} from "./postgres-diagram-store";
import {
  createPostgresSectionMap,
  clonePostgresSectionMap,
  deletePostgresSectionMap,
  getPostgresSectionMap,
  getPostgresSectionMapForVessel,
  listPostgresSectionMaps,
  updatePostgresSectionMap,
} from "./postgres-section-map-store";
import {
  addPostgresSection,
  deletePostgresSection,
  deletePostgresSectionPolygon,
  publishPostgresSectionMap,
  updatePostgresSection,
  updatePostgresSectionPolygon,
} from "./postgres-section-detail-store";
import {
  assignPostgresEquipment,
  deletePostgresEquipmentAssignment,
  deletePostgresThumbnail,
  getPostgresThumbnail,
  listPostgresEquipmentAssignments,
  listPostgresValidationResults,
  savePostgresValidationResults,
  updatePostgresEquipmentAssignment,
  upsertPostgresThumbnail,
} from "./postgres-assignment-media-store";
import type {
  CreateDiagramInput,
  CreateSectionInput,
  CreateSectionMapInput,
  DiagramRecord,
  DiagramVersionRecord,
  EquipmentAssignmentRecord,
  NormalizedPoint,
  RegistryContext,
  SectionMapRecord,
  SectionRecord,
  ThumbnailRecord,
  UpdateAssignmentInput,
  UpdateDiagramInput,
  UpdateSectionInput,
  UpdateSectionMapInput,
  VesselDiagramRegistryStore,
  VesselDiagramValidationIssue,
  VesselDiagramVersionStatus,
} from "../domain/types";

export class PostgresVesselDiagramRegistryStore implements VesselDiagramRegistryStore {
  async listDiagrams(ctx: RegistryContext): Promise<DiagramRecord[]> {
    return listPostgresDiagrams(ctx);
  }

  async createDiagram(ctx: RegistryContext, input: CreateDiagramInput): Promise<DiagramRecord> {
    return createPostgresDiagram(ctx, input);
  }

  async getDiagram(ctx: RegistryContext, diagramId: string): Promise<DiagramRecord | null> {
    return getPostgresDiagram(ctx, diagramId);
  }

  async updateDiagram(ctx: RegistryContext, diagramId: string, input: UpdateDiagramInput): Promise<DiagramRecord> {
    return updatePostgresDiagram(ctx, diagramId, input);
  }

  async deleteDiagram(ctx: RegistryContext, diagramId: string): Promise<void> {
    return deletePostgresDiagram(ctx, diagramId);
  }

  async listVersions(ctx: RegistryContext, diagramId: string): Promise<DiagramVersionRecord[]> {
    return listPostgresVersions(ctx, diagramId);
  }

  async getVersion(ctx: RegistryContext, diagramId: string, versionId: string): Promise<DiagramVersionRecord | null> {
    return getPostgresVersion(ctx, diagramId, versionId);
  }

  async addVersion(ctx: RegistryContext, diagramId: string, input: Omit<DiagramVersionRecord, "id" | "vesselId" | "diagramId" | "versionNumber">): Promise<DiagramVersionRecord> {
    return addPostgresVersion(ctx, diagramId, input);
  }

  async setActiveVersion(ctx: RegistryContext, diagramId: string, versionId: string): Promise<DiagramVersionRecord> {
    return setPostgresActiveVersion(ctx, diagramId, versionId);
  }

  async updateVersionStatus(ctx: RegistryContext, diagramId: string, versionId: string, status: VesselDiagramVersionStatus): Promise<DiagramVersionRecord> {
    return updatePostgresVersionStatus(ctx, diagramId, versionId, status);
  }

  async listSectionMaps(ctx: RegistryContext): Promise<SectionMapRecord[]> {
    return listPostgresSectionMaps(ctx);
  }

  async createSectionMap(ctx: RegistryContext, input: CreateSectionMapInput): Promise<SectionMapRecord> {
    return createPostgresSectionMap(ctx, input);
  }

  async getSectionMap(ctx: RegistryContext, mapId: string): Promise<SectionMapRecord | null> {
    return getPostgresSectionMap(ctx, mapId);
  }

  async getSectionMapForVessel(ctx: RegistryContext, vesselId: string, mapId: string): Promise<SectionMapRecord | null> {
    return getPostgresSectionMapForVessel(ctx, vesselId, mapId);
  }

  async updateSectionMap(ctx: RegistryContext, mapId: string, input: UpdateSectionMapInput): Promise<SectionMapRecord> {
    return updatePostgresSectionMap(ctx, mapId, input);
  }

  async deleteSectionMap(ctx: RegistryContext, mapId: string): Promise<void> {
    return deletePostgresSectionMap(ctx, mapId);
  }

  async cloneSectionMap(ctx: RegistryContext, mapId: string, input: { name: string; diagramId?: string; diagramVersionId?: string }): Promise<SectionMapRecord> {
    return clonePostgresSectionMap(ctx, mapId, input);
  }

  async addSection(ctx: RegistryContext, mapId: string, input: CreateSectionInput): Promise<SectionRecord> {
    return addPostgresSection(ctx, mapId, input);
  }

  async updateSection(ctx: RegistryContext, mapId: string, sectionId: string, input: UpdateSectionInput): Promise<SectionRecord> {
    return updatePostgresSection(ctx, mapId, sectionId, input);
  }

  async deleteSection(ctx: RegistryContext, mapId: string, sectionId: string): Promise<void> {
    return deletePostgresSection(ctx, mapId, sectionId);
  }

  async updateSectionPolygon(ctx: RegistryContext, mapId: string, sectionId: string, input: { polygonNormalized: NormalizedPoint[]; labelNormalized: NormalizedPoint }): Promise<SectionRecord> {
    return updatePostgresSectionPolygon(ctx, mapId, sectionId, input);
  }

  async deleteSectionPolygon(ctx: RegistryContext, mapId: string, sectionId: string): Promise<SectionRecord> {
    return deletePostgresSectionPolygon(ctx, mapId, sectionId);
  }

  async publishSectionMap(ctx: RegistryContext, mapId: string, validation: { summary: SectionMapRecord["validationSummary"]; issues: VesselDiagramValidationIssue[] }): Promise<SectionMapRecord> {
    return publishPostgresSectionMap(ctx, mapId, validation);
  }

  async assignEquipment(ctx: RegistryContext, mapId: string, sectionId: string, input: { equipmentId?: string; equipmentName: string; assetCode?: string; system?: string }): Promise<EquipmentAssignmentRecord> {
    return assignPostgresEquipment(ctx, mapId, sectionId, input);
  }

  async listEquipmentAssignments(ctx: RegistryContext, mapId: string): Promise<EquipmentAssignmentRecord[]> {
    return listPostgresEquipmentAssignments(ctx, mapId);
  }

  async updateEquipmentAssignment(ctx: RegistryContext, mapId: string, sectionId: string, assignmentId: string, input: UpdateAssignmentInput): Promise<EquipmentAssignmentRecord> {
    return updatePostgresEquipmentAssignment(ctx, mapId, sectionId, assignmentId, input);
  }

  async deleteEquipmentAssignment(ctx: RegistryContext, mapId: string, sectionId: string, assignmentId: string): Promise<void> {
    return deletePostgresEquipmentAssignment(ctx, mapId, sectionId, assignmentId);
  }

  async saveValidationResults(ctx: RegistryContext, refs: { mapId?: string; diagramId?: string; diagramVersionId?: string }, issues: VesselDiagramValidationIssue[]): Promise<void> {
    return savePostgresValidationResults(ctx, refs, issues);
  }

  async listValidationResults(ctx: RegistryContext, refs?: { mapId?: string }): Promise<VesselDiagramValidationIssue[]> {
    return listPostgresValidationResults(ctx, refs);
  }

  async upsertThumbnail(ctx: RegistryContext, input: Omit<ThumbnailRecord, "id" | "vesselId">): Promise<ThumbnailRecord> {
    return upsertPostgresThumbnail(ctx, input);
  }

  async getThumbnail(ctx: RegistryContext, ownerType: "section" | "equipment", ownerId: string): Promise<ThumbnailRecord | null> {
    return getPostgresThumbnail(ctx, ownerType, ownerId);
  }

  async deleteThumbnail(ctx: RegistryContext, ownerType: "section" | "equipment", ownerId: string): Promise<void> {
    return deletePostgresThumbnail(ctx, ownerType, ownerId);
  }
}

export const postgresVesselDiagramRegistryStore = new PostgresVesselDiagramRegistryStore();
