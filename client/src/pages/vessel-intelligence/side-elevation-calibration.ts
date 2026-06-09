import type { SectionMapImageTransform } from "@shared/schema-runtime";
import type { VesselSectionMapDefinition } from "./registry";

export const IMAGE_SCALE_MIN = 0.75;
export const IMAGE_SCALE_MAX = 1.35;
export const IMAGE_SCALE_STEP = 0.05;
export const IMAGE_OFFSET_MIN = -0.2;
export const IMAGE_OFFSET_MAX = 0.2;
export const IMAGE_OFFSET_STEP = 0.01;

export const DEFAULT_IMAGE_TRANSFORM: SectionMapImageTransform = {
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
};

export function clampImageScale(value: number): number {
  return Math.min(IMAGE_SCALE_MAX, Math.max(IMAGE_SCALE_MIN, Number(value.toFixed(2))));
}

export function clampImageOffset(value: number): number {
  return Math.min(IMAGE_OFFSET_MAX, Math.max(IMAGE_OFFSET_MIN, Number(value.toFixed(2))));
}

export function normalizeImageTransform(
  input: Partial<SectionMapImageTransform> | null | undefined
): SectionMapImageTransform {
  return {
    scaleX: clampImageScale(input?.scaleX ?? DEFAULT_IMAGE_TRANSFORM.scaleX),
    scaleY: clampImageScale(input?.scaleY ?? DEFAULT_IMAGE_TRANSFORM.scaleY),
    offsetX: clampImageOffset(input?.offsetX ?? DEFAULT_IMAGE_TRANSFORM.offsetX),
    offsetY: clampImageOffset(input?.offsetY ?? DEFAULT_IMAGE_TRANSFORM.offsetY),
  };
}

export function imageTransformsEqual(
  left: SectionMapImageTransform,
  right: SectionMapImageTransform
): boolean {
  return (
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY &&
    left.offsetX === right.offsetX &&
    left.offsetY === right.offsetY
  );
}

export function imageFrameForScale(
  sectionMap: VesselSectionMapDefinition,
  baseImageScaleX = 1,
  baseImageScaleY = 1,
  baseImageOffsetX = 0,
  baseImageOffsetY = 0
): { x: number; y: number; width: number; height: number } {
  const scaleX = clampImageScale(baseImageScaleX);
  const scaleY = clampImageScale(baseImageScaleY);
  const offsetX = clampImageOffset(baseImageOffsetX);
  const offsetY = clampImageOffset(baseImageOffsetY);
  const width = sectionMap.diagramWidth * scaleX;
  const height = sectionMap.diagramHeight * scaleY;
  return {
    x: (sectionMap.diagramWidth - width) / 2 + offsetX * sectionMap.diagramWidth,
    y: (sectionMap.diagramHeight - height) / 2 + offsetY * sectionMap.diagramHeight,
    width,
    height,
  };
}
