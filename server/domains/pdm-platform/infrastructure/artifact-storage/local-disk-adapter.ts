import { promises as fs } from "fs";
import path from "path";
import {
  ArtifactBackend,
  ArtifactRef,
  ArtifactStoragePort,
  formatArtifactUri,
  parseArtifactUri,
} from "./types";

/**
 * Local-disk adapter — preserves single-instance behavior.
 *
 * `key` is interpreted as a path relative to `process.cwd()`, so a
 * legacy row with `metrics.artifactPath = "models/bearing-xxx.onnx"`
 * resolves identically to the new URI `arus-artifact://local/models/bearing-xxx.onnx`.
 */
export class LocalDiskArtifactStorage implements ArtifactStoragePort {
  readonly backend: ArtifactBackend = "local";

  private resolveLocal(key: string): string {
    if (path.isAbsolute(key)) {return key;}
    return path.resolve(process.cwd(), key);
  }

  async put(localPath: string, key: string): Promise<ArtifactRef> {
    const target = this.resolveLocal(key);
    if (path.resolve(localPath) !== target) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(localPath, target);
    }
    return { uri: formatArtifactUri("local", key), backend: "local", key };
  }

  async materializeToLocal(uri: string): Promise<string> {
    const ref = parseArtifactUri(uri);
    const p = this.resolveLocal(ref.key);
    await fs.access(p);
    return p;
  }

  async exists(uri: string): Promise<boolean> {
    try {
      const ref = parseArtifactUri(uri);
      await fs.access(this.resolveLocal(ref.key));
      return true;
    } catch {
      return false;
    }
  }
}
