/**
 * Storage Config Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 *
 * Object storage configuration, ops database, and file management
 */

import { Express, Request, Response } from "express";
import { withErrorHandling, sendNotFound, sendDeleted } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface StorageConfigDependencies {}

export function registerStorageConfigRoutes(app: Express, deps: StorageConfigDependencies): void {
  // Get storage configuration
  app.get(
    "/api/storage/config",
    withErrorHandling("list storage configurations", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      const { kind } = req.query;
      const configs = await storageConfigService.list(kind as string);
      return res.json(configs);
    })
  );

  // Create/update storage configuration
  app.post(
    "/api/storage/config",
    withErrorHandling("save storage configuration", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      const { insertStorageConfigSchema } = await import("@shared/schema");
      const validatedData = insertStorageConfigSchema.parse(req.body);
      await storageConfigService.upsert(validatedData);
      return res.json({ success: true });
    })
  );

  // Delete storage configuration
  app.delete(
    "/api/storage/config/:id",
    withErrorHandling("delete storage configuration", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      await storageConfigService.delete(req.params['id']);
      sendDeleted(res);
    })
  );

  // Test storage configuration
  app.post(
    "/api/storage/config/test",
    withErrorHandling("test storage configuration", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      const { insertStorageConfigSchema } = await import("@shared/schema");
      const validatedData = insertStorageConfigSchema.parse(req.body);
      const result = await storageConfigService.test(validatedData);
      return res.json(result);
    })
  );

  // Get current ops database
  app.get(
    "/api/storage/ops-db/current",
    withErrorHandling("get current operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const current = await opsDbService.getCurrent();
      return res.json(current);
    })
  );

  // Stage ops database URL
  app.post(
    "/api/storage/ops-db/stage",
    withErrorHandling("stage operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      await opsDbService.stage(url);
      return res.json({ success: true });
    })
  );

  // Get staged ops database
  app.get(
    "/api/storage/ops-db/staged",
    withErrorHandling("get staged operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const staged = await opsDbService.getStaged();
      return res.json(staged);
    })
  );

  // Test ops database connection
  app.post(
    "/api/storage/ops-db/test",
    withErrorHandling("test operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      const result = await opsDbService.test(url);
      return res.json(result);
    })
  );

  // Public object access
  app.get(
    "/public-objects/:filePath(*)",
    withErrorHandling("search for public object", async (req: Request, res: Response) => {
      const { ObjectStorageService } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      const filePath = req.params['filePath'];
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return sendNotFound(res, "File");
      }
      objectStorageService.downloadObject(file, res);
    })
  );

  // Upload object
  app.post(
    "/api/objects/upload",
    withErrorHandling("get upload URL", async (req: Request, res: Response) => {
      const { ObjectStorageService } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      if (!(await objectStorageService.isConfigured())) {
        return res.status(503).json({
          error: "Object storage not configured",
          message:
            "Please configure PUBLIC_OBJECT_SEARCH_PATHS and PRIVATE_OBJECT_DIR environment variables",
        });
      }
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      return res.json({ uploadURL });
    })
  );

  // Get object (private with ACL)
  app.get(
    "/objects/:objectPath(*)",
    withErrorHandling("access object", async (req: Request, res: Response) => {
      const { ObjectStorageService, ObjectNotFoundError } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(req.path);
        objectStorageService.downloadObject(objectFile, res);
        return undefined;
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          return res.sendStatus(404);
        }
        throw error;
      }
    })
  );

  // App storage status
  app.get(
    "/api/storage/app-storage/status",
    withErrorHandling("check app storage status", async (req: Request, res: Response) => {
      const { ObjectStorageService } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      const configured = objectStorageService.isConfigured();
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const isReplit = objectStorageService.isReplitEnvironment();

      return res.json({
        configured,
        publicObjectSearchPaths: publicPaths,
        privateObjectDir: privateDir,
        replicationEnabled: isReplit,
        environment: isReplit ? "replit" : "external",
      });
    })
  );

  logger.info("StorageConfigRoutes", "Registered (config: 4, ops-db: 4, objects: 4)");
}
