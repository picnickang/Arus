import type {
  CreateSectionMapInput,
  DiagramRecord,
  DiagramUploadInput,
  DiagramVersionRecord,
  RegistryContext,
  SectionMapRecord,
} from "../domain/types";
import { sectionsFromMap, validationError } from "./service-helpers";

export interface UploadDiagramVersionBehavior {
  mode?: "keep_existing" | "start_blank" | "copy_vessel" | "copy_template" | undefined;
  sourceVesselId?: string | undefined;
  sourceMapId?: string | undefined;
  templateId?: string | undefined;
  mapName?: string | undefined;
}

interface VersionBehaviorServicePort {
  uploadDiagramVersion(
    ctx: RegistryContext,
    diagramId: string,
    input: DiagramUploadInput
  ): Promise<DiagramVersionRecord>;
  getDiagram(ctx: RegistryContext, diagramId: string): Promise<DiagramRecord>;
  listSectionMaps(ctx: RegistryContext): Promise<SectionMapRecord[]> | SectionMapRecord[];
  createSectionMap(ctx: RegistryContext, input: CreateSectionMapInput): Promise<SectionMapRecord>;
  cloneSectionMapFromVessel(
    ctx: RegistryContext,
    sourceVesselId: string,
    sourceMapId: string,
    input: { name: string; diagramId?: string | undefined; diagramVersionId?: string | undefined }
  ): Promise<SectionMapRecord>;
  createSectionMapFromTemplate(
    ctx: RegistryContext,
    templateId: string,
    input: {
      name?: string | undefined;
      diagramId?: string | undefined;
      diagramVersionId?: string | undefined;
    }
  ): Promise<SectionMapRecord>;
}

export async function uploadDiagramVersionWithBehavior(
  service: VersionBehaviorServicePort,
  ctx: RegistryContext,
  diagramId: string,
  input: DiagramUploadInput,
  behavior: UploadDiagramVersionBehavior
) {
  const version = await service.uploadDiagramVersion(ctx, diagramId, input);
  const diagram = await service.getDiagram(ctx, diagramId);
  const mode = behavior.mode ?? "keep_existing";
  const mapName = behavior.mapName ?? `${diagram.title} v${version.versionNumber} draft map`;
  let draftMap: SectionMapRecord | null = null;
  const warnings: string[] = [];

  if (mode === "keep_existing") {
    const maps = await service.listSectionMaps(ctx);
    const source =
      maps.find((map) => map.id === diagram.currentSectionMapId) ??
      maps.find((map) => map.status === "published") ??
      maps[0];
    if (source) {
      draftMap = await service.createSectionMap(ctx, {
        name: mapName,
        diagramId,
        diagramVersionId: version.id,
        sourceMapId: source.id,
        diagramWidth: source.diagramWidth,
        diagramHeight: source.diagramHeight,
        diagramKind: diagram.diagramType,
        imageTransform: source.imageTransform,
        sections: sectionsFromMap(source, { copyEquipment: true }),
      });
      warnings.push(
        "Existing normalized polygons were cloned as a draft overlay; validate alignment before publishing."
      );
    } else {
      draftMap = await service.createSectionMap(ctx, {
        name: mapName,
        diagramId,
        diagramVersionId: version.id,
        diagramKind: diagram.diagramType,
        sections: [],
      });
      warnings.push("No existing map was available, so a blank draft map was created.");
    }
  }

  if (mode === "start_blank") {
    draftMap = await service.createSectionMap(ctx, {
      name: mapName,
      diagramId,
      diagramVersionId: version.id,
      diagramKind: diagram.diagramType,
      sections: [],
    });
  }

  if (mode === "copy_vessel") {
    if (!behavior.sourceVesselId || !behavior.sourceMapId) {
      throw validationError("Copy from another vessel requires source vessel and map");
    }
    draftMap = await service.cloneSectionMapFromVessel(
      ctx,
      behavior.sourceVesselId,
      behavior.sourceMapId,
      { name: mapName, diagramId, diagramVersionId: version.id }
    );
    warnings.push(
      "Equipment assignments were not copied unless explicitly rematched on this vessel."
    );
  }

  if (mode === "copy_template") {
    draftMap = await service.createSectionMapFromTemplate(
      ctx,
      behavior.templateId ?? "custom_blank",
      {
        name: mapName,
        diagramId,
        diagramVersionId: version.id,
      }
    );
  }

  return { version, draftMap, warnings };
}
