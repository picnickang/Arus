import { z } from "zod";
import { vesselDiagramTypeValues } from "../domain/types";

export const vesselParamsSchema = z.object({ vesselId: z.string().min(1) });
// Comma-separated vessel ids for the batch summaries endpoint; capped so a
// single request cannot fan out unboundedly.
export const summariesQuerySchema = z.object({
  vesselIds: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().min(1).max(120)).min(1).max(100)),
});
export const diagramParamsSchema = vesselParamsSchema.extend({ diagramId: z.string().min(1) });
export const versionParamsSchema = diagramParamsSchema.extend({ versionId: z.string().min(1) });
export const mapParamsSchema = vesselParamsSchema.extend({ mapId: z.string().min(1) });
export const sectionParamsSchema = mapParamsSchema.extend({ sectionId: z.string().min(1) });
export const assignmentParamsSchema = sectionParamsSchema.extend({
  assignmentId: z.string().min(1),
});
export const templateParamsSchema = z.object({ templateId: z.string().min(1) });
export const thumbnailSectionParamsSchema = vesselParamsSchema.extend({
  sectionId: z.string().min(1),
});
export const thumbnailEquipmentParamsSchema = vesselParamsSchema.extend({
  equipmentId: z.string().min(1),
});

export const createDiagramSchema = z.object({
  diagramType: z.enum(vesselDiagramTypeValues),
  title: z.string().min(1).max(180),
  description: z.string().max(1000).optional(),
});

export const updateDiagramSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  activeVersionId: z.string().min(1).nullable().optional(),
  currentSectionMapId: z.string().min(1).nullable().optional(),
});

const normalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const imageTransformSchema = z.object({
  scaleX: z.number().min(0.75).max(1.35),
  scaleY: z.number().min(0.75).max(1.35),
  offsetX: z.number().min(-0.2).max(0.2),
  offsetY: z.number().min(-0.2).max(0.2),
});

export const sectionSchema = z.object({
  sectionKey: z.string().min(1).max(120),
  sectionNo: z.number().int().positive(),
  name: z.string().min(1).max(180),
  color: z.string().min(1).max(24),
  polygonNormalized: z.array(normalizedPointSchema).min(3),
  labelNormalized: normalizedPointSchema,
  thumbnailFallback: z.string().max(300).optional(),
  equipment: z
    .array(
      z.object({
        equipmentId: z.string().min(1).optional(),
        equipmentName: z.string().min(1).max(180),
        assetCode: z.string().max(120).optional(),
        system: z.string().max(120).optional(),
      })
    )
    .optional(),
});

export const createSectionMapSchema = z.object({
  name: z.string().min(1).max(180),
  diagramId: z.string().min(1).optional(),
  diagramVersionId: z.string().min(1).optional(),
  sourceMapId: z.string().min(1).optional(),
  diagramWidth: z.number().int().positive().optional(),
  diagramHeight: z.number().int().positive().optional(),
  diagramKind: z.enum(vesselDiagramTypeValues).optional(),
  imageTransform: imageTransformSchema.optional(),
  sections: z.array(sectionSchema).optional(),
});

export const updateSectionMapSchema = z.object({
  name: z.string().min(1).max(180).optional(),
  diagramId: z.string().min(1).nullable().optional(),
  diagramVersionId: z.string().min(1).nullable().optional(),
  sourceMapId: z.string().min(1).nullable().optional(),
  diagramWidth: z.number().int().positive().optional(),
  diagramHeight: z.number().int().positive().optional(),
  diagramKind: z.enum(vesselDiagramTypeValues).optional(),
  imageTransform: imageTransformSchema.optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const cloneMapSchema = z.object({
  name: z.string().min(1).max(180),
  diagramId: z.string().min(1).optional(),
  diagramVersionId: z.string().min(1).optional(),
});

export const assignEquipmentSchema = z.object({
  equipmentId: z.string().min(1).optional(),
  equipmentName: z.string().min(1).max(180),
  assetCode: z.string().max(120).optional(),
  system: z.string().max(120).optional(),
});

export const updateEquipmentSchema = z.object({
  equipmentId: z.string().min(1).nullable().optional(),
  equipmentName: z.string().min(1).max(180).optional(),
  assetCode: z.string().max(120).nullable().optional(),
  system: z.string().max(120).nullable().optional(),
});

export const updateSectionSchema = z.object({
  sectionKey: z.string().min(1).max(120).optional(),
  sectionNo: z.number().int().positive().optional(),
  name: z.string().min(1).max(180).optional(),
  color: z.string().min(1).max(24).optional(),
  thumbnailFallback: z.string().max(300).nullable().optional(),
  polygonNormalized: z.array(normalizedPointSchema).min(3).optional(),
  labelNormalized: normalizedPointSchema.optional(),
});

export const polygonSchema = z.object({
  polygonNormalized: z.array(normalizedPointSchema).min(3),
  labelNormalized: normalizedPointSchema,
});

export const importSectionMapSchema = z.object({
  sourceVesselId: z.string().min(1),
  sourceMapId: z.string().min(1),
  name: z.string().min(1).max(180),
  diagramId: z.string().min(1).optional(),
  diagramVersionId: z.string().min(1).optional(),
});

export const fromTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1).max(180).optional(),
  diagramId: z.string().min(1).optional(),
  diagramVersionId: z.string().min(1).optional(),
});
