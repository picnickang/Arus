import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  CreateSectionInput,
  DiagramUploadInput,
  NormalizedPoint,
  SectionMapRecord,
  ThumbnailUploadInput,
  ValidationIssue,
  ValidationSummary,
  VesselDiagramType,
} from "../domain/types";
import { vesselDiagramTypeValues } from "../domain/types";

const normalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const MAX_DIAGRAM_BYTES = 15 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const SVG_MIME_TYPES = new Set(["image/svg+xml", "application/svg+xml"]);
const DIAGRAM_MIME_TYPES = new Set([
  "image/svg+xml",
  "application/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);
const THUMBNAIL_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

const SVG_BLOCK_PATTERNS: Array<{ code: string; pattern: RegExp; message: string }> = [
  { code: "svg_script", pattern: /<\s*script\b/i, message: "SVG scripts are not allowed" },
  {
    code: "svg_event_handler",
    pattern: /\son[a-z]+\s*=/i,
    message: "SVG event-handler attributes are not allowed",
  },
  {
    code: "svg_javascript_url",
    pattern: /javascript\s*:/i,
    message: "SVG javascript URLs are not allowed",
  },
  {
    code: "svg_external_reference",
    pattern: /\b(?:href|xlink:href)\s*=\s*["'](?:https?:)?\/\//i,
    message: "SVG external references are not allowed",
  },
  {
    code: "svg_foreign_object",
    pattern: /<\s*foreignObject\b/i,
    message: "SVG foreignObject content is not allowed",
  },
  {
    code: "svg_inline_style_import",
    pattern: /@import\s+url/i,
    message: "SVG style imports are not allowed",
  },
];

export function isDiagramType(value: string): value is VesselDiagramType {
  return (vesselDiagramTypeValues as readonly string[]).includes(value);
}

export function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() ?? "diagram";
  return baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "diagram";
}

function objectKeyFor(orgId: string, vesselId: string, scope: string, fileName: string): string {
  return `vessel-intelligence/orgs/${orgId}/vessels/${vesselId}/${scope}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

function isSvg(mimeType: string, originalFileName: string): boolean {
  return SVG_MIME_TYPES.has(mimeType) || originalFileName.toLowerCase().endsWith(".svg");
}

function hasSignature(content: Buffer, signature: ReadonlyArray<number>): boolean {
  return content.length >= signature.length && signature.every((byte, index) => content[index] === byte);
}

function hasWebpSignature(content: Buffer): boolean {
  return (
    content.length >= 12 &&
    content.subarray(0, 4).toString("ascii") === "RIFF" &&
    content.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function validateBinarySignature(
  mimeType: string,
  content: Buffer,
  path: string
): ValidationIssue[] {
  if (content.byteLength === 0) {
    return [];
  }

  let valid = true;
  if (mimeType === "image/png") {
    valid = hasSignature(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  } else if (mimeType === "image/jpeg") {
    valid = hasSignature(content, [0xff, 0xd8, 0xff]);
  } else if (mimeType === "image/webp") {
    valid = hasWebpSignature(content);
  } else if (mimeType === "application/pdf") {
    valid = hasSignature(content, [0x25, 0x50, 0x44, 0x46]);
  }

  return valid
    ? []
    : [
        {
          severity: "blocker",
          code: "media_signature_mismatch",
          message: "Uploaded file contents do not match the declared media type",
          path,
        },
      ];
}

export function sanitizeSvgContent(svg: string): {
  sanitizedSvg: string;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  for (const rule of SVG_BLOCK_PATTERNS) {
    if (rule.pattern.test(svg)) {
      issues.push({
        severity: "blocker",
        code: rule.code,
        message: rule.message,
        path: "file",
      });
    }
  }

  const sanitizedSvg = svg
    .replace(/<\?xml[^>]*>/gi, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .trim();

  if (!/^<svg[\s>]/i.test(sanitizedSvg)) {
    issues.push({
      severity: "blocker",
      code: "svg_root_missing",
      message: "SVG uploads must start with an svg root element",
      path: "file",
    });
  }

  return { sanitizedSvg, issues };
}

export function validateDiagramUpload(
  orgId: string,
  vesselId: string,
  input: DiagramUploadInput
): {
  objectKey: string;
  contentSha256: string;
  sanitizedSvg?: string;
  validationSummary: ValidationSummary;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  if (!DIAGRAM_MIME_TYPES.has(input.mimeType)) {
    issues.push({
      severity: "blocker",
      code: "unsupported_media_type",
      message: "Only SVG, PNG, JPG, WEBP, and PDF diagram uploads are allowed",
      path: "mimeType",
    });
  }
  if (input.content.byteLength === 0) {
    issues.push({
      severity: "blocker",
      code: "empty_file",
      message: "Uploaded diagram file is empty",
      path: "file",
    });
  }
  if (input.content.byteLength > MAX_DIAGRAM_BYTES) {
    issues.push({
      severity: "blocker",
      code: "file_too_large",
      message: "Diagram file exceeds the 15 MB limit",
      path: "file",
    });
  }

  let sanitizedSvg: string | undefined;
  if (isSvg(input.mimeType, input.originalFileName)) {
    const result = sanitizeSvgContent(input.content.toString("utf8"));
    sanitizedSvg = result.sanitizedSvg;
    issues.push(...result.issues);
  } else {
    issues.push(...validateBinarySignature(input.mimeType, input.content, "file"));
  }

  const summary = summarizeIssues(issues);
  return {
    objectKey: objectKeyFor(orgId, vesselId, "diagrams", input.originalFileName),
    contentSha256: sha256(input.content),
    ...(sanitizedSvg ? { sanitizedSvg } : {}),
    validationSummary: summary,
    issues,
  };
}

export function validateThumbnailUpload(
  orgId: string,
  vesselId: string,
  input: ThumbnailUploadInput
): {
  objectKey: string;
  contentSha256: string;
  sanitizedSvg?: string;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  if (!THUMBNAIL_MIME_TYPES.has(input.mimeType)) {
    issues.push({
      severity: "blocker",
      code: "unsupported_thumbnail_type",
      message: "Only SVG, PNG, JPG, and WEBP thumbnails are allowed",
      path: "mimeType",
    });
  }
  if (input.content.byteLength === 0) {
    issues.push({
      severity: "blocker",
      code: "empty_thumbnail",
      message: "Thumbnail file is empty",
      path: "file",
    });
  }
  if (input.content.byteLength > MAX_THUMBNAIL_BYTES) {
    issues.push({
      severity: "blocker",
      code: "thumbnail_too_large",
      message: "Thumbnail file exceeds the 5 MB limit",
      path: "file",
    });
  }

  let sanitizedSvg: string | undefined;
  if (isSvg(input.mimeType, input.originalFileName)) {
    const result = sanitizeSvgContent(input.content.toString("utf8"));
    sanitizedSvg = result.sanitizedSvg;
    issues.push(...result.issues);
  } else {
    issues.push(...validateBinarySignature(input.mimeType, input.content, "file"));
  }

  if (issues.some((issue) => issue.severity === "blocker")) {
    throw validationError("Invalid thumbnail upload", issues);
  }

  return {
    objectKey: objectKeyFor(orgId, vesselId, "thumbnails", input.originalFileName),
    contentSha256: sha256(input.content),
    ...(sanitizedSvg ? { sanitizedSvg } : {}),
    issues,
  };
}

export function validateSectionInput(section: CreateSectionInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!/^#[0-9a-f]{6}$/i.test(section.color)) {
    issues.push({
      severity: "warning",
      code: "section_color_non_hex",
      message: "Section color should be a hex color token from the design package",
      path: `sections.${section.sectionKey}.color`,
    });
  }
  if (section.polygonNormalized.length < 3) {
    issues.push({
      severity: "blocker",
      code: "polygon_too_small",
      message: "A section polygon needs at least three normalized points",
      path: `sections.${section.sectionKey}.polygonNormalized`,
    });
  }

  const allPoints = [...section.polygonNormalized, section.labelNormalized];
  for (const [index, point] of allPoints.entries()) {
    const parsed = normalizedPointSchema.safeParse(point);
    if (!parsed.success) {
      issues.push({
        severity: "blocker",
        code: "normalized_point_out_of_range",
        message: "Section geometry points must be normalized between 0 and 1",
        path: `sections.${section.sectionKey}.points.${index}`,
      });
    }
  }

  return issues;
}

export function validateSectionMapDraft(map: SectionMapRecord): {
  summary: ValidationSummary;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  if (map.coordinateMode !== "normalized_percent") {
    issues.push({
      severity: "blocker",
      code: "invalid_coordinate_mode",
      message: "Published section maps must use normalized_percent coordinates",
      path: "coordinateMode",
    });
  }
  if (!map.sections.length) {
    issues.push({
      severity: "blocker",
      code: "empty_section_map",
      message: "A section map must contain at least one section before publish",
      path: "sections",
    });
  }

  const keys = new Set<string>();
  const numbers = new Set<number>();
  for (const section of map.sections) {
    if (keys.has(section.sectionKey)) {
      issues.push({
        severity: "blocker",
        code: "duplicate_section_key",
        message: `Duplicate section key ${section.sectionKey}`,
        path: `sections.${section.sectionKey}`,
      });
    }
    if (numbers.has(section.sectionNo)) {
      issues.push({
        severity: "blocker",
        code: "duplicate_section_number",
        message: `Duplicate section number ${section.sectionNo}`,
        path: `sections.${section.sectionKey}.sectionNo`,
      });
    }
    keys.add(section.sectionKey);
    numbers.add(section.sectionNo);

    const sectionIssues = validateSectionInput({
      sectionKey: section.sectionKey,
      sectionNo: section.sectionNo,
      name: section.name,
      color: section.color,
      polygonNormalized: section.polygonNormalized,
      labelNormalized: section.labelNormalized,
    });
    issues.push(...sectionIssues);

    if (!section.thumbnailFallback) {
      issues.push({
        severity: "warning",
        code: "section_thumbnail_fallback_missing",
        message: `Section ${section.sectionKey} has no thumbnail fallback rule`,
        path: `sections.${section.sectionKey}.thumbnailFallback`,
      });
    }
    if (!section.equipment.length) {
      issues.push({
        severity: "warning",
        code: "section_unassigned",
        message: `Section ${section.sectionKey} has no assigned equipment`,
        path: `sections.${section.sectionKey}.equipment`,
      });
    }
  }

  return { summary: summarizeIssues(issues), issues };
}

export function summarizeIssues(issues: ValidationIssue[]): ValidationSummary {
  return {
    blockers: issues.filter((issue) => issue.severity === "blocker").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    checkedAt: new Date().toISOString(),
  };
}

export function validationError(
  message: string,
  issues: ValidationIssue[]
): Error & {
  statusCode: number;
  issues: ValidationIssue[];
} {
  const error = new Error(message) as Error & { statusCode: number; issues: ValidationIssue[] };
  error.statusCode = 400;
  error.issues = issues;
  return error;
}

export function assertNoBlockers(message: string, issues: ValidationIssue[]): void {
  if (issues.some((issue) => issue.severity === "blocker")) {
    throw validationError(message, issues);
  }
}
