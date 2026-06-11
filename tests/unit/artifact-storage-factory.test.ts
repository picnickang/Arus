/**
 * ArtifactBackendSettingPort — boot-order contract
 *
 * Pins the late-configuration behavior introduced with the
 * pdm-platform → system-admin dependency inversion (#97 follow-up):
 *
 *   - Before any port is wired, `getWriteAdapter()` MUST resolve via
 *     the env-derived default and cache it.
 *   - When `configureArtifactBackendSettingPort()` is called AFTER
 *     that cache warmed, the cached default MUST be dropped so the
 *     next `getWriteAdapter()` call reads through the injected port
 *     (otherwise late wiring would be silently shadowed).
 *   - `setArtifactBackendSetting()` MUST throw if no port has been
 *     configured — better to fail loud than to lose the admin write.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  configureArtifactBackendSettingPort,
  getWriteAdapter,
  setArtifactBackendSetting,
  _resetArtifactBackendSettingPortForTest,
  _resetArtifactStorageCacheForTest,
  type ArtifactBackendSettingPort,
} from "../../server/domains/pdm-platform/infrastructure/artifact-storage/factory.js";
import type { ArtifactBackend } from "../../server/domains/pdm-platform/infrastructure/artifact-storage/types.js";

interface PortHarness {
  port: ArtifactBackendSettingPort;
  getReads: () => number;
  writes: ArtifactBackend[];
}

function makePort(initial: ArtifactBackend | null = null): PortHarness {
  let current: ArtifactBackend | null = initial;
  const writes: ArtifactBackend[] = [];
  let reads = 0;
  const port: ArtifactBackendSettingPort = {
    async read() {
      reads += 1;
      return current;
    },
    async write(backend) {
      writes.push(backend);
      current = backend;
    },
  };
  return { port, getReads: () => reads, writes };
}

describe("artifact-storage factory — boot-order contract", () => {
  beforeEach(() => {
    _resetArtifactBackendSettingPortForTest();
    _resetArtifactStorageCacheForTest();
    // Default to "App Storage NOT provisioned" — defaultBackend() ⇒
    // "local". Individual tests opt in to the replit-object-storage
    // branch by setting these explicitly and also providing the env
    // the adapter ctor needs.
    delete process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"];
    delete process.env["PRIVATE_OBJECT_DIR"];
  });

  function enableObjectStorageEnv(): void {
    process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"] = "test-bucket";
    process.env["PRIVATE_OBJECT_DIR"] = "/test-bucket/private";
  }

  /**
   * Provide only the ctor-required env (`PRIVATE_OBJECT_DIR`) so the
   * `ReplitObjectStorageArtifactStorage` adapter can be constructed,
   * WITHOUT also triggering `defaultBackend() === "replit-object-storage"`.
   * This lets a test force divergence: default ⇒ "local", port ⇒
   * "replit-object-storage", so a buggy implementation that ignored
   * the port and fell back to the default would resolve to the LOCAL
   * adapter — making the port-path observably distinct.
   */
  function enableObjectStorageCtorOnly(): void {
    delete process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"];
    process.env["PRIVATE_OBJECT_DIR"] = "/test-bucket/private";
  }

  it("falls back to the env default before any port is configured", async () => {
    const adapter = await getWriteAdapter();
    // No App Storage env → defaults to local disk
    expect(adapter.constructor.name).toBe("LocalDiskArtifactStorage");
  });

  it("clears the warmed default when a port is configured late", async () => {
    // 1) Warm the cache with the env-derived default (no port wired,
    //    no App Storage env) — defaultBackend() ⇒ "local".
    const first = await getWriteAdapter();
    expect(first.constructor.name).toBe("LocalDiskArtifactStorage");

    // 2) FORCE DIVERGENCE: keep defaultBackend() pinned to "local"
    //    (no DEFAULT_OBJECT_STORAGE_BUCKET_ID) but allow the
    //    Replit adapter ctor by providing PRIVATE_OBJECT_DIR. Port
    //    returns "replit-object-storage". If the implementation
    //    ignored the port (or never cleared the cached default), the
    //    next read would resolve to the LOCAL adapter and this
    //    assertion would fail.
    enableObjectStorageCtorOnly();
    const { port, getReads } = makePort("replit-object-storage");
    configureArtifactBackendSettingPort(port);

    const second = await getWriteAdapter();
    expect(second.constructor.name).toBe("ReplitObjectStorageArtifactStorage");
    // Prove the port was actually consulted after the late wiring.
    expect(getReads()).toBe(1);
  });

  it("reads from the port on first call when configured before any reader", async () => {
    // Same divergence trick: defaultBackend() ⇒ "local", port ⇒
    // "replit-object-storage". Asserting the Replit adapter AND the
    // port-read counter together proves we consulted the port rather
    // than silently using the env default.
    enableObjectStorageCtorOnly();
    const { port, getReads } = makePort("replit-object-storage");
    configureArtifactBackendSettingPort(port);

    const adapter = await getWriteAdapter();
    expect(adapter.constructor.name).toBe("ReplitObjectStorageArtifactStorage");
    expect(getReads()).toBe(1);

    // Subsequent reads hit the in-process cache, not the port.
    await getWriteAdapter();
    expect(getReads()).toBe(1);
  });

  it("falls back to the env default when the port returns null", async () => {
    const { port } = makePort(null);
    configureArtifactBackendSettingPort(port);

    const adapter = await getWriteAdapter();
    expect(adapter.constructor.name).toBe("LocalDiskArtifactStorage");
  });

  it("setArtifactBackendSetting throws when no port is configured", async () => {
    await expect(setArtifactBackendSetting("local")).rejects.toThrow(
      /ArtifactBackendSettingPort not configured/
    );
  });

  it("setArtifactBackendSetting writes through the port and updates the cache", async () => {
    enableObjectStorageEnv();
    const { port, writes } = makePort("local");
    configureArtifactBackendSettingPort(port);

    await setArtifactBackendSetting("replit-object-storage");
    expect(writes).toEqual(["replit-object-storage"]);

    // Next read uses the cached new value — does not need to hit the port.
    const adapter = await getWriteAdapter();
    expect(adapter.constructor.name).toBe("ReplitObjectStorageArtifactStorage");
  });
});
