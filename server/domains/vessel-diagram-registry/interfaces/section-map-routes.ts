import { withErrorHandling } from "../../../lib/route-utils";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { context, permission } from "./route-helpers";
import type { VesselDiagramRouteContext } from "./route-context";
import {
  cloneMapSchema,
  createSectionMapSchema,
  fromTemplateSchema,
  importSectionMapSchema,
  mapParamsSchema,
  updateSectionMapSchema,
  vesselParamsSchema,
} from "./route-schemas";
import type { VesselDiagramType } from "../domain/types";

export function registerSectionMapRoutes(routeContext: VesselDiagramRouteContext): void {
  const { app, deps, getService, orgGate, readPermission, writeLimit } = routeContext;

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
    withErrorHandling(
      "create vessel section map from template",
      async (req: AuthenticatedRequest, res) => {
        const ctx = context(req, vesselParamsSchema.parse(req.params));
        const input = fromTemplateSchema.parse(req.body);
        const service = await getService();
        res
          .status(201)
          .json(await service.createSectionMapFromTemplate(ctx, input.templateId, input));
      }
    )
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
}
