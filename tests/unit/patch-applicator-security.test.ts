/**
 * Software-update trust hardening (security follow-up — Finding 1).
 *
 * The patch applicator previously extracted and applied update packages with
 * NO signature check and NO tar-slip protection: a manifest could point file
 * changes / migrations at arbitrary paths, and a crafted archive could write
 * outside the extraction directory via `../` or symlink entries. This pins the
 * hardened behaviour:
 *
 *   - verifyPatchTrust fails closed: no UPDATE_SIGNING_PUBLIC_KEY ⇒ refuse,
 *     unless a non-production env explicitly opts in via ALLOW_UNSIGNED_PATCHES.
 *   - assertSafeArchive rejects archives containing symlink (or other
 *     non-file/dir) entries, and accepts a clean archive of regular files.
 *   - applyFileChange refuses a change whose path escapes the app/extract dir.
 *
 * The hardened methods are private; we reach them via a typed cast (private is
 * a compile-time-only marker). Cloud mode is the default in the unit env, so
 * constructing the applicator does not trip the cloud-only guard.
 */
import { describe, it, expect, jest, beforeAll, beforeEach, afterEach } from "@jest/globals";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import * as tar from "tar";
import type { FileChange, PatchManifest } from "../../server/services/update-checker";

// patch-applicator transitively imports the heavy schema-runtime / db module
// graph (a committed untransformed `.js` artifact breaks the ESM unit lane).
// The hardened methods under test touch neither, so stub both to let the
// module load. Registered at top level so the dynamic import below sees them.
jest.unstable_mockModule("../../shared/schema-runtime", () => ({ softwarePatches: {} }));
jest.unstable_mockModule("../../server/db", () => ({ db: {} }));
// The unit env runs in VESSEL mode; neutralise the cloud-only guard so the
// module-load singleton (and our test instances) construct. The methods under
// test are deployment-agnostic.
jest.unstable_mockModule("../../server/utils/cloud-guards", () => ({
  assertCloudMode: () => {},
  getCloudTable: <T>(t: T): T => t,
}));

interface PatchApplicatorInternals {
  verifyPatchTrust(manifest: PatchManifest): Promise<void>;
  assertSafeArchive(patchPath: string, extractDir: string): Promise<void>;
  applyFileChange(change: FileChange, extractDir: string): Promise<void>;
}

let PatchApplicator: new () => unknown;

function internals(): PatchApplicatorInternals {
  return new PatchApplicator() as unknown as PatchApplicatorInternals;
}

beforeAll(async () => {
  ({ PatchApplicator } = await import("../../server/services/patch-applicator"));
});

const ENV_KEYS = ["NODE_ENV", "UPDATE_SIGNING_PUBLIC_KEY", "ALLOW_UNSIGNED_PATCHES"] as const;
let savedEnv: Record<string, string | undefined>;
let tmpRoot: string;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  delete process.env["UPDATE_SIGNING_PUBLIC_KEY"];
  delete process.env["ALLOW_UNSIGNED_PATCHES"];
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "patch-sec-"));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = savedEnv[k];
    }
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const EMPTY_MANIFEST = {} as PatchManifest;

describe("PatchApplicator — signature trust (fail-closed)", () => {
  it("refuses to apply when no signing key is configured (non-production, no opt-in)", async () => {
    process.env["NODE_ENV"] = "test";
    await expect(internals().verifyPatchTrust(EMPTY_MANIFEST)).rejects.toThrow(
      /UPDATE_SIGNING_PUBLIC_KEY is not configured/
    );
  });

  it("refuses to apply in production even with the unsigned opt-in set", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["ALLOW_UNSIGNED_PATCHES"] = "true";
    await expect(internals().verifyPatchTrust(EMPTY_MANIFEST)).rejects.toThrow(
      /UPDATE_SIGNING_PUBLIC_KEY is not configured/
    );
  });

  it("allows unsigned patches ONLY in non-production with the explicit opt-in", async () => {
    process.env["NODE_ENV"] = "development";
    process.env["ALLOW_UNSIGNED_PATCHES"] = "true";
    await expect(internals().verifyPatchTrust(EMPTY_MANIFEST)).resolves.toBeUndefined();
  });
});

describe("PatchApplicator — tar-slip protection", () => {
  async function makeArchive(
    entries: Array<{ name: string; symlinkTo?: string }>
  ): Promise<string> {
    const src = fs.mkdtempSync(path.join(tmpRoot, "src-"));
    const names: string[] = [];
    for (const entry of entries) {
      const full = path.join(src, entry.name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      if (entry.symlinkTo) {
        fs.symlinkSync(entry.symlinkTo, full);
      } else {
        fs.writeFileSync(full, "content");
      }
      names.push(entry.name);
    }
    const archive = path.join(tmpRoot, `archive-${Date.now()}.tar.gz`);
    // follow:false keeps symlinks stored as SymbolicLink entries.
    await tar.create({ file: archive, cwd: src, gzip: true, follow: false }, names);
    return archive;
  }

  it("accepts a clean archive of regular files and directories", async () => {
    const archive = await makeArchive([
      { name: "server/index.ts" },
      { name: "package.json" },
    ]);
    const extractDir = fs.mkdtempSync(path.join(tmpRoot, "extract-"));
    await expect(internals().assertSafeArchive(archive, extractDir)).resolves.toBeUndefined();
  });

  it("rejects an archive containing a symlink entry", async () => {
    const archive = await makeArchive([
      { name: "real.txt" },
      { name: "evil-link", symlinkTo: "/etc/passwd" },
    ]);
    const extractDir = fs.mkdtempSync(path.join(tmpRoot, "extract-"));
    await expect(internals().assertSafeArchive(archive, extractDir)).rejects.toThrow(
      /Unsafe patch archive rejected/
    );
  });
});

describe("PatchApplicator — path containment", () => {
  it("rejects a file change whose path escapes the extraction/app dir", async () => {
    const extractDir = fs.mkdtempSync(path.join(tmpRoot, "extract-"));
    const change: FileChange = {
      path: "../../../../etc/passwd",
      action: "create",
      url: "",
      hash: "",
      size: 0,
    };
    await expect(internals().applyFileChange(change, extractDir)).rejects.toThrow(
      /Path traversal detected/
    );
  });
});
