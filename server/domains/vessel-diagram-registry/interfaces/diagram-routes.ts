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

export function registerDiagramRoutes(routeContext: VesselDiagramRouteContext): void {
  const { app, deps, getMediaStore, getService, orgGate, readPermission, storageQuota, upload, writeLimit } = routeContext;

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
    withErrorHandling(
      "fetch active vessel diagram version",
      async (req: AuthenticatedRequest, res) => {
        const params = diagramParamsSchema.parse(req.params);
        const service = await getService();
        const version = await service.getActiveVersion(context(req, params), params.diagramId);
        res.json(version ? versionResponse(params, version) : null);
      }
    )
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
    withErrorHandling(
      "restore vessel diagram version draft",
      async (req: AuthenticatedRequest, res) => {
        const params = versionParamsSchema.parse(req.params);
        const service = await getService();
        const version = await service.restoreDiagramVersionAsDraft(
          context(req, params),
          params.diagramId,
          params.versionId
        );
        res.json(versionResponse(params, version));
      }
    )
  );

  app.get(
    "/api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/:versionId/media",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling(
      "download vessel diagram version media",
      async (req: AuthenticatedRequest, res) => {
        const params = versionParamsSchema.parse(req.params);
        const service = await getService();
        const mediaStore = await getMediaStore();
        const version = await service.getDiagramVersionMedia(
          context(req, params),
          params.diagramId,
          params.versionId
        );
        await mediaStore.send(context(req, params), version.objectKey, res);
      }
    )
  );
}
