import multer from "multer";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";
import { requireOrgId, type AuthenticatedRequest } from "../../../middleware/auth";
import type { ActionCode } from "../../../config/permission-registry";
import { withErrorHandling } from "../../../lib/route-utils";
import { enforceQuota } from "../../../middleware/tenant-quota";
import { requirePermission } from "../../../lib/permissions/middleware.js";
import { VesselDiagramRegistryService } from "../application/service";
import { ObjectStorageVesselRegistryMediaStore } from "../infrastructure/object-storage-media-store.js";
import { postgresVesselDiagramRegistryStore } from "../infrastructure/postgres-store.js";
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
const assignmentParamsSchema = sectionParamsSchema.extend({ assignmentId: z.string().min(1) });
const templateParamsSchema = z.object({ templateId: z.string().min(1) });
const thumbnailSectionParamsSchema = vesselParamsSchema.extend({ sectionId: z.string().min(1) });
const thumbnailEquipmentParamsSchema = vesselParamsSchema.extend({
  equipmentId: z.string().min(1),
});

const createDiagramSchema = z.object({
  diagramType: z.enum(vesselDiagramTypeValues),
  title: z.string().min(1).max(180),
  description: z.string().max(1000).optional(),
});

const updateDiagramSchema = z.object({
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
  sourceMapId: z.string().min(1).optional(),
  diagramWidth: z.number().int().positive().optional(),
  diagramHeight: z.number().int().positive().optional(),
  diagramKind: z.enum(vesselDiagramTypeValues).optional(),
  sections: z.array(sectionSchema).optional(),
});

const updateSectionMapSchema = z.object({
  name: z.string().min(1).max(180).optional(),
  diagramId: z.string().min(1).nullable().optional(),
  diagramVersionId: z.string().min(1).nullable().optional(),
  sourceMapId: z.string().min(1).nullable().optional(),
  diagramWidth: z.number().int().positive().optional(),
  diagramHeight: z.number().int().positive().optional(),
  diagramKind: z.enum(vesselDiagramTypeValues).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

const cloneMapSchema = z.object({
  name: z.string().min(1).max(180),
  diagramId: z.string().min(1).optional(),
  diagramVersionId: z.string().min(1).optional(),
});

const assignEquipmentSchema = z.object({
  equipmentId: z.string().min(1).optional(),
  equipmentName: z.string().min(1).max(180),
  assetCode: z.string().max(120).optional(),
  system: z.string().max(120).optional(),
});

const updateEquipmentSchema = z.object({
  equipmentId: z.string().min(1).nullable().optional(),
  equipmentName: z.string().min(1).max(180).optional(),
  assetCode: z.string().max(120).nullable().optional(),
  system: z.string().max(120).nullable().optional(),
});

const updateSectionSchema = z.object({
  sectionKey: z.string().min(1).max(120).optional(),
  sectionNo: z.number().int().positive().optional(),
  name: z.string().min(1).max(180).optional(),
  color: z.string().min(1).max(24).optional(),
  thumbnailFallback: z.string().max(300).nullable().optional(),
  polygonNormalized: z.array(normalizedPointSchema).min(3).optional(),
  labelNormalized: normalizedPointSchema.optional(),
});

const polygonSchema = z.object({
  polygonNormalized: z.array(normalizedPointSchema).min(3),
  labelNormalized: normalizedPointSchema,
});

const importSectionMapSchema = z.object({
  sourceVesselId: z.string().min(1),
  sourceMapId: z.string().min(1),
  name: z.string().min(1).max(180),
  diagramId: z.string().min(1).optional(),
  diagramVersionId: z.string().min(1).optional(),
});

const fromTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1).max(180).optional(),
  diagramId: z.string().min(1).optional(),
  diagramVersionId: z.string().min(1).optional(),
});

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
    "/api/vessel-intelligence/section-map-templates",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("list vessel section map templates", async (_req: AuthenticatedRequest, res) => {
      const service = await getService();
      res.json(service.listSectionMapTemplates());
    })
  );

  app.get(
    "/api/vessel-intelligence/section-map-templates/:templateId",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("fetch vessel section map template", async (req: AuthenticatedRequest, res) => {
      const params = templateParamsSchema.parse(req.params);
      const service = await getService();
      res.json(service.getSectionMapTemplate(params.templateId));
    })
  );

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
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("fetch vessel diagram", async (req: AuthenticatedRequest, res) => {
      const params = diagramParamsSchema.parse(req.params);
      const service = await getService();
      res.json(await service.getDiagram(context(req, params), params.diagramId));
    })
  );

  app.patch(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId",
    orgGate,
    writeLimit,
    permission(deps, "configure"),
    withErrorHandling("update vessel diagram", async (req: AuthenticatedRequest, res) => {
      const params = diagramParamsSchema.parse(req.params);
      const input = updateDiagramSchema.parse(req.body);
      const service = await getService();
      res.json(await service.updateDiagram(context(req, params), params.diagramId, input));
    })
  );

  app.delete(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId",
    orgGate,
    writeLimit,
    permission(deps, "configure"),
    withErrorHandling("archive vessel diagram", async (req: AuthenticatedRequest, res) => {
      const params = diagramParamsSchema.parse(req.params);
      const service = await getService();
      await service.deleteDiagram(context(req, params), params.diagramId);
      res.status(204).send();
    })
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/active",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("fetch active vessel diagram version", async (req: AuthenticatedRequest, res) => {
      const params = diagramParamsSchema.parse(req.params);
      const service = await getService();
      const version = await service.getActiveVersion(context(req, params), params.diagramId);
      res.json(version ? versionResponse(params, version) : null);
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
      const behavior = parseUploadBehavior(req.body);
      if (behavior) {
        const result = await service.uploadDiagramVersionWithBehavior(
          context(req, params),
          params.diagramId,
          file,
          behavior
        );
        res.status(201).json({
          version: versionResponse(params, result.version),
          draftMap: result.draftMap,
          warnings: result.warnings,
        });
        return;
      }
      const version = await service.uploadDiagramVersion(context(req, params), params.diagramId, file);
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

  app.post(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/:versionId/publish",
    orgGate,
    writeLimit,
    permission(deps, "rollback-diagram"),
    withErrorHandling("publish vessel diagram version", async (req: AuthenticatedRequest, res) => {
      const params = versionParamsSchema.parse(req.params);
      const service = await getService();
      const version = await service.publishDiagramVersion(
        context(req, params),
        params.diagramId,
        params.versionId
      );
      res.json(versionResponse(params, version));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/:versionId/archive",
    orgGate,
    writeLimit,
    permission(deps, "rollback-diagram"),
    withErrorHandling("archive vessel diagram version", async (req: AuthenticatedRequest, res) => {
      const params = versionParamsSchema.parse(req.params);
      const service = await getService();
      const version = await service.archiveDiagramVersion(
        context(req, params),
        params.diagramId,
        params.versionId
      );
      res.json(versionResponse(params, version));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/:versionId/restore-draft",
    orgGate,
    writeLimit,
    permission(deps, "rollback-diagram"),
    withErrorHandling("restore vessel diagram version draft", async (req: AuthenticatedRequest, res) => {
      const params = versionParamsSchema.parse(req.params);
      const service = await getService();
      const version = await service.restoreDiagramVersionAsDraft(
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

  app.get(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("fetch vessel section map", async (req: AuthenticatedRequest, res) => {
      const params = mapParamsSchema.parse(req.params);
      const service = await getService();
      res.json(await service.getSectionMap(context(req, params), params.mapId));
    })
  );

  app.patch(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("update vessel section map", async (req: AuthenticatedRequest, res) => {
      const params = mapParamsSchema.parse(req.params);
      const input = updateSectionMapSchema.parse(req.body);
      const service = await getService();
      res.json(await service.updateSectionMap(context(req, params), params.mapId, input));
    })
  );

  app.delete(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("archive vessel section map", async (req: AuthenticatedRequest, res) => {
      const params = mapParamsSchema.parse(req.params);
      const service = await getService();
      await service.deleteSectionMap(context(req, params), params.mapId);
      res.status(204).send();
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
    "/api/vessel-intelligence/:vesselId/section-maps/import",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("import vessel section map", async (req: AuthenticatedRequest, res) => {
      const ctx = context(req, vesselParamsSchema.parse(req.params));
      const input = importSectionMapSchema.parse(req.body);
      const service = await getService();
      res.status(201).json(
        await service.cloneSectionMapFromVessel(ctx, input.sourceVesselId, input.sourceMapId, {
          name: input.name,
          diagramId: input.diagramId,
          diagramVersionId: input.diagramVersionId,
        })
      );
    })
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/export",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("export vessel section map", async (req: AuthenticatedRequest, res) => {
      const params = mapParamsSchema.parse(req.params);
      const service = await getService();
      res.json(await service.getSectionMap(context(req, params), params.mapId));
    })
  );

  app.post(
    "/api/vessel-intelligence/:vesselId/section-maps/from-template",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("create vessel section map from template", async (req: AuthenticatedRequest, res) => {
      const ctx = context(req, vesselParamsSchema.parse(req.params));
      const input = fromTemplateSchema.parse(req.body);
      const service = await getService();
      res
        .status(201)
        .json(await service.createSectionMapFromTemplate(ctx, input.templateId, input));
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
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/sections",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("create vessel section", async (req: AuthenticatedRequest, res) => {
      const params = mapParamsSchema.parse(req.params);
      const input = sectionSchema.parse(req.body);
      const service = await getService();
      res.status(201).json(await service.addSection(context(req, params), params.mapId, input));
    })
  );

  app.patch(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/sections/:sectionId",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("update vessel section", async (req: AuthenticatedRequest, res) => {
      const params = sectionParamsSchema.parse(req.params);
      const input = updateSectionSchema.parse(req.body);
      const service = await getService();
      res.json(
        await service.updateSection(context(req, params), params.mapId, params.sectionId, input)
      );
    })
  );

  app.delete(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/sections/:sectionId",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("delete vessel section", async (req: AuthenticatedRequest, res) => {
      const params = sectionParamsSchema.parse(req.params);
      const service = await getService();
      await service.deleteSection(context(req, params), params.mapId, params.sectionId);
      res.status(204).send();
    })
  );

  app.put(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/sections/:sectionId/polygon",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("update vessel section polygon", async (req: AuthenticatedRequest, res) => {
      const params = sectionParamsSchema.parse(req.params);
      const input = polygonSchema.parse(req.body);
      const service = await getService();
      res.json(
        await service.updateSectionPolygon(
          context(req, params),
          params.mapId,
          params.sectionId,
          input
        )
      );
    })
  );

  app.delete(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/sections/:sectionId/polygon",
    orgGate,
    writeLimit,
    permission(deps, "edit-section-map"),
    withErrorHandling("delete vessel section polygon", async (req: AuthenticatedRequest, res) => {
      const params = sectionParamsSchema.parse(req.params);
      const service = await getService();
      res.json(await service.deleteSectionPolygon(context(req, params), params.mapId, params.sectionId));
    })
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/equipment-assignments",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling("list vessel section equipment assignments", async (req: AuthenticatedRequest, res) => {
      const params = mapParamsSchema.parse(req.params);
      const service = await getService();
      res.json(await service.listEquipmentAssignments(context(req, params), params.mapId));
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

  app.patch(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/sections/:sectionId/equipment/:assignmentId",
    orgGate,
    writeLimit,
    permission(deps, "assign-equipment"),
    withErrorHandling("update vessel section equipment assignment", async (req: AuthenticatedRequest, res) => {
      const params = assignmentParamsSchema.parse(req.params);
      const input = updateEquipmentSchema.parse(req.body);
      const service = await getService();
      res.json(
        await service.updateEquipmentAssignment(
          context(req, params),
          params.mapId,
          params.sectionId,
          params.assignmentId,
          input
        )
      );
    })
  );

  app.delete(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/sections/:sectionId/equipment/:assignmentId",
    orgGate,
    writeLimit,
    permission(deps, "assign-equipment"),
    withErrorHandling("delete vessel section equipment assignment", async (req: AuthenticatedRequest, res) => {
      const params = assignmentParamsSchema.parse(req.params);
      const service = await getService();
      await service.deleteEquipmentAssignment(
        context(req, params),
        params.mapId,
        params.sectionId,
        params.assignmentId
      );
      res.status(204).send();
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

  app.post(
    "/api/vessel-intelligence/:vesselId/sections/:sectionId/thumbnail",
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

  app.post(
    "/api/vessel-intelligence/:vesselId/equipment/:equipmentId/thumbnail",
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
    mediaStore = new ObjectStorageVesselRegistryMediaStore();
    return mediaStore;
  };
}

function permission(deps: VesselDiagramRegistryRouteDeps, action: ActionCode): RequestHandler {
  if (deps.permissionMode === "skip") {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return async (req: Request, res: Response, next: NextFunction) => {
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

function parseUploadBehavior(body: unknown) {
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
