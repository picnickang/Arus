import multer from "multer";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";
import { requireOrgId, type AuthenticatedRequest } from "../../../middleware/auth";
import type { ActionCode } from "../../../config/permission-registry";
import { withErrorHandling } from "../../../lib/route-utils";
import { enforceQuota } from "../../../middleware/tenant-quota";
import { VesselDiagramRegistryService } from "../application/service";
import {
  vesselDiagramTypeValues,
  type DiagramVersionRecord,
  type RegistryContext,
  type ThumbnailRecord,
  type VesselDiagramType,
  type VesselRegistryMediaStore,
} from "../domain/types";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const vesselParamsSchema = z.object({ vesselId: z.string().min(1) });
const diagramParamsSchema = vesselParamsSchema.extend({ diagramId: z.string().min(1) });
const versionParamsSchema = diagramParamsSchema.extend({ versionId: z.string().min(1) });
const mapParamsSchema = vesselParamsSchema.extend({ mapId: z.string().min(1) });
const sectionParamsSchema = mapParamsSchema.extend({ sectionId: z.string().min(1) });
const thumbnailSectionParamsSchema = vesselParamsSchema.extend({ sectionId: z.string().min(1) });
const thumbnailEquipmentParamsSchema = vesselParamsSchema.extend({
  equipmentId: z.string().min(1),
});

const createDiagramSchema = z.object({
  diagramType: z.enum(vesselDiagramTypeValues),
  title: z.string().min(1).max(180),
  description: z.string().max(1000).optional(),
});

const normalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const sectionSchema = z.object({
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

const createSectionMapSchema = z.object({
  name: z.string().min(1).max(180),
  diagramId: z.string().min(1).optional(),
  diagramVersionId: z.string().min(1).optional(),
  diagramWidth: z.number().int().positive().optional(),
  diagramHeight: z.number().int().positive().optional(),
  diagramKind: z.enum(vesselDiagramTypeValues).optional(),
  sections: z.array(sectionSchema).optional(),
});

const cloneMapSchema = z.object({
  name: z.string().min(1).max(180),
});

const assignEquipmentSchema = z.object({
  equipmentId: z.string().min(1).optional(),
  equipmentName: z.string().min(1).max(180),
  assetCode: z.string().max(120).optional(),
  system: z.string().max(120).optional(),
});

const jsonUploadSchema = z.object({
  originalFileName: z.string().min(1).max(220),
  mimeType: z.string().min(1).max(120),
  contentBase64: z.string().min(1),
});

export interface VesselDiagramRegistryRouteDeps {
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit?: RateLimitRequestHandler;
  storageQuota?: RequestHandler;
  requireOrgId?: RequestHandler;
  service?: VesselDiagramRegistryService;
  mediaStore?: RegistryMediaResponder;
  permissionMode?: "enforce" | "skip";
}

interface RegistryMediaResponder extends VesselRegistryMediaStore {
  send(ctx: RegistryContext, objectKey: string, res: Response): Promise<void>;
}

export function registerVesselDiagramRegistryRoutes(
  app: Express,
  deps: VesselDiagramRegistryRouteDeps
) {
  const getMediaStore = mediaStoreResolver(deps.mediaStore);
  const getService = serviceResolver(deps.service, getMediaStore);
  const orgGate = deps.requireOrgId ?? requireOrgId;
  const writeLimit = deps.writeOperationRateLimit ?? deps.generalApiRateLimit;
  const storageQuota = deps.storageQuota ?? enforceQuota("storage_bytes");
  const readPermission = permission(deps, "view");

  app.get(
    "/api/vessel-intelligence/:vesselId/summary",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling(
      "fetch vessel intelligence summary",
      async (req: AuthenticatedRequest, res) => {
        const ctx = context(req, vesselParamsSchema.parse(req.params));
        const service = await getService();
        res.json(await service.getSummary(ctx));
      }
    )
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/diagrams",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("list vessel diagrams", async (req: AuthenticatedRequest, res) => {
      const ctx = context(req, vesselParamsSchema.parse(req.params));
      const service = await getService();
      res.json(await service.listDiagrams(ctx));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/diagrams",
    orgGate,
    writeLimit,
    permission(deps, "configure"),
    withErrorHandling("create vessel diagram", async (req: AuthenticatedRequest, res) => {
      const ctx = context(req, vesselParamsSchema.parse(req.params));
      const input = createDiagramSchema.parse(req.body);
      const service = await getService();
      res.status(201).json(await service.createDiagram(ctx, input));
    })
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("list vessel diagram versions", async (req: AuthenticatedRequest, res) => {
      const params = diagramParamsSchema.parse(req.params);
      const service = await getService();
      const versions = await service.listVersions(context(req, params), params.diagramId);
      res.json(versions.map((version) => versionResponse(params, version)));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/upload",
    orgGate,
    writeLimit,
    storageQuota,
    permission(deps, "upload-diagram"),
    upload.single("file"),
    withErrorHandling("upload vessel diagram version", async (req: AuthenticatedRequest, res) => {
      const params = diagramParamsSchema.parse(req.params);
      const file = parseUpload(req);
      const service = await getService();
      const version = await service.uploadDiagramVersion(
        context(req, params),
        params.diagramId,
        file
      );
      res.status(201).json(versionResponse(params, version));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/:versionId/set-active",
    orgGate,
    writeLimit,
    permission(deps, "rollback-diagram"),
    withErrorHandling("activate vessel diagram version", async (req: AuthenticatedRequest, res) => {
      const params = versionParamsSchema.parse(req.params);
      const service = await getService();
      const version = await service.setActiveVersion(
        context(req, params),
        params.diagramId,
        params.versionId
      );
      res.json(versionResponse(params, version));
    })
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/:versionId/media",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("download vessel diagram version media", async (req: AuthenticatedRequest, res) => {
      const params = versionParamsSchema.parse(req.params);
      const service = await getService();
      const mediaStore = await getMediaStore();
      const version = await service.getDiagramVersionMedia(context(req, params), params.diagramId, params.versionId);
      await mediaStore.send(context(req, params), version.objectKey, res);
    })
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/section-maps",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("list vessel section maps", async (req: AuthenticatedRequest, res) => {
      const ctx = context(req, vesselParamsSchema.parse(req.params));
      const service = await getService();
      res.json(await service.listSectionMaps(ctx));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/section-maps",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("create vessel section map", async (req: AuthenticatedRequest, res) => {
      const ctx = context(req, vesselParamsSchema.parse(req.params));
      const input = createSectionMapSchema.parse(req.body);
      const service = await getService();
      res.status(201).json(
        await service.createSectionMap(ctx, {
          ...input,
          diagramKind: input.diagramKind as VesselDiagramType | undefined,
        })
      );
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/clone",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("clone vessel section map", async (req: AuthenticatedRequest, res) => {
      const params = mapParamsSchema.parse(req.params);
      const input = cloneMapSchema.parse(req.body);
      const service = await getService();
      res
        .status(201)
        .json(await service.cloneSectionMap(context(req, params), params.mapId, input));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/validate",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("validate vessel section map", async (req: AuthenticatedRequest, res) => {
      const params = mapParamsSchema.parse(req.params);
      const service = await getService();
      res.json(await service.validateSectionMap(context(req, params), params.mapId));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/publish",
    orgGate,
    writeLimit,
    permission(deps, "publish-map"),
    withErrorHandling("publish vessel section map", async (req: AuthenticatedRequest, res) => {
      const params = mapParamsSchema.parse(req.params);
      const service = await getService();
      res.json(await service.publishSectionMap(context(req, params), params.mapId));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/sections/:sectionId/equipment",
    orgGate,
    writeLimit,
    permission(deps, "assign-equipment"),
    withErrorHandling("assign vessel section equipment", async (req: AuthenticatedRequest, res) => {
      const params = sectionParamsSchema.parse(req.params);
      const input = assignEquipmentSchema.parse(req.body);
      const service = await getService();
      res
        .status(201)
        .json(
          await service.assignEquipment(context(req, params), params.mapId, params.sectionId, input)
        );
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/sections/:sectionId/thumbnail/upload",
    orgGate,
    writeLimit,
    storageQuota,
    permission(deps, "replace-section-thumbnail"),
    upload.single("file"),
    withErrorHandling("upload vessel section thumbnail", async (req: AuthenticatedRequest, res) => {
      const params = thumbnailSectionParamsSchema.parse(req.params);
      const file = parseUpload(req);
      const service = await getService();
      const thumbnail = await service.uploadThumbnail(context(req, params), {
        ...file,
        ownerType: "section",
        ownerId: params.sectionId,
      });
      res.status(201).json(thumbnailResponse(params, thumbnail));
    })
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/sections/:sectionId/thumbnail",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("download vessel section thumbnail", async (req: AuthenticatedRequest, res) => {
      const params = thumbnailSectionParamsSchema.parse(req.params);
      const service = await getService();
      const mediaStore = await getMediaStore();
      const thumbnail = await service.getThumbnailMedia(context(req, params), "section", params.sectionId);
      await mediaStore.send(context(req, params), thumbnail.objectKey, res);
    })
  );

  app.delete(
    "/api/vessel-intelligence/:vesselId/sections/:sectionId/thumbnail",
    orgGate,
    writeLimit,
    permission(deps, "replace-section-thumbnail"),
    withErrorHandling("delete vessel section thumbnail", async (req: AuthenticatedRequest, res) => {
      const params = thumbnailSectionParamsSchema.parse(req.params);
      const service = await getService();
      await service.deleteThumbnail(context(req, params), "section", params.sectionId);
      res.status(204).send();
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/equipment/:equipmentId/thumbnail/upload",
    orgGate,
    writeLimit,
    storageQuota,
    permission(deps, "replace-equipment-thumbnail"),
    upload.single("file"),
    withErrorHandling(
      "upload vessel equipment thumbnail",
      async (req: AuthenticatedRequest, res) => {
        const params = thumbnailEquipmentParamsSchema.parse(req.params);
        const file = parseUpload(req);
        const service = await getService();
        const thumbnail = await service.uploadThumbnail(context(req, params), {
          ...file,
          ownerType: "equipment",
          ownerId: params.equipmentId,
        });
        res.status(201).json(thumbnailResponse(params, thumbnail));
      }
    )
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/equipment/:equipmentId/thumbnail",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling(
      "download vessel equipment thumbnail",
      async (req: AuthenticatedRequest, res) => {
        const params = thumbnailEquipmentParamsSchema.parse(req.params);
        const service = await getService();
        const mediaStore = await getMediaStore();
        const thumbnail = await service.getThumbnailMedia(
          context(req, params),
          "equipment",
          params.equipmentId
        );
        await mediaStore.send(context(req, params), thumbnail.objectKey, res);
      }
    )
  );

  app.delete(
    "/api/vessel-intelligence/:vesselId/equipment/:equipmentId/thumbnail",
    orgGate,
    writeLimit,
    permission(deps, "replace-equipment-thumbnail"),
    withErrorHandling(
      "delete vessel equipment thumbnail",
      async (req: AuthenticatedRequest, res) => {
        const params = thumbnailEquipmentParamsSchema.parse(req.params);
        const service = await getService();
        await service.deleteThumbnail(context(req, params), "equipment", params.equipmentId);
        res.status(204).send();
      }
    )
  );
}

function serviceResolver(
  injected: VesselDiagramRegistryService | undefined,
  getMediaStore: () => Promise<RegistryMediaResponder>
) {
  let service = injected;
  return async () => {
    if (service) {
      return service;
    }
    const { postgresVesselDiagramRegistryStore } = await import(
      "../infrastructure/postgres-store.js"
    );
    service = new VesselDiagramRegistryService(
      postgresVesselDiagramRegistryStore,
      await getMediaStore()
    );
    return service;
  };
}

function mediaStoreResolver(injected?: RegistryMediaResponder) {
  let mediaStore = injected;
  return async () => {
    if (mediaStore) {
      return mediaStore;
    }
    const { ObjectStorageVesselRegistryMediaStore } = await import(
      "../infrastructure/object-storage-media-store.js"
    );
    mediaStore = new ObjectStorageVesselRegistryMediaStore();
    return mediaStore;
  };
}

function permission(deps: VesselDiagramRegistryRouteDeps, action: ActionCode): RequestHandler {
  if (deps.permissionMode === "skip") {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return async (req: Request, res: Response, next: NextFunction) => {
    const { requirePermission } = await import("../../permissions/middleware.js");
    return requirePermission("vessel-intelligence", action)(req, res, next);
  };
}

function context(req: AuthenticatedRequest, params: { vesselId: string }) {
  return {
    orgId: req.orgId,
    vesselId: params.vesselId,
    userId: req.user?.id,
  };
}

function versionResponse(
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

function thumbnailResponse(params: { vesselId: string }, thumbnail: ThumbnailRecord) {
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

function parseUpload(req: Request): {
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
