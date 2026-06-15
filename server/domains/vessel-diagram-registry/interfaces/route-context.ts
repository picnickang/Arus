import type { Express, RequestHandler } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { VesselDiagramRegistryService } from "../application/service";
import type { RegistryMediaResponder } from "./route-helpers";

export interface VesselDiagramRegistryRouteDeps {
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit?: RateLimitRequestHandler;
  storageQuota?: RequestHandler;
  requireOrgId?: RequestHandler;
  service?: VesselDiagramRegistryService;
  mediaStore?: RegistryMediaResponder;
  permissionMode?: "enforce" | "skip";
}

export interface VesselDiagramRouteContext {
  app: Express;
  deps: VesselDiagramRegistryRouteDeps;
  getService: () => Promise<VesselDiagramRegistryService>;
  getMediaStore: () => Promise<RegistryMediaResponder>;
  orgGate: RequestHandler;
  writeLimit: RequestHandler;
  storageQuota: RequestHandler;
  readPermission: RequestHandler;
  upload: { single(fieldName: string): RequestHandler };
}
