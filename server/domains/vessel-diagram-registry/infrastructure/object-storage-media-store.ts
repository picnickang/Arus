import type { Response } from "express";
import type {
  PersistRegistryMediaInput,
  RegistryContext,
  VesselRegistryMediaStore,
} from "../domain/types";
import { quotaService } from "../../../tenancy/quota-service.js";
import { ObjectStorageService } from "../../../replit_integrations/object_storage/objectStorage.js";

export class ObjectStorageVesselRegistryMediaStore implements VesselRegistryMediaStore {
  async persist(ctx: RegistryContext, input: PersistRegistryMediaInput): Promise<string> {
    const objectStorage = new ObjectStorageService();
    const uploadURL = await objectStorage.getObjectEntityUploadURL(ctx.orgId);
    const putRes = await fetch(uploadURL, {
      method: "PUT",
      body: input.content,
      headers: {
        "Content-Type": input.mimeType,
        "X-ARUS-Media-Kind": input.kind,
      },
    });
    if (!putRes.ok) {
      throw new Error(`Failed to store vessel media (object storage status ${putRes.status})`);
    }

    const objectPath = await objectStorage.trySetObjectEntityAclPolicy(uploadURL, {
      owner: ctx.userId ?? "",
      visibility: "private",
    });
    void quotaService.incrementUsage(ctx.orgId, "storage_bytes", input.content.byteLength);
    return objectPath;
  }

  async archive(ctx: RegistryContext, objectKey: string): Promise<void> {
    try {
      const objectStorage = new ObjectStorageService();
      const objectFile = await objectStorage.getObjectEntityFile(objectKey);
      await objectFile.setMetadata({
        metadata: {
          arusArchivedAt: new Date().toISOString(),
          arusArchivedBy: ctx.userId ?? "system",
        },
      });
    } catch {
      // Archive is best effort. Never delete historical diagram or thumbnail
      // media as part of this registry flow.
    }
  }

  async send(ctx: RegistryContext, objectKey: string, res: Response): Promise<void> {
    const objectStorage = new ObjectStorageService();
    const objectFile = await objectStorage.getObjectEntityFile(objectKey);
    await objectStorage.downloadObject(objectFile, res, 3600, {
      orgId: ctx.orgId,
      userId: ctx.userId,
    });
  }
}
