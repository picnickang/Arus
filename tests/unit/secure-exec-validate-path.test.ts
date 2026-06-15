/**
 * validatePath containment (secure-exec).
 *
 * The path-traversal guard must be separator-aware: a bare
 * `startsWith(base)` accepted a sibling directory that merely shares the
 * base's name prefix (e.g. base "<root>/patches" wrongly accepted
 * "<root>/patches-evil/..."). These pins lock the corrected behaviour.
 */
import { describe, it, expect, beforeAll } from "@jest/globals";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { validatePath } from "../../server/lib/secure-exec";

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vp-")));
const base = path.join(root, "patches");

describe("validatePath containment", () => {
  beforeAll(() => {
    fs.mkdirSync(base, { recursive: true });
  });

  it("allows a path inside the base dir", () => {
    expect(validatePath(base, "sub/file.txt")).toBe(path.join(base, "sub", "file.txt"));
  });

  it("allows the base dir itself", () => {
    expect(validatePath(base, ".")).toBe(base);
  });

  it("rejects parent traversal that escapes the base", () => {
    expect(() => validatePath(base, "../../etc/passwd")).toThrow(/traversal/i);
  });

  it("rejects a sibling dir that shares the base name prefix (startsWith bug)", () => {
    // Resolves to "<root>/patches-evil/backdoor.sh" — NOT inside "<root>/patches".
    expect(() => validatePath(base, "../patches-evil/backdoor.sh")).toThrow(/traversal/i);
  });
});
