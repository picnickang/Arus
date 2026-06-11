import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { authenticatedRequest, requireOrgId } from "../../middleware/auth";

/**
 * Register object storage routes for file uploads.
 *
 * LR-3.5 / TEN-5: hardened to parity with server/domains/storage-config/routes.ts.
 * - All routes carry `requireOrgId`, so an authenticated tenant claim
 *   is required.
 * - Upload signer is org-prefixed (`uploads/orgs/<orgId>/<uuid>`) so
 *   structural ownership can be enforced on download.
 * - Download path enforces structural ownership via the leaf-level
 *   `downloadObject` check (defence-in-depth: the route layer no
 *   longer needs to remember to call the helper).
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  app.post("/api/uploads/request-url", requireOrgId, async (req, res) => {
    try {
      const { name, size, contentType } = req.body as {
        name?: string;
        size?: number;
        contentType?: string;
      };

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const authed = authenticatedRequest(req);
      const uploadURL = await objectStorageService.getObjectEntityUploadURL(authed.orgId);
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      return res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      return res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", requireOrgId, async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const authed = authenticatedRequest(req);
      await objectStorageService.downloadObject(objectFile, res, 3600, {
        orgId: authed.orgId,
        userId: authed.user?.id,
      });
      return undefined;
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
