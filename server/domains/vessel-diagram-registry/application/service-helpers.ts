import type {
  CreateSectionInput,
  RegistryContext,
  SectionMapRecord,
  VesselRegistryMediaStore,
} from "../domain/types";

export function notFound(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}

export function validationError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}

export function sectionsFromMap(
  source: SectionMapRecord,
  options: { copyEquipment: boolean }
): CreateSectionInput[] {
  return source.sections.map((section) => ({
    sectionKey: section.sectionKey,
    sectionNo: section.sectionNo,
    name: section.name,
    color: section.color,
    polygonNormalized: section.polygonNormalized,
    labelNormalized: section.labelNormalized,
    thumbnailFallback:
      section.thumbnailFallback ??
      "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    equipment: options.copyEquipment
      ? section.equipment.map((assignment) => ({
          equipmentId: assignment.equipmentId ?? undefined,
          equipmentName: assignment.equipmentName,
          assetCode: assignment.assetCode ?? undefined,
          system: assignment.system ?? undefined,
        }))
      : [],
  }));
}

export class MetadataOnlyMediaStore implements VesselRegistryMediaStore {
  async persist(_ctx: RegistryContext, input: { objectKeyHint: string }): Promise<string> {
    return input.objectKeyHint;
  }

  async archive(): Promise<void> {}
}

export async function preparePersistedContent(
  mimeType: string,
  content: Buffer,
  sanitizedSvg?: string
): Promise<Buffer> {
  if (sanitizedSvg) {
    return Buffer.from(sanitizedSvg, "utf8");
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
    return content;
  }

  const { default: sharp } = await import("sharp");
  const image = sharp(content, { failOn: "error" }).rotate();
  if (mimeType === "image/png") {
    return image.png().toBuffer();
  }
  if (mimeType === "image/jpeg") {
    return image.jpeg().toBuffer();
  }
  return image.webp().toBuffer();
}
