import multer from "multer";
import type { Express } from "express";
import { requireOrgId } from "../../../middleware/auth";
import { enforceQuota } from "../../../middleware/tenant-quota";
import {
  mediaStoreResolver,
  permission,
  serviceResolver,
} from "./route-helpers";
import { registerDiagramRoutes } from "./diagram-routes";
import { registerSectionMapRoutes } from "./section-map-routes";
import { registerSectionRoutes } from "./section-routes";
import { registerTemplateSummaryRoutes } from "./template-summary-routes";
import { registerThumbnailRoutes } from "./thumbnail-routes";
import type { VesselDiagramRegistryRouteDeps } from "./route-context";

export type { VesselDiagramRegistryRouteDeps } from "./route-context";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

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
  const routeContext = {
    app,
    deps,
    getMediaStore,
    getService,
    orgGate,
    writeLimit,
    storageQuota,
    readPermission,
    upload,
  };

  registerTemplateSummaryRoutes(routeContext);
  registerDiagramRoutes(routeContext);
  registerSectionMapRoutes(routeContext);
  registerSectionRoutes(routeContext);
  registerThumbnailRoutes(routeContext);
}
