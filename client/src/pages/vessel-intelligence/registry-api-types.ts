import type { RegistrySectionMapRecord } from "./data";

export interface RegistryDiagramVersionRecord {
  id: string;
  vesselId: string;
  diagramId: string;
  versionNumber: number;
  status: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy?: string | null;
  uploadedAt?: string | Date | null;
  publishedBy?: string | null;
  publishedAt?: string | Date | null;
  mediaUrl?: string;
}

export interface RegistrySectionMapTemplateRecord {
  id: string;
  name: string;
  vesselType: string;
  description: string;
  diagramKind: string;
  diagramWidth: number;
  diagramHeight: number;
  sections: Array<{ name: string; sectionKey: string; color: string }>;
}

export interface RegistryValidationResult {
  summary: { blockers: number; warnings: number; checkedAt: string };
  issues: Array<{ severity: "blocker" | "warning"; code: string; message: string; path?: string }>;
}

export type ReplacementBehavior = "keep_existing" | "start_blank" | "copy_vessel" | "copy_template";

export interface UploadDiagramVersionInput {
  vesselId: string;
  diagramId: string;
  file: File;
  replacementBehavior?: ReplacementBehavior;
  sourceVesselId?: string | undefined;
  sourceMapId?: string | undefined;
  templateId?: string | undefined;
  mapName?: string | undefined;
}

export interface UploadDiagramVersionResult {
  version?: RegistryDiagramVersionRecord;
  draftMap?: RegistrySectionMapRecord | null;
  warnings?: string[];
  id?: string;
}

export type MutationMessage = {
  success: string;
  failure: string;
};
