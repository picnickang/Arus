import { withErrorHandling } from "../../../lib/route-utils";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { context, parseUpload, permission, thumbnailResponse } from "./route-helpers";
import type { VesselDiagramRouteContext } from "./route-context";
import { thumbnailEquipmentParamsSchema, thumbnailSectionParamsSchema } from "./route-schemas";

export function registerThumbnailRoutes(routeContext: VesselDiagramRouteContext): void {
  const {
    app,
    deps,
    getMediaStore,
    getService,
    orgGate,
    readPermission,
    storageQuota,
    upload,
    writeLimit,
  } = routeContext;

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
    withErrorHandling(
      "download vessel section thumbnail",
      async (req: AuthenticatedRequest, res) => {
        const params = thumbnailSectionParamsSchema.parse(req.params);
        const service = await getService();
        const mediaStore = await getMediaStore();
        const thumbnail = await service.getThumbnailMedia(
          context(req, params),
          "section",
          params.sectionId
        );
        await mediaStore.send(context(req, params), thumbnail.objectKey, res);
      }
    )
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
