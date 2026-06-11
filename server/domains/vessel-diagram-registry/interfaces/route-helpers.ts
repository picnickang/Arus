import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import type { ActionCode } from "../../../config/permission-registry";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { requirePermission } from "../../../lib/permissions/middleware.js";
import { VesselDiagramRegistryService } from "../application/service";
import { ObjectStorageVesselRegistryMediaStore } from "../infrastructure/object-storage-media-store.js";
import { postgresVesselDiagramRegistryStore } from "../infrastructure/postgres-store.js";
import type {
  DiagramVersionRecord,
  RegistryContext,
  ThumbnailRecord,
  VesselRegistryMediaStore,
} from "../domain/types";

export interface RegistryMediaResponder extends VesselRegistryMediaStore {
  send(ctx: RegistryContext, objectKey: string, res: Response): Promise<void>;
}

export interface VesselDiagramPermissionDeps {
  permissionMode?: "enforce" | "skip";
}

const uploadBehaviorSchema = z.object({
  mode: z.enum(["keep_existing", "start_blank", "copy_vessel", "copy_template"]),
  sourceVesselId: z.string().min(1).optional(),
  sourceMapId: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  mapName: z.string().min(1).max(180).optional(),
});

const jsonUploadSchema = z.object({
  originalFileName: z.string().min(1).max(220),
  mimeType: z.string().min(1).max(120),
  contentBase64: z.string().min(1),
});

export function serviceResolver(
  injected: VesselDiagramRegistryService | undefined,
  getMediaStore: () => Promise<RegistryMediaResponder>
) {
  let service = injected;
  return async () => {
    if (service) {
      return service;
    }
    service = new VesselDiagramRegistryService(
      postgresVesselDiagramRegistryStore,
      await getMediaStore()
    );
    return service;
  };
}

export function mediaStoreResolver(injected?: RegistryMediaResponder) {
  let mediaStore = injected;
  return async () => {
    if (mediaStore) {
      return mediaStore;
    }
    mediaStore = new ObjectStorageVesselRegistryMediaStore();
    return mediaStore;
  };
}

export function permission(deps: VesselDiagramPermissionDeps, action: ActionCode): RequestHandler {
  if (deps.permissionMode === "skip") {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return async (req: Request, res: Response, next: NextFunction) => {
    return requirePermission("vessel-intelligence", action)(req, res, next);
  };
}

export function context(req: AuthenticatedRequest, params: { vesselId: string }) {
  return {
    orgId: req.orgId,
    vesselId: params.vesselId,
    userId: req.user?.id,
  };
}

export function versionResponse(
  params: { vesselId: string; diagramId: string },
  version: DiagramVersionRecord
) {
  const { objectKey, ...safeVersion } = version;
  void objectKey;
  return {
    ...safeVersion,
    mediaUrl:
      `/api/vessel-intelligence/${params.vesselId}/diagrams/` +
      `${params.diagramId}/versions/${version.id}/media`,
  };
}

export function thumbnailResponse(params: { vesselId: string }, thumbnail: ThumbnailRecord) {
  const { objectKey, ...safeThumbnail } = thumbnail;
  void objectKey;
  const ownerPath =
    thumbnail.ownerType === "section"
      ? `sections/${thumbnail.ownerId}/thumbnail`
      : `equipment/${thumbnail.ownerId}/thumbnail`;
  return {
    ...safeThumbnail,
    mediaUrl: `/api/vessel-intelligence/${params.vesselId}/${ownerPath}`,
  };
}

export function parseUploadBehavior(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const mode = readString(record["replacementBehavior"]) ?? readString(record["mode"]);
  if (!mode) {
    return null;
  }
  return uploadBehaviorSchema.parse({
    mode,
    sourceVesselId: readString(record["sourceVesselId"]),
    sourceMapId: readString(record["sourceMapId"]),
    templateId: readString(record["templateId"]),
    mapName: readString(record["mapName"]),
  });
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function parseUpload(req: Request): {
  originalFileName: string;
  mimeType: string;
  content: Buffer;
} {
  const multipartFile = req.file;
  if (multipartFile) {
    return {
      originalFileName: multipartFile.originalname,
      mimeType: multipartFile.mimetype,
      content: multipartFile.buffer,
    };
  }

  const parsed = jsonUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = new Error(
      "File upload requires multipart file or JSON contentBase64"
    ) as Error & {
      statusCode: number;
    };
    error.statusCode = 400;
    throw error;
  }

  return {
    originalFileName: parsed.data.originalFileName,
    mimeType: parsed.data.mimeType,
    content: Buffer.from(parsed.data.contentBase64, "base64"),
  };
}
