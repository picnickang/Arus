import type { Response } from "express";
import type {
  PersistRegistryMediaInput,
  RegistryContext,
  VesselRegistryMediaStore,
} from "../domain/types";

interface StoredObject {
  content: Buffer;
  mimeType: string;
  archivedAt?: Date;
}

export class InMemoryVesselRegistryMediaStore implements VesselRegistryMediaStore {
  private readonly objects = new Map<string, StoredObject>();

  async persist(_ctx: RegistryContext, input: PersistRegistryMediaInput): Promise<string> {
    this.objects.set(input.objectKeyHint, {
      content: Buffer.from(input.content),
      mimeType: input.mimeType,
    });
    return input.objectKeyHint;
  }

  async archive(_ctx: RegistryContext, objectKey: string): Promise<void> {
    const object = this.objects.get(objectKey);
    if (object) {
      object.archivedAt = new Date();
    }
  }

  async send(_ctx: RegistryContext, objectKey: string, res: Response): Promise<void> {
    const object = this.objects.get(objectKey);
    if (!object || object.archivedAt) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    res.set({
      "Content-Type": object.mimeType,
      "Content-Length": String(object.content.byteLength),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(object.content);
  }

  get(objectKey: string): StoredObject | undefined {
    return this.objects.get(objectKey);
  }
}
