/**
 * Crew Routes - Crew Members
 * CRUD operations for crew members
 */

import multer from "multer";
import { insertCrewSchema } from "@shared/schema-runtime";
import { crewAppService as crewService } from "../application/index.js";
import { permissionRepository } from "../../permissions/repository.js";
import { authenticatedRequest, requireOrgId,
  requireOrgIdAndValidateBody, } from "../../../middleware/auth";
import { requirePermission } from "../../../lib/permissions/middleware.js";
import {
  withErrorHandling,
  sendCreated,
  sendDeleted,
  sendNotFound,
} from "../../../lib/route-utils.js";
import { enforceQuota } from "../../../middleware/tenant-quota.js";
import { quotaService } from "../../../tenancy/quota-service.js";
import { ObjectStorageService } from "../../../replit_integrations/object_storage/objectStorage.js";
import {
  validateImageMagicBytes,
  isAllowedImageMimeType,
} from "../../../lib/image-magic-bytes.js";
import type { CrewRouteDeps } from "./types.js";

// In-memory multer for crew profile photos. The buffer is magic-byte
// validated then streamed to object storage; nothing touches disk. 5MB
// is plenty for an avatar and keeps the storage_bytes quota honest.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImageMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PNG and JPEG images are allowed."));
    }
  },
});

/**
 * Best-effort delete a crew photo object. When `reclaimQuota` is true the
 * freed bytes are returned to the org's storage_bytes quota. Used both to
 * reclaim a replaced/removed photo (reclaimQuota: true) and to compensate a
 * just-uploaded object whose DB write failed before any quota was charged
 * (reclaimQuota: false). Never throws — a missing/unreadable object is a
 * no-op so the caller's primary flow is unaffected.
 */
async function deleteCrewPhotoObject(
  objectStorage: ObjectStorageService,
  photoPath: string,
  orgId: string,
  reclaimQuota: boolean,
): Promise<void> {
  try {
    const objectFile = await objectStorage.getObjectEntityFile(photoPath);
    const [metadata] = await objectFile.getMetadata();
    const freed = Number(metadata.size ?? 0);
    await objectFile.delete();
    if (reclaimQuota && freed > 0) {
      void quotaService.incrementUsage(orgId, "storage_bytes", -freed);
    }
  } catch {
    // Object already gone or unreadable — nothing to reclaim.
  }
}

export function registerCrewMemberRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("fetch crew", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;
      const { vesselId } = req.query;
      const crew = await crewService.listCrew(orgId, vesselId as string | undefined);
      res.json(crew);
    })
  );

  app.post(
    "/api/crew",
    requireOrgIdAndValidateBody,
    requirePermission("crew_members", "create"),
    writeOperationRateLimit,
    withErrorHandling("create crew member", async (req, res) => {
      const body = { ...req.body };
      if (typeof body.startDate === "string") {
        body.startDate = body.startDate ? new Date(body.startDate) : undefined;
      }
      if (typeof body.contractEndDate === "string") {
        body.contractEndDate = body.contractEndDate ? new Date(body.contractEndDate) : undefined;
      }
      if (typeof body.terminationDate === "string") {
        body.terminationDate = body.terminationDate ? new Date(body.terminationDate) : undefined;
      }
      // photoPath is managed exclusively by the dedicated photo routes.
      const crewData = insertCrewSchema.omit({ photoPath: true }).parse(body);
      const crew = await crewService.createCrew(crewData, req.user?.id);
      sendCreated(res, crew);
    })
  );

  // Get available ranks/roles for crew assignment
  // Sources ranks from the RBAC permissions system
  // Auto-provisions templates into roles table on first access
  // NOTE: This MUST be before /:id routes to match correctly
  app.get(
    "/api/crew/available-ranks",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("fetch available ranks", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;

      // Get or provision roles from templates - ensures all roles are in the roles table
      const allRoles = await permissionRepository.getOrProvisionRolesForOrg(orgId);

      // Format for crew assignment dropdown
      const availableRanks = allRoles
        .filter((role) => role.isActive)
        .map((role) => ({
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          department: role.department,
          hierarchyLevel: role.hierarchyLevel,
          source: role.templateId ? ("template" as const) : ("custom" as const),
        }))
        .sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);

      res.json(availableRanks);
    })
  );

  app.get(
    "/api/crew/:id",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("fetch crew member", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;
      const crew = await crewService.getCrewById(req.params['id'] ?? '', orgId);

      if (!crew) {
        sendNotFound(res, "Crew member");
        return;
      }

      res.json(crew);
    })
  );

  app.put(
    "/api/crew/:id",
    requireOrgIdAndValidateBody,
    requirePermission("crew_members", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update crew member", async (req, res) => {
      const body = { ...req.body };
      if (typeof body.startDate === "string") {
        body.startDate = body.startDate ? new Date(body.startDate) : undefined;
      }
      if (typeof body.contractEndDate === "string") {
        body.contractEndDate = body.contractEndDate ? new Date(body.contractEndDate) : undefined;
      }
      if (typeof body.terminationDate === "string") {
        body.terminationDate = body.terminationDate ? new Date(body.terminationDate) : undefined;
      }
      // photoPath is managed exclusively by the dedicated photo routes,
      // so the generic CRUD path cannot set or clear it.
      const crewData = insertCrewSchema.omit({ photoPath: true }).partial().parse(body);
      const orgId = authenticatedRequest(req).orgId;
      const crew = await crewService.updateCrew(req.params['id'] ?? '', crewData, req.user?.id, orgId);
      res.json(crew);
    })
  );

  app.delete(
    "/api/crew/:id",
    requireOrgId,
    requirePermission("crew_members", "delete"),
    criticalOperationRateLimit,
    withErrorHandling("delete crew member", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;
      await crewService.deleteCrew(req.params['id'] ?? '', req.user?.id, orgId);
      sendDeleted(res);
    })
  );

  // Upload (or replace) a crew member's profile photo. Multipart field
  // name: "photo". The buffer is magic-byte validated, streamed to
  // object storage with a private ACL owned by the uploader, and the
  // normalized /objects/... path is stored on the crew row.
  app.post(
    "/api/crew/:id/photo",
    requireOrgId,
    requirePermission("crew_members", "edit"),
    writeOperationRateLimit,
    enforceQuota("storage_bytes"),
    photoUpload.single("photo"),
    withErrorHandling("upload crew photo", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;
      const userId = req.user?.id;
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "A photo file is required (multipart field 'photo')." });
        return;
      }
      if (!validateImageMagicBytes(file.buffer, file.mimetype)) {
        res
          .status(400)
          .json({ error: "File contents do not match a valid PNG or JPEG image." });
        return;
      }
      const id = req.params['id'] ?? '';
      const existing = await crewService.getCrewById(id, orgId);
      if (!existing) {
        sendNotFound(res, "Crew member");
        return;
      }
      const previousPath = existing.photoPath ?? null;

      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL(orgId);
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file.buffer,
        headers: { "Content-Type": file.mimetype },
      });
      if (!putRes.ok) {
        throw new Error(`Failed to store crew photo (object storage status ${putRes.status})`);
      }
      const photoPath = await objectStorage.trySetObjectEntityAclPolicy(uploadURL, {
        owner: userId ?? "",
        visibility: "private",
      });

      let updated;
      try {
        updated = await crewService.updateCrew(id, { photoPath }, userId, orgId);
      } catch (err) {
        // DB write failed after the object landed — remove the orphan. No
        // quota was charged yet, so don't reclaim (reclaimQuota: false).
        await deleteCrewPhotoObject(objectStorage, photoPath, orgId, false);
        throw err;
      }

      // New bytes are committed: charge the quota, then reclaim the replaced
      // photo's bytes (best effort) so repeated replacements don't drift.
      void quotaService.incrementUsage(orgId, "storage_bytes", file.size);
      if (previousPath && previousPath !== photoPath) {
        await deleteCrewPhotoObject(objectStorage, previousPath, orgId, true);
      }
      res.json(updated);
    })
  );

  // Remove a crew member's profile photo. Best-effort deletes the backing
  // object (decrementing the storage quota by the freed bytes) and clears
  // the crew row reference.
  app.delete(
    "/api/crew/:id/photo",
    requireOrgId,
    requirePermission("crew_members", "edit"),
    writeOperationRateLimit,
    withErrorHandling("delete crew photo", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;
      const userId = req.user?.id;
      const id = req.params['id'] ?? '';
      const existing = await crewService.getCrewById(id, orgId);
      if (!existing) {
        sendNotFound(res, "Crew member");
        return;
      }

      const currentPath = existing.photoPath ?? null;
      if (currentPath) {
        await deleteCrewPhotoObject(new ObjectStorageService(), currentPath, orgId, true);
      }

      const updated = await crewService.updateCrew(id, { photoPath: null }, userId, orgId);
      res.json(updated);
    })
  );
}
