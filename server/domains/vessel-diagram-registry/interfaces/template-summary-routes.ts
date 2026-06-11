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

export function registerTemplateSummaryRoutes(routeContext: VesselDiagramRouteContext): void {
  const { app, deps, getMediaStore, getService, orgGate, readPermission, storageQuota, upload, writeLimit } = routeContext;

  app.get(
    "/api/vessel-intelligence/section-map-templates",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling(
      "list vessel section map templates",
      async (_req: AuthenticatedRequest, res) => {
        const service = await getService();
        res.json(service.listSectionMapTemplates());
      }
    )
  );

  app.get(
    "/api/vessel-intelligence/section-map-templates/:templateId",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling(
      "fetch vessel section map template",
      async (req: AuthenticatedRequest, res) => {
        const params = templateParamsSchema.parse(req.params);
        const service = await getService();
        res.json(service.getSectionMapTemplate(params.templateId));
      }
    )
  );

  app.get(
    "/api/vessel-intelligence/summaries",
    orgGate,
    deps.generalApiRateLimit,
    readPermission,
    withErrorHandling(
      "fetch vessel intelligence summaries",
      async (req: AuthenticatedRequest, res) => {
        const { vesselIds } = summariesQuerySchema.parse(req.query);
        const service = await getService();
        res.json(await service.getSummaries({ orgId: req.orgId, userId: req.user?.id }, vesselIds));
      }
    )
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
}
