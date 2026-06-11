import { withErrorHandling } from "../../../lib/route-utils";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import {
  context,
  parseUpload,
  parseUploadBehavior,
  permission,
  thumbnailResponse,
  versionResponse,
} from "./route-helpers";
import type { VesselDiagramRouteContext } from "./route-context";
import {
  assignmentParamsSchema,
  assignEquipmentSchema,
  cloneMapSchema,
  createDiagramSchema,
  createSectionMapSchema,
  diagramParamsSchema,
  fromTemplateSchema,
  importSectionMapSchema,
  mapParamsSchema,
  polygonSchema,
  sectionParamsSchema,
  sectionSchema,
  summariesQuerySchema,
  templateParamsSchema,
  thumbnailEquipmentParamsSchema,
  thumbnailSectionParamsSchema,
  updateDiagramSchema,
  updateEquipmentSchema,
  updateSectionMapSchema,
  updateSectionSchema,
  versionParamsSchema,
  vesselParamsSchema,
} from "./route-schemas";

export function registerSectionRoutes(routeContext: VesselDiagramRouteContext): void {
  const { app, deps, getMediaStore, getService, orgGate, readPermission, storageQuota, upload, writeLimit } = routeContext;

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
      res.json(
        await service.deleteSectionPolygon(context(req, params), params.mapId, params.sectionId)
      );
    })
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/equipment-assignments",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling(
      "list vessel section equipment assignments",
      async (req: AuthenticatedRequest, res) => {
        const params = mapParamsSchema.parse(req.params);
        const service = await getService();
        res.json(await service.listEquipmentAssignments(context(req, params), params.mapId));
      }
    )
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
    withErrorHandling(
      "update vessel section equipment assignment",
      async (req: AuthenticatedRequest, res) => {
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
      }
    )
  );

  app.delete(
    "/api/vessel-intelligence/:vesselId/section-maps/:mapId/sections/:sectionId/equipment/:assignmentId",
    orgGate,
    writeLimit,
    permission(deps, "assign-equipment"),
    withErrorHandling(
      "delete vessel section equipment assignment",
      async (req: AuthenticatedRequest, res) => {
        const params = assignmentParamsSchema.parse(req.params);
        const service = await getService();
        await service.deleteEquipmentAssignment(
          context(req, params),
          params.mapId,
          params.sectionId,
          params.assignmentId
        );
        res.status(204).send();
      }
    )
  );
}
